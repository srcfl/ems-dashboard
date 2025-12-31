//! SEL Server - REST API for Sourceful Energy Language
//!
//! Endpoints:
//! - POST /api/validate - Validate SEL code
//! - POST /api/compile - Compile SEL code to JSON
//! - POST /api/evaluate - Evaluate rules against metrics
//! - GET /api/health - Health check
//! - GET /api/webhooks/:site_id - List webhooks for site
//! - POST /api/webhooks/:site_id - Create webhook
//! - PUT /api/webhooks/:site_id/:id - Update webhook
//! - DELETE /api/webhooks/:site_id/:id - Delete webhook
//! - POST /api/webhooks/:site_id/:id/test - Test webhook

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use sel_lang::*;
use sel_lang::dispatcher::async_dispatcher;

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

/// Application state shared across handlers
#[derive(Clone)]
struct AppState {
    /// Stored programs per site
    programs: Arc<RwLock<HashMap<String, Program>>>,
    /// Runtime instances per site
    runtimes: Arc<RwLock<HashMap<String, Runtime>>>,
    /// Scheduler instances per site
    schedulers: Arc<RwLock<HashMap<String, Scheduler>>>,
    /// Webhook configurations per site
    webhooks: Arc<RwLock<HashMap<String, Vec<WebhookConfig>>>>,
    /// Webhook delivery history per site (limited to last 100)
    webhook_history: Arc<RwLock<HashMap<String, Vec<WebhookDelivery>>>>,
    /// Dispatcher configuration
    dispatcher_config: DispatcherConfig,
}

impl AppState {
    fn new() -> Self {
        Self {
            programs: Arc::new(RwLock::new(HashMap::new())),
            runtimes: Arc::new(RwLock::new(HashMap::new())),
            schedulers: Arc::new(RwLock::new(HashMap::new())),
            webhooks: Arc::new(RwLock::new(HashMap::new())),
            webhook_history: Arc::new(RwLock::new(HashMap::new())),
            dispatcher_config: DispatcherConfig {
                dry_run: std::env::var("SEL_DRY_RUN").is_ok(),
                telegram_bot_token: std::env::var("TELEGRAM_BOT_TOKEN").ok(),
                telegram_chat_id: std::env::var("TELEGRAM_CHAT_ID").ok(),
                ..Default::default()
            },
        }
    }

    fn get_webhooks(&self, site_id: &str) -> Vec<WebhookConfig> {
        self.webhooks
            .read()
            .unwrap()
            .get(site_id)
            .cloned()
            .unwrap_or_default()
    }

    fn add_webhook(&self, site_id: &str, webhook: WebhookConfig) {
        let mut webhooks = self.webhooks.write().unwrap();
        webhooks
            .entry(site_id.to_string())
            .or_default()
            .push(webhook);
    }

    fn update_webhook(&self, site_id: &str, webhook_id: &str, update: WebhookUpdate) -> Option<WebhookConfig> {
        let mut webhooks = self.webhooks.write().unwrap();
        if let Some(site_webhooks) = webhooks.get_mut(site_id) {
            if let Some(wh) = site_webhooks.iter_mut().find(|w| w.id == webhook_id) {
                if let Some(name) = update.name {
                    wh.name = name;
                }
                if let Some(url) = update.url {
                    wh.url = url;
                }
                if let Some(enabled) = update.enabled {
                    wh.enabled = enabled;
                }
                if let Some(auth_type) = update.auth_type {
                    wh.auth_type = auth_type;
                }
                if let Some(auth_token) = update.auth_token {
                    wh.auth_token = Some(auth_token);
                }
                if let Some(events) = update.events {
                    wh.events = events;
                }
                if let Some(headers) = update.headers {
                    wh.headers = headers;
                }
                return Some(wh.clone());
            }
        }
        None
    }

    fn delete_webhook(&self, site_id: &str, webhook_id: &str) -> bool {
        let mut webhooks = self.webhooks.write().unwrap();
        if let Some(site_webhooks) = webhooks.get_mut(site_id) {
            let len_before = site_webhooks.len();
            site_webhooks.retain(|w| w.id != webhook_id);
            return site_webhooks.len() < len_before;
        }
        false
    }

