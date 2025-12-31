//! SEL Parser - Builds AST from tokens

use crate::ast::*;
use crate::error::SELError;
use crate::lexer::{Token, TokenKind};

pub struct Parser {
    tokens: Vec<Token>,
    current: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        // Filter out newlines for easier parsing
        let tokens: Vec<_> = tokens
            .into_iter()
            .filter(|t| !matches!(t.kind, TokenKind::Newline))
            .collect();
        Self { tokens, current: 0 }
    }

    pub fn parse(mut self) -> Result<Program, SELError> {
        let mut program = Program::default();

        while !self.is_at_end() {
            match self.peek().kind {
                TokenKind::Variable => {
                    if self.check_next(TokenKind::Assign) {
                        program.variables.push(self.variable_declaration()?);
                    } else {
                        self.advance();
                    }
                }
                TokenKind::On => {
                    program.rules.push(Rule::Event(self.event_rule()?));
                }
                TokenKind::Every => {
                    program.rules.push(Rule::Schedule(self.schedule_rule()?));
                }
                TokenKind::Eof => break,
                _ => {
                    self.advance();
                }
            }
        }

        Ok(program)
    }

    // ═══════════════════════════════════════════════════════════════════════
    // VARIABLES
    // ═══════════════════════════════════════════════════════════════════════

    fn variable_declaration(&mut self) -> Result<Variable, SELError> {
        let name = self.consume(TokenKind::Variable, "Expected variable name")?.value;
        self.consume(TokenKind::Assign, "Expected '='")?;
        let value = self.value()?;

        Ok(Variable { name, value })
    }

    fn value(&mut self) -> Result<Value, SELError> {
        let token = self.advance();

        match token.kind {
            TokenKind::Number => {
                let (num, unit) = parse_number_with_unit(&token.value);
                match unit.as_str() {
                    "W" => Ok(Value::Power { watts: num }),
                    "kW" => Ok(Value::Power { watts: num * 1000.0 }),
                    "MW" => Ok(Value::Power { watts: num * 1_000_000.0 }),
                    "Wh" => Ok(Value::Energy { watt_hours: num }),
                    "kWh" => Ok(Value::Energy { watt_hours: num * 1000.0 }),
                    "MWh" => Ok(Value::Energy { watt_hours: num * 1_000_000.0 }),
                    _ => Ok(Value::Number(num)),
                }
            }
            TokenKind::Percent => {
                let num: f64 = token.value.parse().unwrap_or(0.0);
                Ok(Value::Percent(num))
            }
            TokenKind::Duration => {
                let secs = parse_duration(&token.value);
                Ok(Value::Duration { seconds: secs })
            }
            TokenKind::Time => {
                let (h, m) = parse_time(&token.value);
                Ok(Value::Time { hour: h, minute: m })
            }
            TokenKind::String => {
                Ok(Value::String(token.value))
            }
            _ => Err(self.error("Expected value")),
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EVENT RULES
    // ═══════════════════════════════════════════════════════════════════════

    fn event_rule(&mut self) -> Result<EventRule, SELError> {
        self.consume(TokenKind::On, "Expected 'ON'")?;
        let condition = self.condition()?;
        let mut actions = Vec::new();
        let mut cooldown = None;

        // Parse indented block
        if self.check(TokenKind::Indent) {
            self.advance();
            while !self.check(TokenKind::Dedent) && !self.is_at_end() {
                if self.check(TokenKind::Notify) {
                    actions.push(self.notify_action()?);
                } else if self.check(TokenKind::Webhook) {
                    actions.push(self.webhook_action()?);
                } else if self.check(TokenKind::Cooldown) {
                    cooldown = Some(self.cooldown()?);
                } else {
                    break;
                }
            }
            if self.check(TokenKind::Dedent) {
                self.advance();
            }
        } else {
            // Single-line rule
            if self.check(TokenKind::Notify) {
                actions.push(self.notify_action()?);
            }
            if self.check(TokenKind::Webhook) {
                actions.push(self.webhook_action()?);
            }
            if self.check(TokenKind::Cooldown) {
                cooldown = Some(self.cooldown()?);
            }
        }

        Ok(EventRule {
            id: generate_id(),
            name: None,
            condition,
            actions,
            cooldown_seconds: cooldown,
            enabled: true,
        })
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SCHEDULE RULES
    // ═══════════════════════════════════════════════════════════════════════

    fn schedule_rule(&mut self) -> Result<ScheduleRule, SELError> {
        self.consume(TokenKind::Every, "Expected 'EVERY'")?;
        let schedule = self.schedule()?;
        let mut actions = Vec::new();

        // Parse indented block
        if self.check(TokenKind::Indent) {
            self.advance();
            while !self.check(TokenKind::Dedent) && !self.is_at_end() {
                if self.check(TokenKind::Notify) {
                    actions.push(self.notify_action()?);
                } else if self.check(TokenKind::Webhook) {
                    actions.push(self.webhook_action()?);
                } else {
                    break;
                }
            }
            if self.check(TokenKind::Dedent) {
                self.advance();
            }
        } else if self.check(TokenKind::Notify) {
            actions.push(self.notify_action()?);
        }

        Ok(ScheduleRule {
            id: generate_id(),
            name: None,
            schedule,
            actions,
            enabled: true,
        })
    }

    fn schedule(&mut self) -> Result<Schedule, SELError> {
        let mut frequency = CalendarFrequency::Daily;
        let mut at = TimeOfDay { hour: 0, minute: 0 };
        let mut on: Option<u8> = None;

        if self.check(TokenKind::Identifier) || self.check(TokenKind::Duration) {
            let token = self.advance();
            let text = token.value.to_lowercase();

            frequency = match text.as_str() {
                "day" | "daily" => CalendarFrequency::Daily,
                "week" | "weekly" => CalendarFrequency::Weekly,
                "month" | "monthly" => CalendarFrequency::Monthly,
                "monday" => { on = Some(1); CalendarFrequency::Weekly }
                "tuesday" => { on = Some(2); CalendarFrequency::Weekly }
                "wednesday" => { on = Some(3); CalendarFrequency::Weekly }
                "thursday" => { on = Some(4); CalendarFrequency::Weekly }
                "friday" => { on = Some(5); CalendarFrequency::Weekly }
                "saturday" => { on = Some(6); CalendarFrequency::Weekly }
                "sunday" => { on = Some(7); CalendarFrequency::Weekly }
                _ => CalendarFrequency::Daily,
            };
        }

        if self.match_token(TokenKind::At) {
            if self.check(TokenKind::Time) {
                let (h, m) = parse_time(&self.advance().value);
                at = TimeOfDay { hour: h, minute: m };
            }
        }

        Ok(Schedule::Calendar(CalendarSchedule { frequency, at, on }))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // CONDITIONS
    // ═══════════════════════════════════════════════════════════════════════

    fn condition(&mut self) -> Result<Condition, SELError> {
        self.or_condition()
    }

    fn or_condition(&mut self) -> Result<Condition, SELError> {
        let mut left = self.and_condition()?;

        while self.match_token(TokenKind::Or) {
            let right = self.and_condition()?;
            left = Condition::Logical(LogicalCondition {
                operator: LogicalOp::Or,
                conditions: vec![left, right],
            });
        }

        Ok(left)
    }

    fn and_condition(&mut self) -> Result<Condition, SELError> {
        let mut left = self.unary_condition()?;

        while self.match_token(TokenKind::And) {
            let right = self.unary_condition()?;
            left = Condition::Logical(LogicalCondition {
                operator: LogicalOp::And,
                conditions: vec![left, right],
            });
        }

        Ok(left)
    }

    fn unary_condition(&mut self) -> Result<Condition, SELError> {
        if self.match_token(TokenKind::Not) {
            let cond = self.unary_condition()?;
            return Ok(Condition::Logical(LogicalCondition {
                operator: LogicalOp::Not,
                conditions: vec![cond],
            }));
        }

        self.primary_condition()
    }

    fn primary_condition(&mut self) -> Result<Condition, SELError> {
        // Parenthesized
        if self.match_token(TokenKind::LParen) {
            let cond = self.condition()?;
            self.consume(TokenKind::RParen, "Expected ')'")?;
            return Ok(cond);
        }

        let expr = self.expression()?;

        // Trend: metric RISING/FALLING
        if self.check(TokenKind::Rising) || self.check(TokenKind::Falling) || self.check(TokenKind::Stable) {
            let dir = match self.advance().kind {
                TokenKind::Rising => TrendDirection::Rising,
                TokenKind::Falling => TrendDirection::Falling,
                _ => TrendDirection::Stable,
            };

            let metric = match expr {
                Expression::Metric(m) => m.metric,
                _ => return Err(self.error("Expected metric for trend condition")),
            };

            return Ok(Condition::Trend(TrendCondition {
                metric,
                direction: dir,
                threshold_per_hour: None,
            }));
        }

        // Anomaly: metric IS UNUSUAL COMPARED TO period
        if self.match_token(TokenKind::Is) {
            if self.match_token(TokenKind::Unusual) {
                self.consume(TokenKind::Compared, "Expected 'COMPARED'")?;
                self.consume(TokenKind::To, "Expected 'TO'")?;

                let period = if self.check(TokenKind::Duration) {
                    parse_duration(&self.advance().value)
                } else {
                    86400 * 7 // Default 7 days
                };

                let metric = match expr {
                    Expression::Metric(m) => m.metric,
                    _ => return Err(self.error("Expected metric for anomaly condition")),
                };

                return Ok(Condition::Anomaly(AnomalyCondition {
                    metric,
                    period_seconds: period,
                    sensitivity: 2.0,
                }));
            }
        }

        // Comparison
        let op = self.comparison_op()?;
        let right = self.expression()?;

        Ok(Condition::Comparison(ComparisonCondition {
            left: expr,
            operator: op,
            right,
        }))
    }

    fn comparison_op(&mut self) -> Result<ComparisonOp, SELError> {
        let token = self.advance();
        match token.kind {
            TokenKind::Eq => Ok(ComparisonOp::Equal),
            TokenKind::Neq => Ok(ComparisonOp::NotEqual),
            TokenKind::Lt => Ok(ComparisonOp::LessThan),
            TokenKind::Lte => Ok(ComparisonOp::LessThanOrEqual),
            TokenKind::Gt => Ok(ComparisonOp::GreaterThan),
            TokenKind::Gte => Ok(ComparisonOp::GreaterThanOrEqual),
            _ => Err(self.error("Expected comparison operator")),
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EXPRESSIONS
    // ═══════════════════════════════════════════════════════════════════════

    fn expression(&mut self) -> Result<Expression, SELError> {
        self.additive()
    }

    fn additive(&mut self) -> Result<Expression, SELError> {
        let mut left = self.multiplicative()?;

        while self.check(TokenKind::Plus) || self.check(TokenKind::Minus) {
            let op = if self.advance().kind == TokenKind::Plus {
                BinaryOp::Add
            } else {
                BinaryOp::Subtract
            };
            let right = self.multiplicative()?;
            left = Expression::Binary(BinaryExpr {
                left: Box::new(left),
                operator: op,
                right: Box::new(right),
            });
        }

        Ok(left)
    }

    fn multiplicative(&mut self) -> Result<Expression, SELError> {
        let mut left = self.primary()?;

        while self.check(TokenKind::Star) || self.check(TokenKind::Slash) || self.check(TokenKind::Modulo) {
            let op = match self.advance().kind {
                TokenKind::Star => BinaryOp::Multiply,
                TokenKind::Slash => BinaryOp::Divide,
                _ => BinaryOp::Modulo,
            };
            let right = self.primary()?;
            left = Expression::Binary(BinaryExpr {
                left: Box::new(left),
                operator: op,
                right: Box::new(right),
            });
        }

        Ok(left)
    }

    fn primary(&mut self) -> Result<Expression, SELError> {
        // Function
        if self.check(TokenKind::Function) {
            return self.function_call();
        }

        // Metric
        if self.check(TokenKind::Metric) {
            let name = self.advance().value;
            let metric = Metric::from_str(&name).ok_or_else(|| self.error("Unknown metric"))?;
            return Ok(Expression::Metric(MetricExpr { metric }));
        }

        // Variable
        if self.check(TokenKind::Variable) {
            let name = self.advance().value;
            return Ok(Expression::Variable(VariableRef { name }));
        }

        // Literal
        if self.check(TokenKind::Number) || self.check(TokenKind::Percent) {
            let value = self.value()?;
            return Ok(Expression::Literal(LiteralExpr { value }));
        }

        // Parenthesized
        if self.match_token(TokenKind::LParen) {
            let expr = self.expression()?;
            self.consume(TokenKind::RParen, "Expected ')'")?;
            return Ok(expr);
        }

        Err(self.error("Expected expression"))
    }

    fn function_call(&mut self) -> Result<Expression, SELError> {
        let name_str = self.consume(TokenKind::Function, "Expected function")?.value;
        let name = Function::from_str(&name_str).ok_or_else(|| self.error("Unknown function"))?;

        self.consume(TokenKind::LParen, "Expected '('")?;

        let mut args = Vec::new();
        let mut period = None;

        if !self.check(TokenKind::RParen) {
            args.push(self.expression()?);

            if self.match_token(TokenKind::Comma) {
                if self.check(TokenKind::Duration) || self.check(TokenKind::Identifier) {
                    let token = self.advance();
                    period = Some(parse_duration(&token.value));
                } else {
                    args.push(self.expression()?);
                }
            }
        }

        self.consume(TokenKind::RParen, "Expected ')'")?;

        Ok(Expression::Function(FunctionCall {
            name,
            args,
            period_seconds: period,
        }))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // ACTIONS
    // ═══════════════════════════════════════════════════════════════════════

    fn notify_action(&mut self) -> Result<Action, SELError> {
        self.consume(TokenKind::Notify, "Expected 'NOTIFY'")?;
        let message = self.consume(TokenKind::String, "Expected message string")?.value;

        Ok(Action::Notify(NotifyAction {
            message: TemplateString::from_literal(&message),
            channel: None,
            priority: None,
        }))
    }

    fn webhook_action(&mut self) -> Result<Action, SELError> {
        self.consume(TokenKind::Webhook, "Expected 'WEBHOOK'")?;
        let url = self.consume(TokenKind::String, "Expected URL string")?.value;

        Ok(Action::Webhook(WebhookAction {
            url,
            method: None,
            headers: None,
            body: None,
        }))
    }

    fn cooldown(&mut self) -> Result<u64, SELError> {
        self.consume(TokenKind::Cooldown, "Expected 'COOLDOWN'")?;
        let token = self.consume(TokenKind::Duration, "Expected duration")?;
        Ok(parse_duration(&token.value))
    }

    // ═══════════════════════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════════════════════

    fn peek(&self) -> &Token {
        &self.tokens[self.current]
    }

    fn check(&self, kind: TokenKind) -> bool {
        !self.is_at_end() && self.peek().kind == kind
    }

    fn check_next(&self, kind: TokenKind) -> bool {
        self.current + 1 < self.tokens.len() && self.tokens[self.current + 1].kind == kind
    }

    fn match_token(&mut self, kind: TokenKind) -> bool {
        if self.check(kind) {
            self.advance();
            true
        } else {
            false
        }
    }

    fn advance(&mut self) -> Token {
        if !self.is_at_end() {
            self.current += 1;
        }
        self.tokens[self.current - 1].clone()
    }

    fn consume(&mut self, kind: TokenKind, msg: &str) -> Result<Token, SELError> {
        if self.check(kind) {
            Ok(self.advance())
        } else {
            Err(self.error(msg))
        }
    }

    fn is_at_end(&self) -> bool {
        self.peek().kind == TokenKind::Eof
    }

    fn error(&self, msg: &str) -> SELError {
        let token = self.peek();
        SELError::parser(msg, token.location.line, token.location.column)
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

fn generate_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis();
    format!("rule_{}", ts)
}

fn parse_number_with_unit(s: &str) -> (f64, String) {
    let mut num_end = 0;
    for (i, c) in s.char_indices() {
        if c.is_ascii_digit() || c == '.' {
            num_end = i + 1;
        } else {
            break;
        }
    }

    let num: f64 = s[..num_end].parse().unwrap_or(0.0);
    let unit = s[num_end..].to_string();
    (num, unit)
}

fn parse_duration(s: &str) -> u64 {
    let (num, unit) = parse_number_with_unit(s);
    let num = num as u64;

    match unit.to_lowercase().as_str() {
        "s" | "sec" => num,
        "min" | "m" => num * 60,
        "hour" | "h" => num * 3600,
        "day" | "d" => num * 86400,
        "week" | "w" => num * 604800,
        "month" => num * 2592000,
        "today" => 86400,
        _ => num * 60, // Default to minutes
    }
}

fn parse_time(s: &str) -> (u8, u8) {
    let parts: Vec<&str> = s.split(':').collect();
    let hour = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minute = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    (hour, minute)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::Lexer;

    fn parse(source: &str) -> Result<Program, SELError> {
        let lexer = Lexer::new(source);
        let tokens = lexer.tokenize()?;
        let parser = Parser::new(tokens);
        parser.parse()
    }

    #[test]
    fn test_simple_comparison() {
        let program = parse("ON battery_soc < 20%").unwrap();
        assert_eq!(program.rules.len(), 1);
    }

    #[test]
    fn test_with_action() {
        let program = parse(r#"ON pv_power > 3kW NOTIFY "High solar""#).unwrap();
        assert_eq!(program.rules.len(), 1);
        if let Rule::Event(rule) = &program.rules[0] {
            assert_eq!(rule.actions.len(), 1);
        }
    }
}
