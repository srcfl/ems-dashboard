import type { SiteOverview, TimeSeriesResponse, TimeSeriesPoint } from './types';

// Demo site configurations
export const DEMO_SITES = [
  {
    id: 'demo-site-001',
    name: 'Demo Home',
    // Residential: 4.5kW solar, BYD battery, moderate load
    solarPeak: 4500,
    batteryCapacity: 10000,
    baseLoad: 400,
    peakLoad: 2000,
  },
  {
    id: 'demo-site-002',
    name: 'Demo Office',
    // Commercial: 12kW solar, larger battery, higher daytime load
    solarPeak: 12000,
    batteryCapacity: 20000,
    baseLoad: 1200,
    peakLoad: 8000,
  },
] as const;

// Legacy exports for backward compatibility
export const DEMO_SITE_ID = DEMO_SITES[0].id;
export const DEMO_SITE_NAME = DEMO_SITES[0].name;

// Get site config by ID
function getSiteConfig(siteId: string) {
  return DEMO_SITES.find(s => s.id === siteId) || DEMO_SITES[0];
}

// Generate realistic solar curve (bell curve during daylight hours)
function getSolarPower(date: Date, solarPeak: number): number {
  const hour = date.getHours();
  // Solar production: 6am to 8pm, peak at 1pm
  if (hour < 6 || hour > 20) return 0;
  const peakHour = 13;
  const spread = 4;
  const power = solarPeak * Math.exp(-Math.pow(hour - peakHour, 2) / (2 * spread * spread));
  // Add some noise
  return Math.max(0, power * (0.85 + Math.random() * 0.3));
}

// Generate load pattern - residential vs commercial patterns
function getLoadPower(date: Date, baseLoad: number, peakLoad: number, isCommercial: boolean): number {
  const hour = date.getHours();
  let loadMultiplier = 0;

  if (isCommercial) {
    // Commercial: high during business hours 8am-6pm
    if (hour >= 8 && hour <= 18) {
      loadMultiplier = 0.7 + Math.random() * 0.3;
    } else if (hour >= 6 && hour < 8) {
      loadMultiplier = 0.3 + Math.random() * 0.2; // Ramping up
    } else if (hour > 18 && hour <= 20) {
      loadMultiplier = 0.3 + Math.random() * 0.2; // Ramping down
    } else {
      loadMultiplier = 0.1 + Math.random() * 0.1; // Night security/HVAC
    }
  } else {
    // Residential: morning and evening peaks
    if (hour >= 7 && hour <= 9) {
      loadMultiplier = 0.6 + Math.random() * 0.3; // Morning peak
    } else if (hour >= 17 && hour <= 22) {
      loadMultiplier = 0.8 + Math.random() * 0.4; // Evening peak
    } else if (hour >= 23 || hour < 6) {
      loadMultiplier = 0.1 + Math.random() * 0.1; // Night
    } else {
      loadMultiplier = 0.3 + Math.random() * 0.2; // Midday
    }
  }

  return baseLoad + peakLoad * loadMultiplier;
}

// Battery behavior based on solar and load
function getBatteryPower(solar: number, load: number, soc: number): number {
  const excess = solar - load;

  if (excess > 500 && soc < 0.95) {
    // Charging from excess solar (capped at 3kW)
    return Math.min(excess * 0.8, 3000);
  } else if (excess < -500 && soc > 0.15) {
    // Discharging to cover load (capped at 3kW)
    return Math.max(excess * 0.8, -3000);
  }
  return 0;
}

