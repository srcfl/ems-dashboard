//! Abstract Syntax Tree types for SEL
//!
//! These types represent the structure of a parsed SEL program.
//! All types are serializable for API transport.

use serde::{Deserialize, Serialize};

/// A complete SEL program
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Program {
    pub version: String,
    pub variables: Vec<Variable>,
    pub rules: Vec<Rule>,
}

impl Default for Program {
    fn default() -> Self {
        Self {
            version: "1.0".to_string(),
            variables: Vec::new(),
            rules: Vec::new(),
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIABLES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variable {
    pub name: String,
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "value")]
pub enum Value {
    Number(f64),
    Percent(f64),
    Power { watts: f64 },
    Energy { watt_hours: f64 },
    Duration { seconds: u64 },
    Time { hour: u8, minute: u8 },
    TimeRange { start: TimeOfDay, end: TimeOfDay },
    String(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeOfDay {
    pub hour: u8,
    pub minute: u8,
}

// ═══════════════════════════════════════════════════════════════════════════
// RULES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "rule_type")]
pub enum Rule {
    Event(EventRule),
    Schedule(ScheduleRule),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventRule {
    pub id: String,
    pub name: Option<String>,
    pub condition: Condition,
    pub actions: Vec<Action>,
    pub cooldown_seconds: Option<u64>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduleRule {
    pub id: String,
    pub name: Option<String>,
    pub schedule: Schedule,
    pub actions: Vec<Action>,
    pub enabled: bool,
}

// ═══════════════════════════════════════════════════════════════════════════
// CONDITIONS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum Condition {
    Comparison(ComparisonCondition),
    Logical(LogicalCondition),
    Trend(TrendCondition),
    Anomaly(AnomalyCondition),
    TimeWindow(TimeWindowCondition),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonCondition {
    pub left: Expression,
    pub operator: ComparisonOp,
    pub right: Expression,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ComparisonOp {
    #[serde(rename = "eq")]
    Equal,
    #[serde(rename = "neq")]
    NotEqual,
    #[serde(rename = "lt")]
    LessThan,
    #[serde(rename = "lte")]
    LessThanOrEqual,
    #[serde(rename = "gt")]
    GreaterThan,
    #[serde(rename = "gte")]
    GreaterThanOrEqual,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogicalCondition {
    pub operator: LogicalOp,
    pub conditions: Vec<Condition>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LogicalOp {
    And,
    Or,
    Not,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendCondition {
    pub metric: Metric,
    pub direction: TrendDirection,
    /// Threshold as rate per hour (e.g., 5.0 means 5%/hour)
    pub threshold_per_hour: Option<f64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TrendDirection {
    Rising,
    Falling,
    Stable,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyCondition {
    pub metric: Metric,
    /// Period in seconds to compare against
    pub period_seconds: u64,
    /// Number of standard deviations (default: 2.0)
    pub sensitivity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeWindowCondition {
    pub start: TimeOfDay,
    pub end: TimeOfDay,
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPRESSIONS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "expr_type")]
pub enum Expression {
    Metric(MetricExpr),
    Variable(VariableRef),
    Literal(LiteralExpr),
    Function(FunctionCall),
    Binary(BinaryExpr),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricExpr {
    pub metric: Metric,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum Metric {
    PvPower,
    BatteryPower,
    BatterySoc,
    GridPower,
    GridImport,
    GridExport,
    LoadPower,
}

impl Metric {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "pv_power" => Some(Metric::PvPower),
            "battery_power" => Some(Metric::BatteryPower),
            "battery_soc" => Some(Metric::BatterySoc),
            "grid_power" => Some(Metric::GridPower),
            "grid_import" => Some(Metric::GridImport),
            "grid_export" => Some(Metric::GridExport),
            "load_power" => Some(Metric::LoadPower),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Metric::PvPower => "pv_power",
            Metric::BatteryPower => "battery_power",
            Metric::BatterySoc => "battery_soc",
            Metric::GridPower => "grid_power",
            Metric::GridImport => "grid_import",
            Metric::GridExport => "grid_export",
            Metric::LoadPower => "load_power",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableRef {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LiteralExpr {
    pub value: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FunctionCall {
    pub name: Function,
    pub args: Vec<Expression>,
    /// Period in seconds for aggregate functions
    pub period_seconds: Option<u64>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum Function {
    Avg,
    Median,
    Sum,
    Min,
    Max,
    Count,
    Stddev,
    Trend,
    Percentile,
}

impl Function {
    pub fn from_str(s: &str) -> Option<Self> {
        match s.to_uppercase().as_str() {
            "AVG" => Some(Function::Avg),
            "MEDIAN" => Some(Function::Median),
            "SUM" => Some(Function::Sum),
            "MIN" => Some(Function::Min),
            "MAX" => Some(Function::Max),
            "COUNT" => Some(Function::Count),
            "STDDEV" => Some(Function::Stddev),
            "TREND" => Some(Function::Trend),
            "PERCENTILE" => Some(Function::Percentile),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BinaryExpr {
    pub left: Box<Expression>,
    pub operator: BinaryOp,
    pub right: Box<Expression>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum BinaryOp {
    #[serde(rename = "+")]
    Add,
    #[serde(rename = "-")]
    Subtract,
    #[serde(rename = "*")]
    Multiply,
    #[serde(rename = "/")]
    Divide,
    #[serde(rename = "%")]
    Modulo,
}

// ═══════════════════════════════════════════════════════════════════════════
// SCHEDULES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "schedule_type")]
pub enum Schedule {
    Interval(IntervalSchedule),
    Calendar(CalendarSchedule),
    Cron(CronSchedule),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntervalSchedule {
    /// Interval in seconds
    pub interval_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarSchedule {
    pub frequency: CalendarFrequency,
    pub at: TimeOfDay,
    /// For weekly: day of week (1-7, Monday=1)
    /// For monthly: day of month (1-31)
    pub on: Option<u8>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum CalendarFrequency {
    Daily,
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CronSchedule {
    pub expression: String,
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIONS
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "action_type")]
pub enum Action {
    Notify(NotifyAction),
    Webhook(WebhookAction),
    Log(LogAction),
    SetVariable(SetVariableAction),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotifyAction {
    pub message: TemplateString,
    pub channel: Option<NotifyChannel>,
    pub priority: Option<NotifyPriority>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NotifyChannel {
    Push,
    Email,
    Sms,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum NotifyPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookAction {
    pub url: String,
    pub method: Option<HttpMethod>,
    pub headers: Option<Vec<(String, String)>>,
    pub body: Option<TemplateString>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum HttpMethod {
    Get,
    Post,
    Put,
    Delete,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogAction {
    pub message: TemplateString,
    pub level: Option<LogLevel>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SetVariableAction {
    pub name: String,
    pub value: Expression,
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE STRINGS
// ═══════════════════════════════════════════════════════════════════════════

/// A string with embedded expressions like "Battery: {battery_soc}%"
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateString {
    pub parts: Vec<TemplatePart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "part_type")]
pub enum TemplatePart {
    Text { text: String },
    Expression { expr: Expression },
}

impl TemplateString {
    pub fn from_literal(s: &str) -> Self {
        Self {
            parts: vec![TemplatePart::Text { text: s.to_string() }],
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPILED OUTPUT (for runtime execution)
// ═══════════════════════════════════════════════════════════════════════════

/// Compiled program ready for execution by a runtime
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledProgram {
    pub version: String,
    pub compiled_at: String,
    pub checksum: String,
    pub variables: Vec<CompiledVariable>,
    pub rules: Vec<CompiledRule>,
    /// Metrics required by this program
    pub required_metrics: Vec<Metric>,
    /// Whether this program needs historical data
    pub requires_history: bool,
    /// Maximum history period needed (in seconds)
    pub max_history_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledVariable {
    pub name: String,
    /// Normalized value in base units (watts, watt-hours, etc.)
    pub value: f64,
    pub original: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledRule {
    pub id: String,
    pub name: Option<String>,
    pub rule_type: CompiledRuleType,
    pub enabled: bool,
    pub actions: Vec<CompiledAction>,
    pub cooldown_seconds: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CompiledRuleType {
    Event { condition: Condition },
    Schedule { schedule: Schedule },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompiledAction {
    pub action_type: String,
    pub config: serde_json::Value,
    /// Variables referenced in templates
    pub template_vars: Vec<String>,
}