    fn record_delivery(&self, site_id: &str, delivery: WebhookDelivery) {
        let mut history = self.webhook_history.write().unwrap();
        let site_history = history.entry(site_id.to_string()).or_default();
        site_history.push(delivery);
        // Keep only last 100 deliveries
        if site_history.len() > 100 {
            site_history.drain(0..site_history.len() - 100);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST/RESPONSE TYPES
// ═══════════════════════════════════════════════════════════════════════════

#[derive(Deserialize)]
struct ValidateRequest {
    code: String,
}

#[derive(Serialize)]
struct ValidateResponse {
    valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_line: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error_column: Option<usize>,
}

#[derive(Deserialize)]
struct CompileRequest {
    code: String,
}

#[derive(Serialize)]
struct CompileResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    compiled: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Deserialize)]
struct StoreRequest {
    site_id: String,
    code: String,
}

#[derive(Serialize)]
struct StoreResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
    rules_count: usize,
    variables_count: usize,
}

#[derive(Deserialize)]
struct EvaluateRequest {
    site_id: String,
    metrics: MetricsInput,
    #[serde(default)]
    timestamp_ms: Option<u64>,
}

#[derive(Deserialize)]
struct MetricsInput {
    #[serde(default)]
    pv_power: Option<f64>,
    #[serde(default)]
    battery_power: Option<f64>,
    #[serde(default)]
    battery_soc: Option<f64>,
    #[serde(default)]
    grid_power: Option<f64>,
    #[serde(default)]
    grid_import: Option<f64>,
    #[serde(default)]
    grid_export: Option<f64>,
    #[serde(default)]
    load_power: Option<f64>,
}

impl From<MetricsInput> for MetricValues {
    fn from(m: MetricsInput) -> Self {
        let mut values = MetricValues::default();
        if let Some(v) = m.pv_power {
            values.set(&Metric::PvPower, v);
        }
        if let Some(v) = m.battery_power {
            values.set(&Metric::BatteryPower, v);
        }
        if let Some(v) = m.battery_soc {
            values.set(&Metric::BatterySoc, v);
        }
        if let Some(v) = m.grid_power {
            values.set(&Metric::GridPower, v);
        }
        if let Some(v) = m.grid_import {
            values.set(&Metric::GridImport, v);
        }
        if let Some(v) = m.grid_export {
            values.set(&Metric::GridExport, v);
        }
        if let Some(v) = m.load_power {
            values.set(&Metric::LoadPower, v);
        }
        values
    }
}