// Get current demo data for a specific site
export function getDemoSiteOverview(siteId: string = DEMO_SITE_ID): SiteOverview {
  const config = getSiteConfig(siteId);
  const isCommercial = siteId === 'demo-site-002';
  const now = new Date();
  const solar = getSolarPower(now, config.solarPeak);
  const load = getLoadPower(now, config.baseLoad, config.peakLoad, isCommercial);

  // Simulate SoC based on time of day
  const hour = now.getHours();
  let soc = 0.5;
  if (hour < 10) soc = 0.3 + (hour / 10) * 0.2;
  else if (hour < 16) soc = 0.5 + ((hour - 10) / 6) * 0.4;
  else soc = 0.9 - ((hour - 16) / 8) * 0.5;
  soc = Math.max(0.15, Math.min(0.95, soc + (Math.random() - 0.5) * 0.1));

  const battery = getBatteryPower(solar, load, soc);
  const grid = load - solar - battery;

  // Use site-specific serial prefixes
  const prefix = siteId.replace('demo-site-', '');

  return {
    site_id: siteId,
    timestamp: now.toISOString(),
    total_pv_power_w: solar,
    total_battery_power_w: battery,
    total_grid_power_w: grid,
    total_ev_power_w: 0,
    load_w: load,
    battery_soc_avg: soc,
    ders: [
      {
        type: 'pv',
        device_serial: `pv-demo-${prefix}`,
        make: isCommercial ? 'Fronius' : 'SolarEdge',
        power_w: solar,
        data: {
          W: solar,
          mppt1_V: solar > 0 ? 38 + Math.random() * 4 : 0,
          mppt1_A: solar > 0 ? solar / 40 / 2 : 0,
          mppt2_V: solar > 0 ? 37 + Math.random() * 4 : 0,
          mppt2_A: solar > 0 ? solar / 40 / 2 : 0,
          heatsink_C: 25 + (solar / config.solarPeak) * 35,
          total_generation_Wh: 12500000 + Math.random() * 100000,
        },
      },
      {
        type: 'battery',
        device_serial: `bt-demo-${prefix}`,
        make: isCommercial ? 'Tesla' : 'BYD',
        power_w: battery,
        data: {
          W: battery,
          A: battery / 52,
          V: 51 + Math.random() * 2,
          SoC_nom_fract: soc,
          heatsink_C: 22 + Math.abs(battery / 3000) * 10,
          total_charge_Wh: 4500000 + Math.random() * 50000,
          total_discharge_Wh: 4200000 + Math.random() * 50000,
        },
      },
      {
        type: 'meter',
        device_serial: `em-demo-${prefix}`,
        make: 'Eastron',
        power_w: grid,
        data: {
          W: grid,
          Hz: 50 + (Math.random() - 0.5) * 0.1,
          L1_V: 230 + (Math.random() - 0.5) * 6,
          L1_A: grid / 230 / 3,
          L1_W: grid / 3,
          L2_V: 231 + (Math.random() - 0.5) * 6,
          L2_A: grid / 230 / 3,
          L2_W: grid / 3,
          L3_V: 229 + (Math.random() - 0.5) * 6,
          L3_A: grid / 230 / 3,
          L3_W: grid / 3,
          total_import_Wh: 8500000,
          total_export_Wh: 3200000,
        },
        isPrimary: true,
      },
    ],
  };
}

// Generate time series data for demo
export function getDemoTimeSeries(
  timeRange: string = '-1h',
  resolution: string = '1m',
  siteId: string = DEMO_SITE_ID
): TimeSeriesResponse {
  const config = getSiteConfig(siteId);
  const isCommercial = siteId === 'demo-site-002';
  const prefix = siteId.replace('demo-site-', '');
  const now = new Date();
  const data: TimeSeriesPoint[] = [];

  // Parse time range
  let durationMs = 60 * 60 * 1000; // Default 1 hour
  const match = timeRange.match(/^-(\d+)([hdm])$/);
  if (match) {
    const value = parseInt(match[1]);
    const unit = match[2];
    if (unit === 'h') durationMs = value * 60 * 60 * 1000;
    else if (unit === 'd') durationMs = value * 24 * 60 * 60 * 1000;
    else if (unit === 'm') durationMs = value * 60 * 1000;
  }

  // Parse resolution
  let intervalMs = 60 * 1000; // Default 1 minute
  const resMatch = resolution.match(/^(\d+)([mh])$/);
  if (resMatch) {
    const value = parseInt(resMatch[1]);
    const unit = resMatch[2];
    if (unit === 'm') intervalMs = value * 60 * 1000;
    else if (unit === 'h') intervalMs = value * 60 * 60 * 1000;
  }

  const startTime = now.getTime() - durationMs;
  let soc = 0.5;

  for (let t = startTime; t <= now.getTime(); t += intervalMs) {
    const date = new Date(t);
    const solar = getSolarPower(date, config.solarPeak);
    const load = getLoadPower(date, config.baseLoad, config.peakLoad, isCommercial);
    const battery = getBatteryPower(solar, load, soc);
    const grid = load - solar - battery;

    // Update SoC based on battery capacity
    soc += (battery / config.batteryCapacity) * (intervalMs / 3600000);
    soc = Math.max(0.1, Math.min(0.95, soc));

    const timestamp = date.toISOString();

    data.push({ timestamp, value: load, type: 'load', device_serial: 'load' });
    data.push({ timestamp, value: solar, type: 'pv', device_serial: `pv-demo-${prefix}` });
    data.push({ timestamp, value: battery, type: 'battery', device_serial: `bt-demo-${prefix}` });
    data.push({ timestamp, value: grid, type: 'grid', device_serial: `em-demo-${prefix}` });
  }

  return {
    site_id: siteId,
    der_type: null,
    field: 'W',
    start: new Date(startTime).toISOString(),
    aggregate: resolution,
    data,
    count: data.length,
  };
}
