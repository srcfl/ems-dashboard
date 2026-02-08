// EMS Manager API Types
// Matches the actual Manager API response shapes

// ── Sites ─────────────────────────────────────────────────────────────

export interface EMSSiteListItem {
  site_id: string;
  wallet_id: string;
  active: boolean;
  paused: boolean;
  connected: boolean;
  price_area: string;
  optimization_interval_seconds: number;
  control_frequency_seconds: number;
  fuse_size: number | null;
  max_power_w: number | null;
  last_optimization_at: string | null;
  solver_status: string | null;
}

export interface EMSSitesListResponse {
  items: EMSSiteListItem[];
  total: number;
  errors: string[];
}

export interface OptimizerPriceConfig {
  price_area: string;
  import_fixed_price_addition: number | number[];
  import_price_multiplier: number | number[];
  export_fixed_price_addition: number | number[];
  export_price_multiplier: number | number[];
}

export interface DERGoal {
  der_id: string;
  target_power: number;
  weight: number;
}

export interface DERTarget {
  power_w: number;
  upper_limit_w: number[];
  lower_limit_w: number[];
}

export interface EMSDERResponse {
  der_id: string;
  type: 'battery' | 'bt' | 'pv' | 'v2x' | 'ev_charger' | 'meter' | 'em';
  capacity_wh: number | null;
  capacity_w: number | null;
  max_power_w: number | null;
  max_charge_power_w: number | null;
  max_discharge_power_w: number | null;
  min_soc_percent: number | null;
  max_soc_percent: number | null;
  goal_power_override_w: number | null;
  power_w: number | null;
  soc: number | null;
  last_update: number | null;
  goal: DERGoal | null;
  target: DERTarget | null;
}

export interface EMSSiteDetail {
  site_id: string;
  wallet_id: string;
  active: boolean;
  price_area: string;
  optimizer_price: OptimizerPriceConfig;
  optimization_interval_seconds: number;
  horizon_steps: number;
  site_power_limit_w: number;
  daily_energy_consumption_wh: number;
  paused: boolean;
  connected: boolean;
  control_frequency_seconds: number;
  fuse_size: number | null;
  intra_phase_potential: number;
  max_power_w: number | null;
  max_power_calculated_w: number | null;
  max_power_overridden: boolean;
  grid_target_power_w: number;
  grid_tolerance_w: number;
  ders: {
    controller: EMSDERResponse[];
    optimizer: EMSDERResponse[];
  };
  solver_status: string | null;
  last_optimization_at: string | null;
  last_control_loop_at: number | null;
  last_control_output_at: number | null;
  optimizer_available: boolean;
  core_control_available: boolean;
  errors: string[];
}

// ── Status ────────────────────────────────────────────────────────────

export interface EMSOptimizationStatus {
  last_run_at: string | null;
  solver_status: 'success' | 'failed' | 'infeasible' | null;
  objective_value: number | null;
  message: string | null;
  trigger_source: 'scheduled' | 'manual' | null;
}

export interface EMSControlStatus {
  paused: boolean;
  connected: boolean;
  last_loop_at: number | null;
  last_output_at: number | null;
  grid_target_power_w: number;
  grid_tolerance_w: number;
}

export interface EMSCombinedStatus {
  site_id: string;
  overall_health: 'healthy' | 'degraded' | 'unhealthy';
  optimization: EMSOptimizationStatus;
  control: EMSControlStatus;
  errors: string[];
}

// ── Schedule ──────────────────────────────────────────────────────────

export type EMSMode = 'IDLE' | 'SELF_CONSUMPTION' | 'FORCE_CHARGE' | 'FORCE_DISCHARGE';

export interface EMSSlotDERData {
  p: number;      // Power setpoint (W)
  w: number;      // Weight/priority
  soc: number;    // State of charge (%)
}