#[derive(Serialize)]
struct EvaluateResponse {
    success: bool,
    triggered_rules: Vec<TriggeredRule>,
    dispatched_actions: Vec<DispatchedAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct TriggeredRule {
    rule_id: String,
    actions_count: usize,
}

#[derive(Serialize)]
struct DispatchedAction {
    action_type: String,
    success: bool,
    message: String,
}

#[derive(Deserialize)]
struct CheckSchedulesRequest {
    site_id: String,
    #[serde(default)]
    timestamp: Option<u64>,
}

#[derive(Serialize)]
struct CheckSchedulesResponse {
    success: bool,
    triggered_schedules: Vec<TriggeredSchedule>,
    dispatched_actions: Vec<DispatchedAction>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct TriggeredSchedule {
    rule_id: String,
    schedule_type: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    version: String,
}

// Webhook types
#[derive(Deserialize)]
struct CreateWebhookRequest {
    name: String,
    url: String,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    auth_type: Option<WebhookAuthType>,
    #[serde(default)]
    auth_token: Option<String>,
    #[serde(default)]
    events: Option<Vec<WebhookEvent>>,
    #[serde(default)]
    headers: Option<HashMap<String, String>>,
}

#[derive(Deserialize)]
struct WebhookUpdate {
    name: Option<String>,
    url: Option<String>,
    enabled: Option<bool>,
    auth_type: Option<WebhookAuthType>,
    auth_token: Option<String>,
    events: Option<Vec<WebhookEvent>>,
    headers: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
struct WebhooksListResponse {
    webhooks: Vec<WebhookConfig>,
}

#[derive(Serialize)]
struct WebhookResponse {
    success: bool,
    webhook: Option<WebhookConfig>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
struct WebhookTestResponse {
    success: bool,
    status_code: Option<u16>,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

#[derive(Serialize)]
struct WebhookHistoryResponse {
    deliveries: Vec<WebhookDelivery>,
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

async fn validate(Json(req): Json<ValidateRequest>) -> Json<ValidateResponse> {
    match parse(&req.code) {
        Ok(_) => Json(ValidateResponse {
            valid: true,
            error: None,
            error_line: None,
            error_column: None,
        }),
        Err(e) => {
            let (line, column) = extract_error_location(&e);
            Json(ValidateResponse {
                valid: false,
                error: Some(e.to_string()),
                error_line: line,
                error_column: column,
            })
        }
    }
}

async fn compile(Json(req): Json<CompileRequest>) -> Json<CompileResponse> {
    match parse_and_compile(&req.code) {
        Ok(json_str) => {
            let compiled: serde_json::Value = serde_json::from_str(&json_str).unwrap_or_default();
            Json(CompileResponse {
                success: true,
                compiled: Some(compiled),
                error: None,
            })
        }
        Err(e) => Json(CompileResponse {
            success: false,
            compiled: None,
            error: Some(e.to_string()),
        }),
    }
}

async fn store_rules(
    State(state): State<AppState>,
    Json(req): Json<StoreRequest>,
) -> Json<StoreResponse> {
    match parse(&req.code) {
        Ok(program) => {
            let rules_count = program.rules.len();
            let variables_count = program.variables.len();

            // Create runtime with loaded variables
            let mut runtime = Runtime::new();
            runtime.load_variables(&program);

            // Store program and runtime
            {
                let mut programs = state.programs.write().unwrap();
                programs.insert(req.site_id.clone(), program);
            }
            {
                let mut runtimes = state.runtimes.write().unwrap();
                runtimes.insert(req.site_id.clone(), runtime);
            }
            {
                let mut schedulers = state.schedulers.write().unwrap();
                schedulers.insert(req.site_id.clone(), Scheduler::new());
            }

            Json(StoreResponse {
                success: true,
                message: Some(format!(
                    "Stored {} rules and {} variables for site {}",
                    rules_count, variables_count, req.site_id
                )),
                error: None,
                rules_count,
                variables_count,
            })
        }
        Err(e) => Json(StoreResponse {
            success: false,
            message: None,
            error: Some(e.to_string()),
            rules_count: 0,
            variables_count: 0,
        }),
    }
}

async fn evaluate(
    State(state): State<AppState>,
    Json(req): Json<EvaluateRequest>,
) -> Json<EvaluateResponse> {
    let metrics: MetricValues = req.metrics.into();
    let timestamp_ms = req.timestamp_ms.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0)
    });

    // Get program and runtime
    let program = {
        let programs = state.programs.read().unwrap();
        programs.get(&req.site_id).cloned()
    };

    let Some(program) = program else {
        return Json(EvaluateResponse {
            success: false,
            triggered_rules: vec![],
            dispatched_actions: vec![],
            error: Some(format!("No rules stored for site {}", req.site_id)),
        });
    };

    // Get or create runtime
    let results = {
        let mut runtimes = state.runtimes.write().unwrap();
        let runtime = runtimes.entry(req.site_id.clone()).or_insert_with(|| {
            let mut r = Runtime::new();
            r.load_variables(&program);
            r
        });

        // Record history
        runtime.record_history(&metrics, timestamp_ms);

        // Evaluate all rules
        runtime.evaluate_all(&program, &metrics)
    };

