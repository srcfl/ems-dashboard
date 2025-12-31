//! SEL Action Dispatcher
//!
//! Dispatches actions to external services (notifications, webhooks, etc.)

use std::collections::HashMap;
use serde::{Deserialize, Serialize};

use crate::runtime::ActionResult;

/// Configuration for notification channels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatcherConfig {
    /// Telegram bot token
    pub telegram_bot_token: Option<String>,
    /// Telegram chat ID for notifications
    pub telegram_chat_id: Option<String>,
    /// Default webhook headers
    pub webhook_headers: HashMap<String, String>,
    /// Enable dry-run mode (log instead of send)
    pub dry_run: bool,
}

impl Default for DispatcherConfig {
    fn default() -> Self {
        Self {
            telegram_bot_token: None,
            telegram_chat_id: None,
            webhook_headers: HashMap::new(),
            dry_run: false,
        }
    }
}

/// Webhook configuration for a site
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: bool,
    #[serde(default)]
    pub headers: HashMap<String, String>,
    #[serde(default)]
    pub auth_type: WebhookAuthType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth_token: Option<String>,
    /// Events this webhook subscribes to
    #[serde(default)]
    pub events: Vec<WebhookEvent>,
    /// Last successful delivery timestamp
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_success: Option<u64>,
    /// Last failure message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
    /// Consecutive failures count
    #[serde(default)]
    pub failure_count: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WebhookAuthType {
    #[default]
    None,
    Bearer,
    Basic,
    ApiKey,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WebhookEvent {
    RuleTriggered,
    ScheduleTriggered,
    AlertHigh,
    AlertLow,
    All,
}

impl WebhookConfig {
    pub fn new(id: impl Into<String>, name: impl Into<String>, url: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            url: url.into(),
            enabled: true,
            headers: HashMap::new(),
            auth_type: WebhookAuthType::None,
            auth_token: None,
            events: vec![WebhookEvent::All],
            last_success: None,
            last_error: None,
            failure_count: 0,
        }
    }

    pub fn with_bearer_auth(mut self, token: impl Into<String>) -> Self {
        self.auth_type = WebhookAuthType::Bearer;
        self.auth_token = Some(token.into());
        self
    }

    pub fn with_events(mut self, events: Vec<WebhookEvent>) -> Self {
        self.events = events;
        self
    }
}

/// Result of dispatching an action
#[derive(Debug, Clone, Serialize)]
pub struct DispatchResult {
    pub success: bool,
    pub message: String,
    pub details: Option<String>,
    pub status_code: Option<u16>,
}

impl DispatchResult {
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            details: None,
            status_code: Some(200),
        }
    }

    pub fn failure(message: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            details: Some(details.into()),
            status_code: None,
        }
    }

    pub fn skipped(reason: impl Into<String>) -> Self {
        Self {
            success: true,
            message: format!("Skipped: {}", reason.into()),
            details: None,
            status_code: None,
        }
    }

    pub fn with_status(mut self, code: u16) -> Self {
        self.status_code = Some(code);
        self
    }
}

/// Webhook delivery record for history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookDelivery {
    pub webhook_id: String,
    pub timestamp: u64,
    pub url: String,
    pub request_body: String,
    pub response_status: Option<u16>,
    pub response_body: Option<String>,
    pub success: bool,
    pub error: Option<String>,
    pub duration_ms: u64,
}

/// The action dispatcher (sync version for non-server use)
pub struct Dispatcher {
    config: DispatcherConfig,
}

impl Dispatcher {
    pub fn new(config: DispatcherConfig) -> Self {
        Self { config }
    }

    /// Dispatch an action (sync version - logs only, for testing)
    pub fn dispatch(&self, action: &ActionResult) -> DispatchResult {
        if self.config.dry_run {
            return self.dry_run_dispatch(action);
        }

        match action {
            ActionResult::Notify { message } => {
                println!("[SEL NOTIFY] {}", message);
                DispatchResult::success(format!("Notified: {}", message))
            }
            ActionResult::Webhook { url, body } => {
                println!("[SEL WEBHOOK] {} -> {}", url, body);
                DispatchResult::success(format!("Webhook queued: {}", url))
            }
            ActionResult::Log { message } => {
                println!("[SEL LOG] {}", message);
                DispatchResult::success(format!("Logged: {}", message))
            }
            ActionResult::Skipped { reason } => DispatchResult::skipped(reason),
        }
    }

