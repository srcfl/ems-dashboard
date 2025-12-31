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
}

// Singleton instance
export const selClient = new SELClient();

// Check if backend is available
export async function isBackendAvailable(): Promise<boolean> {
  const health = await selClient.health();
  return health.status === 'ok';
}
