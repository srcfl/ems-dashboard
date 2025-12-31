//! SEL Runtime Engine
//!
//! Evaluates compiled SEL programs against incoming metric data.

use std::collections::HashMap;
use std::time::{Duration, Instant};

use crate::ast::*;
use crate::error::SELError;

/// Current values for all metrics
#[derive(Debug, Clone, Default)]
pub struct MetricValues {
    pub pv_power: Option<f64>,
    pub battery_power: Option<f64>,
    pub battery_soc: Option<f64>,
    pub grid_power: Option<f64>,
    pub grid_import: Option<f64>,
    pub grid_export: Option<f64>,
    pub load_power: Option<f64>,
}

impl MetricValues {
    pub fn get(&self, metric: &Metric) -> Option<f64> {
        match metric {
            Metric::PvPower => self.pv_power,
            Metric::BatteryPower => self.battery_power,
            Metric::BatterySoc => self.battery_soc,
            Metric::GridPower => self.grid_power,
            Metric::GridImport => self.grid_import,
            Metric::GridExport => self.grid_export,
            Metric::LoadPower => self.load_power,
        }
    }

    pub fn set(&mut self, metric: &Metric, value: f64) {
        match metric {
            Metric::PvPower => self.pv_power = Some(value),
            Metric::BatteryPower => self.battery_power = Some(value),
            Metric::BatterySoc => self.battery_soc = Some(value),
            Metric::GridPower => self.grid_power = Some(value),
            Metric::GridImport => self.grid_import = Some(value),
            Metric::GridExport => self.grid_export = Some(value),
            Metric::LoadPower => self.load_power = Some(value),
        }
    }
}

/// Result of evaluating a rule
#[derive(Debug, Clone)]
pub struct RuleResult {
    pub rule_id: String,
    pub triggered: bool,
    pub actions: Vec<ActionResult>,
    pub cooldown_remaining: Option<Duration>,
}

/// Result of an action execution
#[derive(Debug, Clone)]
pub enum ActionResult {
    Notify { message: String },
    Webhook { url: String, body: String },
    Log { message: String },
    Skipped { reason: String },
}

/// Historical data for trend/anomaly detection
#[derive(Debug, Clone, Default)]
pub struct MetricHistory {
    /// Map of metric -> list of (timestamp_ms, value)
    data: HashMap<Metric, Vec<(u64, f64)>>,
    max_age_seconds: u64,
}

impl MetricHistory {
    pub fn new(max_age_seconds: u64) -> Self {
        Self {
            data: HashMap::new(),
            max_age_seconds,
        }
    }

    pub fn add(&mut self, metric: Metric, timestamp_ms: u64, value: f64) {
        let history = self.data.entry(metric).or_default();
        history.push((timestamp_ms, value));

        // Prune old data
        let cutoff = timestamp_ms.saturating_sub(self.max_age_seconds * 1000);
        history.retain(|(ts, _)| *ts >= cutoff);
    }

    pub fn get_range(&self, metric: &Metric, period_seconds: u64, current_time_ms: u64) -> Vec<f64> {
        let cutoff = current_time_ms.saturating_sub(period_seconds * 1000);
        self.data
            .get(metric)
            .map(|h| h.iter().filter(|(ts, _)| *ts >= cutoff).map(|(_, v)| *v).collect())
            .unwrap_or_default()
    }

    pub fn get_recent(&self, metric: &Metric, count: usize) -> Vec<f64> {
        self.data
            .get(metric)
            .map(|h| h.iter().rev().take(count).map(|(_, v)| *v).collect())
            .unwrap_or_default()
    }
}

/// Rule cooldown state
#[derive(Debug, Clone, Default)]
pub struct CooldownState {
    /// Map of rule_id -> last trigger time
    last_triggered: HashMap<String, Instant>,
}

impl CooldownState {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_in_cooldown(&self, rule_id: &str, cooldown_seconds: u64) -> bool {
        if let Some(last) = self.last_triggered.get(rule_id) {
            last.elapsed() < Duration::from_secs(cooldown_seconds)
        } else {
            false
        }
    }

    pub fn remaining(&self, rule_id: &str, cooldown_seconds: u64) -> Option<Duration> {
        if let Some(last) = self.last_triggered.get(rule_id) {
            let elapsed = last.elapsed();
            let cooldown = Duration::from_secs(cooldown_seconds);
            if elapsed < cooldown {
                Some(cooldown - elapsed)
            } else {
                None
            }
        } else {
            None
        }
    }

