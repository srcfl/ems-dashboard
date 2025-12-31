//! SEL Action Dispatcher
//!
//! Dispatches actions to external services (notifications, webhooks, etc.)

use std::collections::HashMap;

use crate::runtime::ActionResult;

/// Configuration for notification channels
#[derive(Debug, Clone)]
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

/// Result of dispatching an action
#[derive(Debug, Clone)]
pub struct DispatchResult {
    pub success: bool,
    pub message: String,
    pub details: Option<String>,
}

impl DispatchResult {
    pub fn success(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
            details: None,
        }
    }

    pub fn failure(message: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
            details: Some(details.into()),
        }
    }

    pub fn skipped(reason: impl Into<String>) -> Self {
        Self {
            success: true,
            message: format!("Skipped: {}", reason.into()),
            details: None,
        }
    }
}

/// The action dispatcher
pub struct Dispatcher {
    config: DispatcherConfig,
    /// HTTP client (placeholder - implement with reqwest or similar)
    #[allow(dead_code)]
    client: HttpClient,
}

/// Placeholder HTTP client - replace with real implementation
struct HttpClient;

impl HttpClient {
    fn new() -> Self {
        HttpClient
    }

    /// Send an HTTP POST request
    fn post(&self, url: &str, body: &str, headers: &HashMap<String, String>) -> Result<HttpResponse, String> {
        // Placeholder implementation
        // In production, use reqwest or similar
        let _ = (url, body, headers);
        Ok(HttpResponse {
            status: 200,
            body: "{}".to_string(),
        })
    }

    /// Send an HTTP GET request (for future use)
    #[allow(dead_code)]
    fn get(&self, url: &str, headers: &HashMap<String, String>) -> Result<HttpResponse, String> {
        let _ = (url, headers);
        Ok(HttpResponse {
            status: 200,
            body: "{}".to_string(),
        })
    }
}

struct HttpResponse {
    status: u16,
    body: String,
}

impl Dispatcher {
    pub fn new(config: DispatcherConfig) -> Self {
        Self {
            config,
            client: HttpClient::new(),
        }
    }

    /// Dispatch an action result
    pub fn dispatch(&self, action: &ActionResult) -> DispatchResult {
        if self.config.dry_run {
            return self.dry_run_dispatch(action);
        }

        match action {
            ActionResult::Notify { message } => self.dispatch_notify(message),
            ActionResult::Webhook { url, body } => self.dispatch_webhook(url, body),
            ActionResult::Log { message } => self.dispatch_log(message),
            ActionResult::Skipped { reason } => DispatchResult::skipped(reason),
        }
    }

    /// Dispatch multiple actions
    pub fn dispatch_all(&self, actions: &[ActionResult]) -> Vec<DispatchResult> {
        actions.iter().map(|a| self.dispatch(a)).collect()
    }

    fn dispatch_notify(&self, message: &str) -> DispatchResult {
        // Try Telegram first
        if let (Some(token), Some(chat_id)) = (&self.config.telegram_bot_token, &self.config.telegram_chat_id) {
            return self.send_telegram(token, chat_id, message);
        }

        // Fall back to logging
        self.dispatch_log(message)
    }

    fn send_telegram(&self, token: &str, chat_id: &str, message: &str) -> DispatchResult {
        let url = format!("https://api.telegram.org/bot{}/sendMessage", token);
        let body = serde_json::json!({
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML"
        })
        .to_string();

        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        match self.client.post(&url, &body, &headers) {
            Ok(response) => {
                if response.status == 200 {
                    DispatchResult::success(format!("Sent to Telegram: {}", message))
                } else {
                    DispatchResult::failure(
                        "Telegram send failed",
                        format!("Status: {}, Body: {}", response.status, response.body),
                    )
                }
            }
            Err(e) => DispatchResult::failure("Telegram request failed", e),
        }
    }

    fn dispatch_webhook(&self, url: &str, body: &str) -> DispatchResult {
        let mut headers = self.config.webhook_headers.clone();
        if !headers.contains_key("Content-Type") {
            headers.insert("Content-Type".to_string(), "application/json".to_string());
        }

        match self.client.post(url, body, &headers) {
            Ok(response) => {
                if response.status >= 200 && response.status < 300 {
                    DispatchResult::success(format!("Webhook called: {}", url))
                } else {
                    DispatchResult::failure(
                        format!("Webhook failed: {}", url),
                        format!("Status: {}", response.status),
                    )
                }
            }
            Err(e) => DispatchResult::failure(format!("Webhook error: {}", url), e),
        }
    }

    fn dispatch_log(&self, message: &str) -> DispatchResult {
        // In production, this would write to a proper logging system
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

impl Default for Dispatcher {
    fn default() -> Self {
        Self::new(DispatcherConfig::default())
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
        let dispatcher = DispatcherBuilder::new()
            .dry_run(true)
            .build();

        let action = ActionResult::Notify {
            message: "Test notification".to_string(),
        };

        let result = dispatcher.dispatch(&action);
        assert!(result.success);
        assert!(result.message.contains("DRY RUN"));
    }

    #[test]
    fn test_dry_run_webhook() {
        let dispatcher = DispatcherBuilder::new()
            .dry_run(true)
            .build();

        let action = ActionResult::Webhook {
            url: "https://example.com/webhook".to_string(),
            body: "{}".to_string(),
        };

        let result = dispatcher.dispatch(&action);
        assert!(result.success);
        assert!(result.message.contains("DRY RUN"));
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

    #[test]
    fn test_dispatch_all() {
        let dispatcher = DispatcherBuilder::new()
            .dry_run(true)
            .build();

        let actions = vec![
            ActionResult::Notify { message: "Message 1".to_string() },
            ActionResult::Notify { message: "Message 2".to_string() },
        ];

        let results = dispatcher.dispatch_all(&actions);
        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|r| r.success));
    }
}
