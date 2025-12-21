export interface DER {
  type: string;
  device_serial: string | null;
  make: string | null;
  power_w: number;
  data: Record<string, number>;
  isPrimary?: boolean;
}

export interface SiteOverview {
  site_id: string;
  timestamp: string | null;
  total_pv_power_w: number;
  total_battery_power_w: number;
  total_grid_power_w: number;
  total_ev_power_w: number;
  load_w: number;
  battery_soc_avg: number | null;
  ders: DER[];
}

export interface SitesResponse {
  sites: string[];
  count: number;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  type?: string;
  device_serial?: string;
}

export interface TimeSeriesResponse {
  site_id: string;
  der_type: string | null;
  field: string;
  start: string;
  aggregate: string;
  data: TimeSeriesPoint[];
  count: number;
}