    match results {
        Ok(results) => {
            // Create async dispatcher with webhooks
            let webhooks = state.get_webhooks(&req.site_id);
            let dispatcher = async_dispatcher::AsyncDispatcher::new(state.dispatcher_config.clone())
                .with_webhooks(webhooks);

            let mut triggered_rules = vec![];
            let mut dispatched_actions = vec![];

            for result in results {
                if result.triggered {
                    triggered_rules.push(TriggeredRule {
                        rule_id: result.rule_id.clone(),
                        actions_count: result.actions.len(),
                    });

                    // Dispatch actions
                    for action in &result.actions {
                        let dispatch_result = dispatcher.dispatch(action).await;
                        dispatched_actions.push(DispatchedAction {
                            action_type: action_type_name(action),
                            success: dispatch_result.success,
                            message: dispatch_result.message,
                        });
                    }

                    // Also dispatch to configured webhooks
                    let payload = serde_json::json!({
                        "event": "rule_triggered",
                        "rule_id": result.rule_id,
                        "site_id": req.site_id,
                        "timestamp": timestamp_ms,
                    });
                    let deliveries = dispatcher
                        .dispatch_to_webhooks(&WebhookEvent::RuleTriggered, &payload)
                        .await;

                    // Record deliveries
                    for delivery in deliveries {
                        state.record_delivery(&req.site_id, delivery);
                    }
                }
            }

            Json(EvaluateResponse {
                success: true,
                triggered_rules,
                dispatched_actions,
                error: None,
            })
        }
        Err(e) => Json(EvaluateResponse {
            success: false,
            triggered_rules: vec![],
            dispatched_actions: vec![],
            error: Some(e.to_string()),
        }),
    }
}

async fn check_schedules(
    State(state): State<AppState>,
    Json(req): Json<CheckSchedulesRequest>,
) -> Json<CheckSchedulesResponse> {
    let timestamp = req.timestamp.unwrap_or_else(|| {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_secs())
            .unwrap_or(0)
    });
    let now = DateTime::from_timestamp(timestamp);

    // Get program
    let program = {
        let programs = state.programs.read().unwrap();
        programs.get(&req.site_id).cloned()
    };

    let Some(program) = program else {
        return Json(CheckSchedulesResponse {
            success: false,
            triggered_schedules: vec![],
            dispatched_actions: vec![],
            error: Some(format!("No rules stored for site {}", req.site_id)),
        });
    };

    // Get scheduler
    let mut scheduler = {
        let mut schedulers = state.schedulers.write().unwrap();
        schedulers
            .entry(req.site_id.clone())
            .or_insert_with(Scheduler::new)
            .clone()
    };

    let webhooks = state.get_webhooks(&req.site_id);
    let dispatcher = async_dispatcher::AsyncDispatcher::new(state.dispatcher_config.clone())
        .with_webhooks(webhooks);
    let runtime = Runtime::new();
    let metrics = MetricValues::default();

    let mut triggered_schedules = vec![];
    let mut dispatched_actions = vec![];

    // Check each schedule rule
    for rule in &program.rules {
        if let Rule::Schedule(schedule_rule) = rule {
            // Check both calendar schedules and interval schedules
            let should_trigger = match &schedule_rule.schedule {
                Schedule::Interval(_) => scheduler.check_interval(schedule_rule, timestamp),
                _ => scheduler.should_trigger(schedule_rule, &now),
            };

            if should_trigger {
                // Record trigger
                scheduler.record_trigger(&schedule_rule.id, timestamp);

                triggered_schedules.push(TriggeredSchedule {
                    rule_id: schedule_rule.id.clone(),
                    schedule_type: schedule_type_name(&schedule_rule.schedule),
                });

                // Execute actions
                for action in &schedule_rule.actions {
                    let action_result = execute_action(&runtime, action, &metrics);
                    let dispatch_result = dispatcher.dispatch(&action_result).await;
                    dispatched_actions.push(DispatchedAction {
                        action_type: action_type_name(&action_result),
                        success: dispatch_result.success,
                        message: dispatch_result.message,
                    });
                }

                // Dispatch to webhooks
                let payload = serde_json::json!({
                    "event": "schedule_triggered",
                    "rule_id": schedule_rule.id,
                    "site_id": req.site_id,
                    "timestamp": timestamp,
                });
                let deliveries = dispatcher
                    .dispatch_to_webhooks(&WebhookEvent::ScheduleTriggered, &payload)
                    .await;

                for delivery in deliveries {
                    state.record_delivery(&req.site_id, delivery);
                }
            }
        }
    }

    // Update scheduler state
    {
        let mut schedulers = state.schedulers.write().unwrap();
        schedulers.insert(req.site_id.clone(), scheduler);
    }

