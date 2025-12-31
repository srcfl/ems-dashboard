// SEL Backend API Client
// Connects to the Rust SEL server

const SEL_API_URL = import.meta.env.VITE_SEL_API_URL || 'http://localhost:3030';

export interface ValidateResponse {
  valid: boolean;
  error?: string;
  error_line?: number;
  error_column?: number;
}

export interface CompileResponse {
  success: boolean;
  compiled?: {
    version: string;
    compiled_at: string;
    checksum: string;
    variables: Array<{
      name: string;
      value: number;
      original: unknown;
    }>;
    rules: Array<{
      id: string;
      name?: string;
      rule_type: {
        type: 'Event' | 'Schedule';
        condition?: unknown;
        schedule?: unknown;
      };
      enabled: boolean;
      actions: Array<{
        action_type: string;
        config: unknown;
        template_vars: string[];
      }>;
      cooldown_seconds?: number;
    }>;
    required_metrics: string[];
    requires_history: boolean;
    max_history_seconds?: number;
  };
  error?: string;
}

export interface StoreResponse {
  success: boolean;
  message?: string;
  error?: string;
  rules_count: number;
  variables_count: number;
}

export interface EvaluateResponse {
  success: boolean;
  triggered_rules: Array<{
    rule_id: string;
    actions_count: number;
  }>;
  dispatched_actions: Array<{
    action_type: string;
    success: boolean;
    message: string;
  }>;
  error?: string;
}

export interface CheckSchedulesResponse {
  success: boolean;
  triggered_schedules: Array<{
    rule_id: string;
    schedule_type: string;
  }>;
  dispatched_actions: Array<{
    action_type: string;
    success: boolean;
    message: string;
  }>;
  error?: string;
}

export interface MetricsInput {
  pv_power?: number;
  battery_power?: number;
  battery_soc?: number;
  grid_power?: number;
  grid_import?: number;
  grid_export?: number;
  load_power?: number;
}

// Webhook types
export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  headers: Record<string, string>;
  auth_type: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_token?: string;
  events: string[];
  last_success?: number;
  last_error?: string;
  failure_count: number;
}

export interface WebhookDelivery {
  webhook_id: string;
  timestamp: number;
  url: string;
  request_body: string;
  response_status?: number;
  response_body?: string;
  success: boolean;
  error?: string;
  duration_ms: number;
}

export interface WebhooksListResponse {
  webhooks: WebhookConfig[];
}

export interface WebhookResponse {
  success: boolean;
  webhook?: WebhookConfig;
  error?: string;
}

export interface WebhookTestResponse {
  success: boolean;
  status_code?: number;
  message: string;
  details?: string;
}

export interface WebhookHistoryResponse {
  deliveries: WebhookDelivery[];
}

export interface CreateWebhookRequest {
  name: string;
  url: string;
  enabled?: boolean;
  auth_type?: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_token?: string;
  events?: string[];
  headers?: Record<string, string>;
}

export interface UpdateWebhookRequest {
  name?: string;
  url?: string;
  enabled?: boolean;
  auth_type?: 'none' | 'bearer' | 'basic' | 'api_key';
  auth_token?: string;
  events?: string[];
  headers?: Record<string, string>;
}

class SELClient {
  private baseUrl: string;

  constructor(baseUrl: string = SEL_API_URL) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`SEL API error: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Check if the SEL server is available
   */
  async health(): Promise<{ status: string; version: string }> {
    try {
      return await this.fetch('/api/health');
    } catch {
      return { status: 'unavailable', version: 'unknown' };
    }
  }

  /**
   * Validate SEL code
   */
  async validate(code: string): Promise<ValidateResponse> {
    return this.fetch('/api/validate', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /**
   * Compile SEL code to JSON
   */
  async compile(code: string): Promise<CompileResponse> {
    return this.fetch('/api/compile', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  /**
   * Store rules for a site
   */
  async storeRules(siteId: string, code: string): Promise<StoreResponse> {
    return this.fetch('/api/rules', {
      method: 'POST',
      body: JSON.stringify({ site_id: siteId, code }),
    });
  }

  /**
   * Evaluate rules against current metrics
   */
  async evaluate(siteId: string, metrics: MetricsInput): Promise<EvaluateResponse> {
    return this.fetch('/api/evaluate', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        metrics,
        timestamp_ms: Date.now(),
      }),
    });
  }

  /**
   * Check and trigger scheduled rules
   */
  async checkSchedules(siteId: string): Promise<CheckSchedulesResponse> {
    return this.fetch('/api/schedules/check', {
      method: 'POST',
      body: JSON.stringify({
        site_id: siteId,
        timestamp: Math.floor(Date.now() / 1000),
      }),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // WEBHOOK ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * List webhooks for a site
   */
  async listWebhooks(siteId: string): Promise<WebhooksListResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}`);
  }

  /**
   * Create a new webhook
   */
  async createWebhook(siteId: string, webhook: CreateWebhookRequest): Promise<WebhookResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}`, {
      method: 'POST',
      body: JSON.stringify(webhook),
    });
  }

  /**
   * Update a webhook
   */
  async updateWebhook(
    siteId: string,
    webhookId: string,
    update: UpdateWebhookRequest
  ): Promise<WebhookResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}/${encodeURIComponent(webhookId)}`, {
      method: 'PUT',
      body: JSON.stringify(update),
    });
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(siteId: string, webhookId: string): Promise<WebhookResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}/${encodeURIComponent(webhookId)}`, {
      method: 'DELETE',
    });
  }

  /**
   * Test a webhook
   */
  async testWebhook(siteId: string, webhookId: string): Promise<WebhookTestResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}/${encodeURIComponent(webhookId)}/test`, {
      method: 'POST',
    });
  }

  /**
   * Get webhook delivery history
   */
  async getWebhookHistory(siteId: string): Promise<WebhookHistoryResponse> {
    return this.fetch(`/api/webhooks/${encodeURIComponent(siteId)}/history`);
  }
}

// Singleton instance
export const selClient = new SELClient();

// Check if backend is available
export async function isBackendAvailable(): Promise<boolean> {
  const health = await selClient.health();
  return health.status === 'ok';
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVENIENCE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const listWebhooks = (siteId: string) => selClient.listWebhooks(siteId);
export const createWebhook = (siteId: string, webhook: CreateWebhookRequest) =>
  selClient.createWebhook(siteId, webhook);
export const updateWebhook = (siteId: string, webhookId: string, update: UpdateWebhookRequest) =>
  selClient.updateWebhook(siteId, webhookId, update);
export const deleteWebhook = (siteId: string, webhookId: string) =>
  selClient.deleteWebhook(siteId, webhookId);
export const testWebhook = (siteId: string, webhookId: string) =>
  selClient.testWebhook(siteId, webhookId);
export const getWebhookHistory = (siteId: string) => selClient.getWebhookHistory(siteId);