    pub fn trigger(&mut self, rule_id: &str) {
        self.last_triggered.insert(rule_id.to_string(), Instant::now());
    }

    pub fn reset(&mut self, rule_id: &str) {
        self.last_triggered.remove(rule_id);
    }
}

/// The main runtime engine
pub struct Runtime {
    /// Variable values (resolved from Program.variables)
    variables: HashMap<String, f64>,
    /// Cooldown state per rule
    cooldowns: CooldownState,
    /// Historical metric data
    history: MetricHistory,
    /// Previous metric values (for trend detection)
    previous_values: MetricValues,
}

impl Runtime {
    pub fn new() -> Self {
        Self {
            variables: HashMap::new(),
            cooldowns: CooldownState::new(),
            history: MetricHistory::new(7 * 24 * 3600), // 7 days default
            previous_values: MetricValues::default(),
        }
    }

    /// Load variables from a compiled program
    pub fn load_variables(&mut self, program: &Program) {
        for var in &program.variables {
            let value = self.value_to_f64(&var.value);
            self.variables.insert(var.name.clone(), value);
        }
    }

    /// Record metric history (call periodically)
    pub fn record_history(&mut self, metrics: &MetricValues, timestamp_ms: u64) {
        for metric in &[
            Metric::PvPower,
            Metric::BatteryPower,
            Metric::BatterySoc,
            Metric::GridPower,
            Metric::GridImport,
            Metric::GridExport,
            Metric::LoadPower,
        ] {
            if let Some(value) = metrics.get(metric) {
                self.history.add(metric.clone(), timestamp_ms, value);
            }
        }
    }

    /// Evaluate an event rule against current metrics
    pub fn evaluate_event_rule(
        &mut self,
        rule: &EventRule,
        metrics: &MetricValues,
    ) -> Result<RuleResult, SELError> {
        // Check cooldown
        if let Some(cooldown) = rule.cooldown_seconds {
            if self.cooldowns.is_in_cooldown(&rule.id, cooldown) {
                return Ok(RuleResult {
                    rule_id: rule.id.clone(),
                    triggered: false,
                    actions: vec![ActionResult::Skipped {
                        reason: "In cooldown".to_string(),
                    }],
                    cooldown_remaining: self.cooldowns.remaining(&rule.id, cooldown),
                });
            }
        }

        // Check if rule is enabled
        if !rule.enabled {
            return Ok(RuleResult {
                rule_id: rule.id.clone(),
                triggered: false,
                actions: vec![ActionResult::Skipped {
                    reason: "Rule disabled".to_string(),
                }],
                cooldown_remaining: None,
            });
        }

        // Evaluate condition
        let condition_met = self.evaluate_condition(&rule.condition, metrics)?;

        if condition_met {
            // Execute actions
            let actions = self.execute_actions(&rule.actions, metrics)?;

            // Record trigger for cooldown
            self.cooldowns.trigger(&rule.id);

            // Update previous values for trend detection
            self.previous_values = metrics.clone();

            Ok(RuleResult {
                rule_id: rule.id.clone(),
                triggered: true,
                actions,
                cooldown_remaining: rule.cooldown_seconds.map(Duration::from_secs),
            })
        } else {
            Ok(RuleResult {
                rule_id: rule.id.clone(),
                triggered: false,
                actions: vec![],
                cooldown_remaining: None,
            })
        }
    }

    /// Evaluate all event rules in a program
    pub fn evaluate_all(
        &mut self,
        program: &Program,
        metrics: &MetricValues,
    ) -> Result<Vec<RuleResult>, SELError> {
        let mut results = Vec::new();

        for rule in &program.rules {
            if let Rule::Event(event_rule) = rule {
                results.push(self.evaluate_event_rule(event_rule, metrics)?);
            }
        }

        Ok(results)
    }

    /// Evaluate a condition
    fn evaluate_condition(
        &self,
        condition: &Condition,
        metrics: &MetricValues,
    ) -> Result<bool, SELError> {
        match condition {
            Condition::Comparison(cmp) => self.evaluate_comparison(cmp, metrics),
            Condition::Logical(log) => self.evaluate_logical(log, metrics),
            Condition::Trend(trend) => self.evaluate_trend(trend, metrics),
            Condition::Anomaly(anomaly) => self.evaluate_anomaly(anomaly, metrics),
            Condition::TimeWindow(_) => {
                // Time window conditions are handled by scheduler
                Ok(true)
            }
        }
    }