    /// Dispatch multiple actions
    pub fn dispatch_all(&self, actions: &[ActionResult]) -> Vec<DispatchResult> {
        actions.iter().map(|a| self.dispatch(a)).collect()
    }

    fn dry_run_dispatch(&self, action: &ActionResult) -> DispatchResult {
        match action {
            ActionResult::Notify { message } => {
                println!("[DRY RUN] NOTIFY: {}", message);
                DispatchResult::success(format!("[DRY RUN] Would notify: {}", message))
            }
            ActionResult::Webhook { url, body } => {
                println!("[DRY RUN] WEBHOOK: {} -> {}", url, body);
                DispatchResult::success(format!("[DRY RUN] Would call webhook: {}", url))
            }
            ActionResult::Log { message } => {
                println!("[DRY RUN] LOG: {}", message);
                DispatchResult::success(format!("[DRY RUN] Would log: {}", message))
            }
            ActionResult::Skipped { reason } => DispatchResult::skipped(reason),
        }
    }
}

impl Default for Dispatcher {
    fn default() -> Self {
        Self::new(DispatcherConfig::default())
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC DISPATCHER (server feature)
// ═══════════════════════════════════════════════════════════════════════════

#[cfg(feature = "server")]
pub mod async_dispatcher {
    use super::*;
    use reqwest::Client;
    use std::time::Instant;

    /// Async dispatcher with real HTTP support
    pub struct AsyncDispatcher {
        config: DispatcherConfig,
        client: Client,
        webhooks: Vec<WebhookConfig>,
    }

    impl AsyncDispatcher {
        pub fn new(config: DispatcherConfig) -> Self {
            Self {
                config,
                client: Client::builder()
                    .timeout(std::time::Duration::from_secs(30))
                    .build()
                    .expect("Failed to create HTTP client"),
                webhooks: Vec::new(),
            }
        }

        pub fn with_webhooks(mut self, webhooks: Vec<WebhookConfig>) -> Self {
            self.webhooks = webhooks;
            self
        }

        pub fn add_webhook(&mut self, webhook: WebhookConfig) {
            self.webhooks.push(webhook);
        }

        pub fn remove_webhook(&mut self, webhook_id: &str) {
            self.webhooks.retain(|w| w.id != webhook_id);
        }

        pub fn get_webhooks(&self) -> &[WebhookConfig] {
            &self.webhooks
        }

        /// Dispatch an action asynchronously
        pub async fn dispatch(&self, action: &ActionResult) -> DispatchResult {
            if self.config.dry_run {
                return self.dry_run_dispatch(action);
            }

            match action {
                ActionResult::Notify { message } => self.dispatch_notify(message).await,
                ActionResult::Webhook { url, body } => self.dispatch_webhook(url, body).await,
                ActionResult::Log { message } => self.dispatch_log(message),
                ActionResult::Skipped { reason } => DispatchResult::skipped(reason),
            }
        }

        /// Dispatch to all configured webhooks
        pub async fn dispatch_to_webhooks(
            &self,
            event: &WebhookEvent,
            payload: &serde_json::Value,
        ) -> Vec<WebhookDelivery> {
            let mut deliveries = Vec::new();
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);

            for webhook in &self.webhooks {
                if !webhook.enabled {
                    continue;
                }

                // Check if webhook subscribes to this event
                let subscribed = webhook.events.iter().any(|e| {
                    *e == WebhookEvent::All || *e == *event
                });

                if !subscribed {
                    continue;
                }

                let body = serde_json::to_string(payload).unwrap_or_default();
                let start = Instant::now();

                let delivery = self.send_webhook_request(webhook, &body, timestamp).await;
                let duration_ms = start.elapsed().as_millis() as u64;

                deliveries.push(WebhookDelivery {
                    webhook_id: webhook.id.clone(),
                    timestamp,
                    url: webhook.url.clone(),
                    request_body: body,
                    response_status: delivery.status_code,
                    response_body: delivery.details.clone(),
                    success: delivery.success,
                    error: if delivery.success { None } else { Some(delivery.message.clone()) },
                    duration_ms,
                });
            }

            deliveries
        }

        async fn send_webhook_request(
            &self,
            webhook: &WebhookConfig,
            body: &str,
            _timestamp: u64,
        ) -> DispatchResult {
            let mut request = self.client
                .post(&webhook.url)
                .header("Content-Type", "application/json")
                .header("User-Agent", "SEL-Server/0.1.0");

            // Add auth header
            match (&webhook.auth_type, &webhook.auth_token) {
                (WebhookAuthType::Bearer, Some(token)) => {
                    request = request.header("Authorization", format!("Bearer {}", token));
                }
                (WebhookAuthType::Basic, Some(token)) => {
                    request = request.header("Authorization", format!("Basic {}", token));
                }
                (WebhookAuthType::ApiKey, Some(token)) => {
                    request = request.header("X-API-Key", token);
                }
                _ => {}
            }

            // Add custom headers
            for (key, value) in &webhook.headers {
                request = request.header(key, value);
            }

            // Send request
            match request.body(body.to_string()).send().await {
                Ok(response) => {
                    let status = response.status().as_u16();
                    let response_body = response.text().await.ok();

                    if status >= 200 && status < 300 {
                        DispatchResult::success(format!("Webhook delivered to {}", webhook.url))
                            .with_status(status)
                    } else {
                        DispatchResult::failure(
                            format!("Webhook failed: HTTP {}", status),
                            response_body.unwrap_or_default(),
                        ).with_status(status)
                    }
                }
                Err(e) => {
                    DispatchResult::failure(
                        format!("Webhook error: {}", webhook.url),
                        e.to_string(),
                    )
                }
            }
        }

        async fn dispatch_notify(&self, message: &str) -> DispatchResult {
            // Try Telegram first
            if let (Some(token), Some(chat_id)) = (
                &self.config.telegram_bot_token,
                &self.config.telegram_chat_id,
            ) {
                return self.send_telegram(token, chat_id, message).await;
            }

            // Fall back to logging
            self.dispatch_log(message)
        }

        async fn send_telegram(&self, token: &str, chat_id: &str, message: &str) -> DispatchResult {
            let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
            let body = serde_json::json!({
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "HTML"
            });

            match self.client.post(&url).json(&body).send().await {
                Ok(response) => {
                    let status = response.status().as_u16();
                    if status == 200 {
                        DispatchResult::success(format!("Sent to Telegram: {}", message))
                            .with_status(status)
                    } else {
                        let body = response.text().await.unwrap_or_default();
                        DispatchResult::failure(
                            "Telegram send failed",
                            format!("Status: {}, Body: {}", status, body),
                        ).with_status(status)
                    }
                }
                Err(e) => DispatchResult::failure("Telegram request failed", e.to_string()),
            }
        }

        async fn dispatch_webhook(&self, url: &str, body: &str) -> DispatchResult {
            let mut request = self.client
                .post(url)
                .header("Content-Type", "application/json");

            // Add default headers
            for (key, value) in &self.config.webhook_headers {
                request = request.header(key, value);
            }

            match request.body(body.to_string()).send().await {
                Ok(response) => {
                    let status = response.status().as_u16();
                    if status >= 200 && status < 300 {
                        DispatchResult::success(format!("Webhook called: {}", url))
                            .with_status(status)
                    } else {
                        DispatchResult::failure(
                            format!("Webhook failed: {}", url),
                            format!("Status: {}", status),
                        ).with_status(status)
                    }
                }
                Err(e) => DispatchResult::failure(format!("Webhook error: {}", url), e.to_string()),
            }
        }

        fn dispatch_log(&self, message: &str) -> DispatchResult {
            #[cfg(feature = "server")]
            tracing::info!("[SEL LOG] {}", message);

            #[cfg(not(feature = "server"))]
            println!("[SEL LOG] {}", message);

            DispatchResult::success(format!("Logged: {}", message))
        }

        fn dry_run_dispatch(&self, action: &ActionResult) -> DispatchResult {
            match action {
                ActionResult::Notify { message } => {
                    println!("[DRY RUN] NOTIFY: {}", message);
                    DispatchResult::success(format!("[DRY RUN] Would notify: {}", message))
                }
                ActionResult::Webhook { url, body } => {
                    println!("[DRY RUN] WEBHOOK: {} -> {}", url, body);
                    DispatchResult::success(format!("[DRY RUN] Would call webhook: {}", url))
                }
                ActionResult::Log { message } => {
                    println!("[DRY RUN] LOG: {}", message);
                    DispatchResult::success(format!("[DRY RUN] Would log: {}", message))
                }
                ActionResult::Skipped { reason } => DispatchResult::skipped(reason),
            }
        }
    }

    /// Test a webhook endpoint
    pub async fn test_webhook(url: &str, auth: Option<(&WebhookAuthType, &str)>) -> DispatchResult {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .expect("Failed to create HTTP client");

        let test_payload = serde_json::json!({
            "event": "test",
            "message": "This is a test webhook from SEL",
            "timestamp": std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0)
        });

        let mut request = client
            .post(url)
            .header("Content-Type", "application/json")
            .header("User-Agent", "SEL-Server/0.1.0");

        // Add auth if provided
        if let Some((auth_type, token)) = auth {
            match auth_type {
                WebhookAuthType::Bearer => {
                    request = request.header("Authorization", format!("Bearer {}", token));
                }
                WebhookAuthType::Basic => {
                    request = request.header("Authorization", format!("Basic {}", token));
                }
                WebhookAuthType::ApiKey => {
                    request = request.header("X-API-Key", token);
                }
                WebhookAuthType::None => {}
            }
        }

        match request.json(&test_payload).send().await {
            Ok(response) => {
                let status = response.status().as_u16();
                let body = response.text().await.ok();

                if status >= 200 && status < 300 {
                    DispatchResult::success(format!("Test successful! Status: {}", status))
                        .with_status(status)
                } else {
                    DispatchResult::failure(
                        format!("Test failed: HTTP {}", status),
                        body.unwrap_or_default(),
                    ).with_status(status)
                }
            }
            Err(e) => DispatchResult::failure("Connection failed", e.to_string()),
        }
    }
}