    Json(CheckSchedulesResponse {
        success: true,
        triggered_schedules,
        dispatched_actions,
        error: None,
    })
}

// ═══════════════════════════════════════════════════════════════════════════
// WEBHOOK HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

async fn list_webhooks(
    State(state): State<AppState>,
    Path(site_id): Path<String>,
) -> Json<WebhooksListResponse> {
    let webhooks = state.get_webhooks(&site_id);
    Json(WebhooksListResponse { webhooks })
}

async fn create_webhook(
    State(state): State<AppState>,
    Path(site_id): Path<String>,
    Json(req): Json<CreateWebhookRequest>,
) -> (StatusCode, Json<WebhookResponse>) {
    let id = format!("wh_{}", uuid_simple());

    let webhook = WebhookConfig {
        id: id.clone(),
        name: req.name,
        url: req.url,
        enabled: req.enabled.unwrap_or(true),
        headers: req.headers.unwrap_or_default(),
        auth_type: req.auth_type.unwrap_or_default(),
        auth_token: req.auth_token,
        events: req.events.unwrap_or_else(|| vec![WebhookEvent::All]),
        last_success: None,
        last_error: None,
        failure_count: 0,
    };

    state.add_webhook(&site_id, webhook.clone());

    (
        StatusCode::CREATED,
        Json(WebhookResponse {
            success: true,
            webhook: Some(webhook),
            error: None,
        }),
    )
}

async fn update_webhook(
    State(state): State<AppState>,
    Path((site_id, webhook_id)): Path<(String, String)>,
    Json(req): Json<WebhookUpdate>,
) -> (StatusCode, Json<WebhookResponse>) {
    match state.update_webhook(&site_id, &webhook_id, req) {
        Some(webhook) => (
            StatusCode::OK,
            Json(WebhookResponse {
                success: true,
                webhook: Some(webhook),
                error: None,
            }),
        ),
        None => (
            StatusCode::NOT_FOUND,
            Json(WebhookResponse {
                success: false,
                webhook: None,
                error: Some(format!("Webhook {} not found", webhook_id)),
            }),
        ),
    }
}

async fn delete_webhook(
    State(state): State<AppState>,
    Path((site_id, webhook_id)): Path<(String, String)>,
) -> (StatusCode, Json<WebhookResponse>) {
    if state.delete_webhook(&site_id, &webhook_id) {
        (
            StatusCode::OK,
            Json(WebhookResponse {
                success: true,
                webhook: None,
                error: None,
            }),
        )
    } else {
        (
            StatusCode::NOT_FOUND,
            Json(WebhookResponse {
                success: false,
                webhook: None,
                error: Some(format!("Webhook {} not found", webhook_id)),
            }),
        )
    }
}

async fn test_webhook_endpoint(
    State(state): State<AppState>,
    Path((site_id, webhook_id)): Path<(String, String)>,
) -> (StatusCode, Json<WebhookTestResponse>) {
    let webhooks = state.get_webhooks(&site_id);
    let webhook = webhooks.iter().find(|w| w.id == webhook_id);

    match webhook {
        Some(wh) => {
            let auth = match (&wh.auth_type, &wh.auth_token) {
                (WebhookAuthType::None, _) => None,
                (auth_type, Some(token)) => Some((auth_type, token.as_str())),
                _ => None,
            };

            let result = async_dispatcher::test_webhook(&wh.url, auth).await;

            (
                if result.success {
                    StatusCode::OK
                } else {
                    StatusCode::BAD_GATEWAY
                },
                Json(WebhookTestResponse {
                    success: result.success,
                    status_code: result.status_code,
                    message: result.message,
                    details: result.details,
                }),
            )
        }
        None => (
            StatusCode::NOT_FOUND,
            Json(WebhookTestResponse {
                success: false,
                status_code: None,
                message: format!("Webhook {} not found", webhook_id),
                details: None,
            }),
        ),
    }
}

async fn get_webhook_history(
    State(state): State<AppState>,
    Path(site_id): Path<String>,
) -> Json<WebhookHistoryResponse> {
    let deliveries = state
        .webhook_history
        .read()
        .unwrap()
        .get(&site_id)
        .cloned()
        .unwrap_or_default();

    Json(WebhookHistoryResponse { deliveries })
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

fn extract_error_location(error: &SELError) -> (Option<usize>, Option<usize>) {
    match error {
        SELError::LexerError { line, column, .. } => (Some(*line), Some(*column)),
        SELError::ParserError { line, column, .. } => (Some(*line), Some(*column)),
        _ => (None, None),
    }
}

fn action_type_name(action: &ActionResult) -> String {
    match action {
        ActionResult::Notify { .. } => "notify".to_string(),
        ActionResult::Webhook { .. } => "webhook".to_string(),
        ActionResult::Log { .. } => "log".to_string(),
        ActionResult::Skipped { .. } => "skipped".to_string(),
    }
}

fn schedule_type_name(schedule: &Schedule) -> String {
    match schedule {
        Schedule::Calendar(cal) => format!("{:?}", cal.frequency).to_lowercase(),
        Schedule::Interval(_) => "interval".to_string(),
        Schedule::Cron(_) => "cron".to_string(),
    }
}

fn execute_action(_runtime: &Runtime, action: &Action, _metrics: &MetricValues) -> ActionResult {
    match action {
        Action::Notify(notify) => {
            let message = render_simple_template(&notify.message);
            ActionResult::Notify { message }
        }
        Action::Webhook(webhook) => ActionResult::Webhook {
            url: webhook.url.clone(),
            body: webhook
                .body
                .as_ref()
                .map(|t| render_simple_template(t))
                .unwrap_or_else(|| "{}".to_string()),
        },
        Action::Log(log) => ActionResult::Log {
            message: render_simple_template(&log.message),
        },
        Action::SetVariable(_) => ActionResult::Skipped {
            reason: "SetVariable not supported".to_string(),
        },
    }
}

fn render_simple_template(template: &TemplateString) -> String {
    let mut result = String::new();
    for part in &template.parts {
        match part {
            TemplatePart::Text { text } => result.push_str(text),
            TemplatePart::Expression { .. } => result.push_str("{?}"),
        }
    }
    result
}

/// Generate a simple unique ID (not cryptographically secure)
fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    format!("{:x}", now)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "sel_server=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let state = AppState::new();

    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        // Core SEL endpoints
        .route("/api/health", get(health))
        .route("/api/validate", post(validate))
        .route("/api/compile", post(compile))
        .route("/api/rules", post(store_rules))
        .route("/api/evaluate", post(evaluate))
        .route("/api/schedules/check", post(check_schedules))
        // Webhook endpoints
        .route("/api/webhooks/{site_id}", get(list_webhooks))
        .route("/api/webhooks/{site_id}", post(create_webhook))
        .route("/api/webhooks/{site_id}/{webhook_id}", put(update_webhook))
        .route("/api/webhooks/{site_id}/{webhook_id}", delete(delete_webhook))
        .route("/api/webhooks/{site_id}/{webhook_id}/test", post(test_webhook_endpoint))
        .route("/api/webhooks/{site_id}/history", get(get_webhook_history))
        .layer(cors)
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "3030".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("SEL Server starting on {}", addr);
    tracing::info!("API endpoints:");
    tracing::info!("  GET  /api/health                      - Health check");
    tracing::info!("  POST /api/validate                    - Validate SEL code");
    tracing::info!("  POST /api/compile                     - Compile SEL to JSON");
    tracing::info!("  POST /api/rules                       - Store rules for a site");
    tracing::info!("  POST /api/evaluate                    - Evaluate rules against metrics");
    tracing::info!("  POST /api/schedules/check             - Check scheduled rules");
    tracing::info!("  GET  /api/webhooks/:site_id           - List webhooks");
    tracing::info!("  POST /api/webhooks/:site_id           - Create webhook");
    tracing::info!("  PUT  /api/webhooks/:site_id/:id       - Update webhook");
    tracing::info!("  DELETE /api/webhooks/:site_id/:id     - Delete webhook");
    tracing::info!("  POST /api/webhooks/:site_id/:id/test  - Test webhook");
    tracing::info!("  GET  /api/webhooks/:site_id/history   - Get delivery history");

    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