    fn evaluate_comparison(
        &self,
        cmp: &ComparisonCondition,
        metrics: &MetricValues,
    ) -> Result<bool, SELError> {
        let left = self.evaluate_expression(&cmp.left, metrics)?;
        let right = self.evaluate_expression(&cmp.right, metrics)?;

        Ok(match cmp.operator {
            ComparisonOp::LessThan => left < right,
            ComparisonOp::LessThanOrEqual => left <= right,
            ComparisonOp::GreaterThan => left > right,
            ComparisonOp::GreaterThanOrEqual => left >= right,
            ComparisonOp::Equal => (left - right).abs() < f64::EPSILON,
            ComparisonOp::NotEqual => (left - right).abs() >= f64::EPSILON,
        })
    }

    fn evaluate_logical(
        &self,
        log: &LogicalCondition,
        metrics: &MetricValues,
    ) -> Result<bool, SELError> {
        match log.operator {
            LogicalOp::And => {
                for cond in &log.conditions {
                    if !self.evaluate_condition(cond, metrics)? {
                        return Ok(false);
                    }
                }
                Ok(true)
            }
            LogicalOp::Or => {
                for cond in &log.conditions {
                    if self.evaluate_condition(cond, metrics)? {
                        return Ok(true);
                    }
                }
                Ok(false)
            }
            LogicalOp::Not => {
                if let Some(cond) = log.conditions.first() {
                    Ok(!self.evaluate_condition(cond, metrics)?)
                } else {
                    Ok(true)
                }
            }
        }
    }

    fn evaluate_trend(&self, trend: &TrendCondition, metrics: &MetricValues) -> Result<bool, SELError> {
        let current = metrics.get(&trend.metric);
        let previous = self.previous_values.get(&trend.metric);

        match (current, previous) {
            (Some(curr), Some(prev)) => {
                let diff = curr - prev;
                let threshold = trend.threshold_per_hour.unwrap_or(0.0);

                Ok(match trend.direction {
                    TrendDirection::Rising => diff > threshold,
                    TrendDirection::Falling => diff < -threshold,
                    TrendDirection::Stable => diff.abs() <= threshold,
                })
            }
            _ => Ok(false), // Not enough data
        }
    }

    fn evaluate_anomaly(
        &self,
        anomaly: &AnomalyCondition,
        metrics: &MetricValues,
    ) -> Result<bool, SELError> {
        let current = metrics.get(&anomaly.metric);
        let current_time_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let history = self.history.get_range(&anomaly.metric, anomaly.period_seconds, current_time_ms);

        if history.is_empty() || current.is_none() {
            return Ok(false);
        }

        let current = current.unwrap();

        // Calculate mean and stddev
        let sum: f64 = history.iter().sum();
        let mean = sum / history.len() as f64;
        let variance: f64 = history.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / history.len() as f64;
        let stddev = variance.sqrt();

        // Check if current value is outside normal range
        let deviation = (current - mean).abs();
        let threshold = stddev * anomaly.sensitivity;

        Ok(deviation > threshold)
    }

    fn evaluate_expression(&self, expr: &Expression, metrics: &MetricValues) -> Result<f64, SELError> {
        match expr {
            Expression::Metric(m) => metrics
                .get(&m.metric)
                .ok_or_else(|| SELError::runtime(format!("Metric {:?} not available", m.metric))),
            Expression::Literal(lit) => Ok(self.value_to_f64(&lit.value)),
            Expression::Variable(var) => self
                .variables
                .get(&var.name)
                .copied()
                .ok_or_else(|| SELError::runtime(format!("Variable ${} not defined", var.name))),
            Expression::Binary(bin) => {
                let left = self.evaluate_expression(&bin.left, metrics)?;
                let right = self.evaluate_expression(&bin.right, metrics)?;
                Ok(match bin.operator {
                    BinaryOp::Add => left + right,
                    BinaryOp::Subtract => left - right,
                    BinaryOp::Multiply => left * right,
                    BinaryOp::Divide => {
                        if right.abs() < f64::EPSILON {
                            return Err(SELError::runtime("Division by zero"));
                        }
                        left / right
                    }
                    BinaryOp::Modulo => left % right,
                })
            }
            Expression::Function(func) => self.evaluate_function(func, metrics),
        }
    }

    fn evaluate_function(&self, func: &FunctionCall, metrics: &MetricValues) -> Result<f64, SELError> {
        // Get the metric from the first argument
        let metric = if let Some(Expression::Metric(m)) = func.args.first() {
            &m.metric
        } else {
            return Err(SELError::runtime("Function requires a metric argument"));
        };

        let current_time_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);