/// Builder for dispatcher configuration
pub struct DispatcherBuilder {
    config: DispatcherConfig,
}

impl DispatcherBuilder {
    pub fn new() -> Self {
        Self {
            config: DispatcherConfig::default(),
        }
    }

    pub fn telegram(mut self, bot_token: impl Into<String>, chat_id: impl Into<String>) -> Self {
        self.config.telegram_bot_token = Some(bot_token.into());
        self.config.telegram_chat_id = Some(chat_id.into());
        self
    }

    pub fn webhook_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.config.webhook_headers.insert(key.into(), value.into());
        self
    }

    pub fn dry_run(mut self, enabled: bool) -> Self {
        self.config.dry_run = enabled;
        self
    }

    pub fn build(self) -> Dispatcher {
        Dispatcher::new(self.config)
    }

    #[cfg(feature = "server")]
    pub fn build_async(self) -> async_dispatcher::AsyncDispatcher {
        async_dispatcher::AsyncDispatcher::new(self.config)
    }
}

impl Default for DispatcherBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatch_result_success() {
        let result = DispatchResult::success("Test message");
        assert!(result.success);
        assert!(result.details.is_none());
    }

    #[test]
    fn test_dispatch_result_failure() {
        let result = DispatchResult::failure("Failed", "Details here");
        assert!(!result.success);
        assert!(result.details.is_some());
    }

    #[test]
    fn test_dry_run_notify() {
        let dispatcher = DispatcherBuilder::new().dry_run(true).build();

        let action = ActionResult::Notify {
            message: "Test notification".to_string(),
        };

        let result = dispatcher.dispatch(&action);
        assert!(result.success);
        assert!(result.message.contains("DRY RUN"));
    }

    #[test]
    fn test_webhook_config() {
        let webhook = WebhookConfig::new("wh1", "Test Webhook", "https://example.com/hook")
            .with_bearer_auth("secret-token")
            .with_events(vec![WebhookEvent::RuleTriggered, WebhookEvent::AlertHigh]);

        assert_eq!(webhook.id, "wh1");
        assert_eq!(webhook.auth_type, WebhookAuthType::Bearer);
        assert_eq!(webhook.events.len(), 2);
    }

    #[test]
    fn test_skipped_action() {
        let dispatcher = Dispatcher::default();

        let action = ActionResult::Skipped {
            reason: "Test skip".to_string(),
        };

        let result = dispatcher.dispatch(&action);
        assert!(result.success);
        assert!(result.message.contains("Skipped"));
    }
}
