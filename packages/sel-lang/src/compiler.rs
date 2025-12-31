//! SEL Compiler - Transforms AST to executable JSON format
//!
//! The compiler takes a parsed Program and produces a CompiledProgram
//! ready for execution by a runtime engine.

use std::collections::HashSet;
use crate::ast::*;
use crate::error::SELError;

pub struct Compiler {
    required_metrics: HashSet<Metric>,
    max_history_seconds: u64,
}

impl Compiler {
    pub fn new() -> Self {
        Self {
            required_metrics: HashSet::new(),
            max_history_seconds: 0,
        }
    }

    /// Compile a program to a CompiledProgram structure
    pub fn compile(&mut self, program: &Program) -> Result<CompiledProgram, SELError> {
        // Reset state
        self.required_metrics.clear();
        self.max_history_seconds = 0;

        // Compile variables
        let variables: Vec<CompiledVariable> = program
            .variables
            .iter()
            .map(|v| self.compile_variable(v))
            .collect::<Result<Vec<_>, _>>()?;

        // Compile rules
        let rules: Vec<CompiledRule> = program
            .rules
            .iter()
            .map(|r| self.compile_rule(r))
            .collect::<Result<Vec<_>, _>>()?;

        let requires_history = self.max_history_seconds > 0;
        let required_metrics: Vec<Metric> = self.required_metrics.iter().copied().collect();

        Ok(CompiledProgram {
            version: program.version.clone(),
            compiled_at: chrono_now(),
            checksum: compute_checksum(program),
            variables,
            rules,
            required_metrics,
            requires_history,
            max_history_seconds: if requires_history {
                Some(self.max_history_seconds)
            } else {
                None
            },
        })
    }

    /// Convert a program to JSON
    pub fn to_json(&self, program: &Program) -> Result<String, SELError> {
        let mut compiler = Compiler::new();
        let compiled = compiler.compile(program)?;
        serde_json::to_string_pretty(&compiled)
            .map_err(|e| SELError::compiler(format!("JSON serialization failed: {}", e)))
    }

    fn compile_variable(&self, var: &Variable) -> Result<CompiledVariable, SELError> {
        let normalized = self.normalize_value(&var.value);
        Ok(CompiledVariable {
            name: var.name.clone(),
            value: normalized,
            original: var.value.clone(),
        })
    }

    fn normalize_value(&self, value: &Value) -> f64 {
        match value {
            Value::Number(n) => *n,
            Value::Percent(p) => *p / 100.0,
            Value::Power { watts } => *watts,
            Value::Energy { watt_hours } => *watt_hours,
            Value::Duration { seconds } => *seconds as f64,
            Value::Time { hour, minute } => (*hour as f64) * 60.0 + (*minute as f64),
            Value::TimeRange { start, end } => {
                let s = (start.hour as f64) * 60.0 + (start.minute as f64);
                let e = (end.hour as f64) * 60.0 + (end.minute as f64);
                e - s
            }
            Value::String(_) => 0.0,
        }
    }

    fn compile_rule(&mut self, rule: &Rule) -> Result<CompiledRule, SELError> {
        match rule {
            Rule::Event(event) => self.compile_event_rule(event),
            Rule::Schedule(schedule) => self.compile_schedule_rule(schedule),
        }
    }

    fn compile_event_rule(&mut self, rule: &EventRule) -> Result<CompiledRule, SELError> {
        // Extract metrics from condition
        self.extract_metrics_from_condition(&rule.condition);

        let actions: Vec<CompiledAction> = rule
            .actions
            .iter()
            .map(|a| self.compile_action(a))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(CompiledRule {
            id: rule.id.clone(),
            name: rule.name.clone(),
            rule_type: CompiledRuleType::Event {
                condition: rule.condition.clone(),
            },
            enabled: rule.enabled,
            actions,
            cooldown_seconds: rule.cooldown_seconds,
        })
    }

    fn compile_schedule_rule(&mut self, rule: &ScheduleRule) -> Result<CompiledRule, SELError> {
        let actions: Vec<CompiledAction> = rule
            .actions
            .iter()
            .map(|a| self.compile_action(a))
            .collect::<Result<Vec<_>, _>>()?;

        Ok(CompiledRule {
            id: rule.id.clone(),
            name: rule.name.clone(),
            rule_type: CompiledRuleType::Schedule {
                schedule: rule.schedule.clone(),
            },
            enabled: rule.enabled,
            actions,
            cooldown_seconds: None,
        })
    }

    fn compile_action(&self, action: &Action) -> Result<CompiledAction, SELError> {
        match action {
            Action::Notify(notify) => {
                let template_vars = self.extract_template_vars(&notify.message);
                let config = serde_json::json!({
                    "message": notify.message,
                    "channel": notify.channel,
                    "priority": notify.priority,
                });
                Ok(CompiledAction {
                    action_type: "notify".to_string(),
                    config,
                    template_vars,
                })
            }
            Action::Webhook(webhook) => {
                let template_vars = webhook
                    .body
                    .as_ref()
                    .map(|b| self.extract_template_vars(b))
                    .unwrap_or_default();
                let config = serde_json::json!({
                    "url": webhook.url,
                    "method": webhook.method,
                    "headers": webhook.headers,
                    "body": webhook.body,
                });
                Ok(CompiledAction {
                    action_type: "webhook".to_string(),
                    config,
                    template_vars,
                })
            }
            Action::Log(log) => {
                let template_vars = self.extract_template_vars(&log.message);
                let config = serde_json::json!({
                    "message": log.message,
                    "level": log.level,
                });
                Ok(CompiledAction {
                    action_type: "log".to_string(),
                    config,
                    template_vars,
                })
            }
            Action::SetVariable(set) => {
                let config = serde_json::json!({
                    "name": set.name,
                    "value": set.value,
                });
                Ok(CompiledAction {
                    action_type: "set_variable".to_string(),
                    config,
                    template_vars: vec![],
                })
            }
        }
    }