        let period = func.period_seconds.unwrap_or(3600); // Default 1 hour
        let values = self.history.get_range(metric, period, current_time_ms);

        if values.is_empty() {
            // If no history, use current value
            return metrics.get(metric).ok_or_else(|| SELError::runtime("No data available"));
        }

        Ok(match func.name {
            Function::Avg => values.iter().sum::<f64>() / values.len() as f64,
            Function::Sum => values.iter().sum(),
            Function::Min => values.iter().copied().fold(f64::INFINITY, f64::min),
            Function::Max => values.iter().copied().fold(f64::NEG_INFINITY, f64::max),
            Function::Count => values.len() as f64,
            Function::Median => {
                let mut sorted = values.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                let mid = sorted.len() / 2;
                if sorted.len() % 2 == 0 {
                    (sorted[mid - 1] + sorted[mid]) / 2.0
                } else {
                    sorted[mid]
                }
            }
            Function::Stddev => {
                let mean = values.iter().sum::<f64>() / values.len() as f64;
                let variance: f64 =
                    values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
                variance.sqrt()
            }
            Function::Trend => {
                // Simple linear regression slope
                if values.len() < 2 {
                    return Ok(0.0);
                }
                let n = values.len() as f64;
                let sum_x: f64 = (0..values.len()).map(|i| i as f64).sum();
                let sum_y: f64 = values.iter().sum();
                let sum_xy: f64 = values.iter().enumerate().map(|(i, v)| i as f64 * v).sum();
                let sum_xx: f64 = (0..values.len()).map(|i| (i as f64).powi(2)).sum();
                (n * sum_xy - sum_x * sum_y) / (n * sum_xx - sum_x.powi(2))
            }
            Function::Percentile => {
                // Use 50th percentile as default (median)
                let mut sorted = values.clone();
                sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
                sorted[sorted.len() / 2]
            }
        })
    }

    /// Execute actions and return results
    fn execute_actions(
        &self,
        actions: &[Action],
        metrics: &MetricValues,
    ) -> Result<Vec<ActionResult>, SELError> {
        let mut results = Vec::new();

        for action in actions {
            match action {
                Action::Notify(notify) => {
                    let message = self.render_template(&notify.message, metrics);
                    results.push(ActionResult::Notify { message });
                }
                Action::Webhook(webhook) => {
                    let body = if let Some(body_template) = &webhook.body {
                        self.render_template(body_template, metrics)
                    } else {
                        self.generate_webhook_body(metrics)
                    };
                    results.push(ActionResult::Webhook {
                        url: webhook.url.clone(),
                        body,
                    });
                }
                Action::Log(log) => {
                    let message = self.render_template(&log.message, metrics);
                    results.push(ActionResult::Log { message });
                }
                Action::SetVariable(_) => {
                    // Variable setting not implemented in runtime v1.0
                    results.push(ActionResult::Skipped {
                        reason: "SetVariable action not supported in runtime v1.0".to_string(),
                    });
                }
            }
        }

        Ok(results)
    }

    /// Render a template string with current metric values
    fn render_template(&self, template: &TemplateString, metrics: &MetricValues) -> String {
        let mut result = String::new();

        for part in &template.parts {
            match part {
                TemplatePart::Text { text } => result.push_str(text),
                TemplatePart::Expression { expr } => {
                    // Try to evaluate the expression
                    if let Ok(value) = self.evaluate_expression(expr, metrics) {
                        // Format based on expression type
                        match expr {
                            Expression::Metric(m) => {
                                result.push_str(&format_metric_value(&m.metric, value));
                            }
                            _ => {
                                result.push_str(&format!("{:.1}", value));
                            }
                        }
                    } else {
                        result.push_str("{?}");
                    }
                }
            }
        }

        result
    }

    fn generate_webhook_body(&self, metrics: &MetricValues) -> String {
        let mut body = String::from("{");
        let mut first = true;

        for metric in &[
            Metric::PvPower,
            Metric::BatteryPower,
            Metric::BatterySoc,
            Metric::GridPower,
            Metric::GridImport,
            Metric::GridExport,
            Metric::LoadPower,
        ] {
            if let Some(value) = metrics.get(metric) {
                if !first {
                    body.push_str(", ");
                }
                body.push_str(&format!("\"{:?}\": {}", metric, value));
                first = false;
            }
        }

        body.push('}');
        body
    }

    fn value_to_f64(&self, value: &Value) -> f64 {
        match value {
            Value::Number(n) => *n,
            // Keep percent as 0-100 (matching battery_soc which is 0-100)
            Value::Percent(p) => *p,
            Value::Power { watts } => *watts,
            Value::Energy { watt_hours } => *watt_hours,
            Value::Duration { seconds } => *seconds as f64,
            Value::Time { hour, minute } => *hour as f64 * 60.0 + *minute as f64,
            Value::TimeRange { start, end } => {
                // Return duration in minutes
                let start_mins = start.hour as f64 * 60.0 + start.minute as f64;
                let end_mins = end.hour as f64 * 60.0 + end.minute as f64;
                end_mins - start_mins
            }
            Value::String(_) => 0.0,
        }
    }
}

