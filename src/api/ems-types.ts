// EMS Optimizer API Types

export interface EMSSite {
  site_id: string;
  id: string;
  wallet_id: string;
  active: boolean;
  price_area: string;
  control: {
    optimization_interval_seconds: number;
    horizon_steps: number;
    site_power_limit_w: number;
    daily_energy_consumption_wh: number;
  };
  created_at: string;
  updated_at: string;
  lease_instance_id: string;
}

export interface EMSSitesResponse {
  items: EMSSite[];
  total: number;
  total_errors: number;
  errors: string[];
}

export interface EMSStatus {
  site_id: string;
  wallet_id: string;
  last_run_at: string | null;
  solver_status: 'success' | 'failed' | 'infeasible' | null;
  objective_value: number | null;
  message: string | null;
  trigger_source: 'scheduled' | 'manual' | null;
}

export interface EMSDER {
  id: string;
  site_id: string;
  type: 'battery' | 'v2x' | 'pv' | 'evcharger';
  der_id: string;
  attributes: Record<string, unknown>;
  capacity_wh: number;
  max_charge_power_w: number;
  max_discharge_power_w: number;
  min_charge_power_w?: number;
  charge_efficiency: number;
  discharge_efficiency: number;
  min_soc_percent: number;
  max_soc_percent: number;
  soc_percent: number;
  last_known_power_w: number;
  last_telemetry_at: string;
}

export interface EMSDERsResponse {
  items: EMSDER[];
  total: number;
}

// Schedule types
export type EMSMode = 'IDLE' | 'SELF_CONSUMPTION' | 'FORCE_CHARGE' | 'FORCE_DISCHARGE';

export interface EMSSlotDERData {
  p: number;      // Power setpoint (W)
  w: number;      // Weight/priority
  soc: number;    // State of charge (%)
}

export interface EMSScheduleSlot {
  t: number;                              // Time slot index
  m: EMSMode;                             // Mode
  pr: number;                             // Price (SEK/kWh)
  ld: number;                             // Load forecast (W)
  prod: number;                           // Production forecast (W)
  gil: number;                            // Grid import limit (W)
  gel: number;                            // Grid export limit (W)
  sg: {
    tgp: number;                          // Total grid power
    gt: number;                           // Grid threshold
  };
  dg: Record<string, EMSSlotDERData>;     // Per-DER data
}

export interface EMSScheduleCompact {
  st: string;                             // Start time
  dt: number;                             // Delta time (seconds per slot)
  n: number;                              // Number of slots
  m: EMSMode[];                           // Modes array
  pr: number[];                           // Prices array
  gil: number[];                          // Grid import limits
  gel: number[];                          // Grid export limits
  sg: {
    tgp: number[];
    gt: number[];
  };
  dg: Record<string, {
    p: number[];
    w: number[];
    soc: number[];
  }>;
}

export interface EMSScheduleVerbose {
  st: string;
  dt: number;
  n: number;
  gs: EMSScheduleSlot[];                  // Grid schedule (verbose format)
}

export interface EMSScheduleEnvelope {
  version: string;
  generated_at: string;
  optimizer_id: string;
  schedule: {
    version: string;
    generated_at: string;
    optimizer_id: string;
    sch: EMSScheduleCompact | EMSScheduleVerbose;
  };
}

// Parsed schedule for UI consumption
export interface EMSParsedSlot {
  timestamp: Date;
  slotIndex: number;
  mode: EMSMode;
  price: number;
  loadForecast: number;
  productionForecast: number;
  gridImportLimit: number;
  gridExportLimit: number;
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