    fn extract_template_vars(&self, template: &TemplateString) -> Vec<String> {
        let mut vars = Vec::new();
        for part in &template.parts {
            if let TemplatePart::Expression { expr } = part {
                self.extract_vars_from_expr(expr, &mut vars);
            }
        }
        vars
    }

    fn extract_vars_from_expr(&self, expr: &Expression, vars: &mut Vec<String>) {
        match expr {
            Expression::Variable(v) => vars.push(v.name.clone()),
            Expression::Metric(m) => vars.push(m.metric.as_str().to_string()),
            Expression::Binary(b) => {
                self.extract_vars_from_expr(&b.left, vars);
                self.extract_vars_from_expr(&b.right, vars);
            }
            Expression::Function(f) => {
                for arg in &f.args {
                    self.extract_vars_from_expr(arg, vars);
                }
            }
            _ => {}
        }
    }

    fn extract_metrics_from_condition(&mut self, condition: &Condition) {
        match condition {
            Condition::Comparison(cmp) => {
                self.extract_metrics_from_expr(&cmp.left);
                self.extract_metrics_from_expr(&cmp.right);
            }
            Condition::Logical(log) => {
                for cond in &log.conditions {
                    self.extract_metrics_from_condition(cond);
                }
            }
            Condition::Trend(trend) => {
                self.required_metrics.insert(trend.metric);
                // Trends need some history
                self.max_history_seconds = self.max_history_seconds.max(3600); // 1 hour minimum
            }
            Condition::Anomaly(anomaly) => {
                self.required_metrics.insert(anomaly.metric);
                self.max_history_seconds = self.max_history_seconds.max(anomaly.period_seconds);
            }
            Condition::TimeWindow(_) => {}
        }
    }

    fn extract_metrics_from_expr(&mut self, expr: &Expression) {
        match expr {
            Expression::Metric(m) => {
                self.required_metrics.insert(m.metric);
            }
            Expression::Function(f) => {
                for arg in &f.args {
                    self.extract_metrics_from_expr(arg);
                }
                // Functions may need history
                if let Some(period) = f.period_seconds {
                    self.max_history_seconds = self.max_history_seconds.max(period);
                }
            }
            Expression::Binary(b) => {
                self.extract_metrics_from_expr(&b.left);
                self.extract_metrics_from_expr(&b.right);
            }
            _ => {}
        }
    }
}

impl Default for Compiler {
    fn default() -> Self {
        Self::new()
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap();
    let secs = duration.as_secs();
    // Simple ISO-8601 format
    format!("{}", secs)
}

fn compute_checksum(program: &Program) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();
    // Hash key program elements
    program.version.hash(&mut hasher);
    program.variables.len().hash(&mut hasher);
    program.rules.len().hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{Lexer, Parser};

    fn compile(source: &str) -> Result<CompiledProgram, SELError> {
        let lexer = Lexer::new(source);
        let tokens = lexer.tokenize()?;
        let parser = Parser::new(tokens);
        let program = parser.parse()?;
        let mut compiler = Compiler::new();
        compiler.compile(&program)
    }

    #[test]
    fn test_compile_simple_rule() {
        let result = compile("ON battery_soc < 20%");
        assert!(result.is_ok());
        let compiled = result.unwrap();
        assert_eq!(compiled.rules.len(), 1);
        assert!(compiled.required_metrics.contains(&Metric::BatterySoc));
    }

    #[test]
    fn test_compile_with_variable() {
        let result = compile(r#"
            $threshold = 20%
            ON battery_soc < $threshold
              NOTIFY "Low battery"
        "#);
        assert!(result.is_ok());
        let compiled = result.unwrap();
        assert_eq!(compiled.variables.len(), 1);
        assert_eq!(compiled.variables[0].name, "threshold");
    }

    #[test]
    fn test_compile_schedule() {
        let result = compile(r#"
            EVERY day AT 17:00
              NOTIFY "Daily report"
        "#);
        assert!(result.is_ok());
        let compiled = result.unwrap();
        assert_eq!(compiled.rules.len(), 1);
    }

    #[test]
    fn test_json_output() {
        let compiler = Compiler::new();
        let lexer = Lexer::new("ON pv_power > 3kW");
        let tokens = lexer.tokenize().unwrap();
        let parser = Parser::new(tokens);
        let program = parser.parse().unwrap();

        let json = compiler.to_json(&program);
        assert!(json.is_ok());
        let json_str = json.unwrap();
        assert!(json_str.contains("\"version\""));
        assert!(json_str.contains("\"rules\""));
    }
}