impl Default for Runtime {
    fn default() -> Self {
        Self::new()
    }
}

/// Format a metric value for display
fn format_metric_value(metric: &Metric, value: f64) -> String {
    match metric {
        Metric::BatterySoc => format!("{:.0}%", value),
        Metric::PvPower | Metric::BatteryPower | Metric::GridPower | Metric::GridImport | Metric::GridExport | Metric::LoadPower => {
            if value.abs() >= 1000.0 {
                format!("{:.1} kW", value / 1000.0)
            } else {
                format!("{:.0} W", value)
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metric_values() {
        let mut metrics = MetricValues::default();
        metrics.set(&Metric::BatterySoc, 50.0);
        assert_eq!(metrics.get(&Metric::BatterySoc), Some(50.0));
    }

    #[test]
    fn test_cooldown_state() {
        let mut cooldowns = CooldownState::new();
        assert!(!cooldowns.is_in_cooldown("test", 60));

        cooldowns.trigger("test");
        assert!(cooldowns.is_in_cooldown("test", 60));
        assert!(!cooldowns.is_in_cooldown("test", 0));
    }

    #[test]
    fn test_simple_comparison() {
        let runtime = Runtime::new();
        let mut metrics = MetricValues::default();
        metrics.set(&Metric::BatterySoc, 15.0);

        let condition = Condition::Comparison(ComparisonCondition {
            left: Expression::Metric(MetricExpr {
                metric: Metric::BatterySoc,
            }),
            operator: ComparisonOp::LessThan,
            right: Expression::Literal(LiteralExpr {
                value: Value::Percent(20.0),
            }),
        });

        assert!(runtime.evaluate_condition(&condition, &metrics).unwrap());
    }

    #[test]
    fn test_logical_and() {
        let runtime = Runtime::new();
        let mut metrics = MetricValues::default();
        metrics.set(&Metric::BatterySoc, 15.0);
        metrics.set(&Metric::PvPower, 5000.0);

        let condition = Condition::Logical(LogicalCondition {
            operator: LogicalOp::And,
            conditions: vec![
                Condition::Comparison(ComparisonCondition {
                    left: Expression::Metric(MetricExpr {
                        metric: Metric::BatterySoc,
                    }),
                    operator: ComparisonOp::LessThan,
                    right: Expression::Literal(LiteralExpr {
                        value: Value::Percent(20.0),
                    }),
                }),
                Condition::Comparison(ComparisonCondition {
                    left: Expression::Metric(MetricExpr {
                        metric: Metric::PvPower,
                    }),
                    operator: ComparisonOp::GreaterThan,
                    right: Expression::Literal(LiteralExpr {
                        value: Value::Power { watts: 3000.0 },
                    }),
                }),
            ],
        });

        assert!(runtime.evaluate_condition(&condition, &metrics).unwrap());
    }

    #[test]
    fn test_template_rendering() {
        let runtime = Runtime::new();
        let mut metrics = MetricValues::default();
        metrics.set(&Metric::BatterySoc, 75.0);
        metrics.set(&Metric::PvPower, 5500.0);

        // Create a template with expressions
        let template = TemplateString {
            parts: vec![
                TemplatePart::Text { text: "Battery: ".to_string() },
                TemplatePart::Expression {
                    expr: Expression::Metric(MetricExpr { metric: Metric::BatterySoc }),
                },
                TemplatePart::Text { text: ", Solar: ".to_string() },
                TemplatePart::Expression {
                    expr: Expression::Metric(MetricExpr { metric: Metric::PvPower }),
                },
            ],
        };
        let result = runtime.render_template(&template, &metrics);

        assert!(result.contains("75%"), "Result was: {}", result);
        assert!(result.contains("5.5 kW"), "Result was: {}", result);
    }
}