// Verbose slot from Manager API - price/load/prod are under `sig`
export interface EMSScheduleSlot {
  t: number;                              // Time slot index
  sig: {
    pr: number;                           // Import price (SEK/kWh)
    epr: number;                          // Export price (SEK/kWh)
    ld: number;                           // Load forecast (W)
    prod: number;                         // Production forecast (W)
    il: number;                           // Import limit (W)
    el: number;                           // Export limit (W)
  };
  m: EMSMode;                             // Mode
  gil: number;                            // Grid import limit (W)
  gel: number;                            // Grid export limit (W)
  sg: {
    tgp: number;                          // Target grid power (W)
    gt: number;                           // Grid tolerance (W)
  };
  dg: Record<string, EMSSlotDERData>;     // Per-DER data
}

export interface EMSScheduleCompact {
  st: string;       // Start time
  dt: number;       // Delta time (seconds per slot)
  n: number;        // Number of slots
  m: EMSMode[];
  pr: number[];
  gil: number[];
  gel: number[];
  sg: { tgp: number[]; gt: number[] };
  dg: Record<string, { p: number[]; w: number[]; soc: number[] }>;
}

export interface EMSScheduleVerbose {
  st: string;
  dt: number;
  n: number;
  gs: EMSScheduleSlot[];
}

export interface EMSScheduleEnvelope {
  version?: string;
  generated_at?: string;
  optimizer_id?: string;
  schedule: {
    version?: string;
    generated_at?: string;
    optimizer_id?: string;
    sch: EMSScheduleCompact | EMSScheduleVerbose;
  };
}

// Parsed schedule for UI consumption
export interface EMSParsedSlot {
  timestamp: Date;
  slotIndex: number;
  mode: EMSMode;
  importPrice: number;     // SEK/kWh
  exportPrice: number;     // SEK/kWh
  loadForecast: number;    // W
  productionForecast: number; // W
  gridImportLimit: number; // W
  gridExportLimit: number; // W
  gridTargetPower: number; // W
  gridTolerance: number;   // W
  ders: Record<string, {
    power: number;
    soc: number;
    weight: number;
  }>;
}

export interface EMSParsedSchedule {
  startTime: Date;
  slotDuration: number;  // seconds
  slots: EMSParsedSlot[];
  generatedAt: Date;
}

// ── Goals ─────────────────────────────────────────────────────────────

export interface EMSGoals {
  site_id: string;
  grid_target_power_w: number;
  grid_tolerance_w: number;
  der_goals: Record<string, DERGoal>;
}

export interface EMSGoalsUpdate {
  grid_target_power_w?: number;
  grid_tolerance_w?: number;
  der_goals?: Record<string, { target_power: number; weight: number }>;
}

// ── Charge Now ────────────────────────────────────────────────────────

export interface ChargeNowRequest {
  desired_power_w?: number;
}

export interface ChargeNowResponse {
  der_id: string;
  charge_now_active: boolean;
  desired_power_w: number | null;
}

// ── V2X Target ────────────────────────────────────────────────────────

export interface V2XTarget {
  der_id: string;
  current_soc_percent: number | null;
  target_soc_percent: number | null;
  target_time: string | null;  // HH:MM:SS
}

export interface V2XTargetUpdate {
  target_soc_percent?: number;
  target_time?: string;  // HH:MM:SS
}

// ── DER Update ────────────────────────────────────────────────────────

export interface DERUpdateRequest {
  capacity_wh?: number;
  capacity_w?: number;
  max_power_w?: number;
  max_charge_power_w?: number;
  max_discharge_power_w?: number;
  min_charge_power_w?: number;
  charge_efficiency?: number;
  discharge_efficiency?: number;
  min_soc_percent?: number;
  max_soc_percent?: number;
}

// ── Charger Schedule ──────────────────────────────────────────────────

export interface ChargerScheduleEntry {
  day_of_week: number;  // 1-7 (Mon-Sun)
  target_soc_percent: number;
  target_time: string;  // HH:MM
}

export interface ChargerScheduleCreate {
  site_id: string;
  der_id: string;
  timezone: string;
  entries: ChargerScheduleEntry[];
  default_target_soc_percent?: number;
  default_target_time?: string;
}

export interface ChargerScheduleResponse {
  site_id: string;
  der_id: string;
  timezone: string;
  entries: ChargerScheduleEntry[];
  default_target_soc_percent: number | null;
  default_target_time: string | null;
  created_at: string;
  updated_at: string;
}
