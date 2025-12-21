// EMS Optimizer API Client

import type {
  EMSSite,
  EMSSitesResponse,
  EMSStatus,
  EMSDER,
  EMSDERsResponse,
  EMSScheduleEnvelope,
  EMSScheduleCompact,
  EMSScheduleVerbose,
  EMSParsedSchedule,
  EMSParsedSlot,
  EMSMode,
} from './ems-types';

// Use proxy in development, direct URL in production
const EMS_API_BASE = '/ems/optimizer/api/v1';

// API key from environment variable
const EMS_API_KEY = import.meta.env.VITE_EMS_API_KEY || '';

async function emsRequest<T>(endpoint: string): Promise<T> {
  if (!EMS_API_KEY) {
    throw new Error('EMS API key not configured. Set VITE_EMS_API_KEY in .env');
  }

  const response = await fetch(`${EMS_API_BASE}${endpoint}`, {
    method: 'GET',
    headers: {
      'X-AUTH': EMS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS API error:', response.status, errorText);
    throw new Error(`EMS API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get all EMS-enabled sites
 */
export async function getEMSSites(): Promise<EMSSite[]> {
  const data = await emsRequest<EMSSitesResponse>('/sites');
  return data.items;
}

/**
 * Check if a specific site has EMS enabled
 */
export async function checkSiteHasEMS(siteId: string): Promise<EMSSite | null> {
  try {
    const sites = await getEMSSites();
    return sites.find(s => s.site_id === siteId) || null;
  } catch (e) {
    console.warn('Failed to check EMS status for site:', e);
    return null;
  }
}

/**
 * Get EMS status for a site
 */
export async function getEMSStatus(siteId: string): Promise<EMSStatus> {
  return emsRequest<EMSStatus>(`/sites/${siteId}/status`);
}

/**
 * Get EMS DERs for a site
 */
export async function getEMSDERs(siteId: string): Promise<EMSDER[]> {
  const data = await emsRequest<EMSDERsResponse>(`/ders?site_id=${siteId}`);
  return data.items;
}

/**
 * Get EMS schedule (compact format)
 */
export async function getEMSScheduleRaw(siteId: string, format: 'compact' | 'verbose' = 'compact'): Promise<EMSScheduleEnvelope> {
  return emsRequest<EMSScheduleEnvelope>(`/sites/${siteId}/schedule?format=${format}`);
}

/**
 * Parse compact schedule format into UI-friendly structure
 */
function parseCompactSchedule(envelope: EMSScheduleEnvelope): EMSParsedSchedule {
  const sch = envelope.schedule.sch as EMSScheduleCompact;
  const startTime = new Date(sch.st);
  const slotDuration = sch.dt;

  const slots: EMSParsedSlot[] = [];

  for (let i = 0; i < sch.n; i++) {
    const timestamp = new Date(startTime.getTime() + i * slotDuration * 1000);

    const ders: Record<string, { power: number; soc: number; weight: number }> = {};
    for (const [derId, derData] of Object.entries(sch.dg)) {
      ders[derId] = {
        power: derData.p[i],
        soc: derData.soc[i],
        weight: derData.w[i],
      };
    }

    slots.push({
      timestamp,
      slotIndex: i,
      mode: sch.m[i],
      price: sch.pr[i],
      loadForecast: 0, // Not in compact format
      productionForecast: 0, // Not in compact format
      gridImportLimit: sch.gil[i],
      gridExportLimit: sch.gel[i],
      ders,
    });
  }

  return {
    startTime,
    slotDuration,
    slots,
    generatedAt: new Date(envelope.generated_at),
  };
}

/**
 * Parse verbose schedule format into UI-friendly structure
 */
function parseVerboseSchedule(envelope: EMSScheduleEnvelope): EMSParsedSchedule {
  const sch = envelope.schedule.sch as EMSScheduleVerbose;
  const startTime = new Date(sch.st);
  const slotDuration = sch.dt;

  const slots: EMSParsedSlot[] = sch.gs.map((slot, i) => {
    const timestamp = new Date(startTime.getTime() + i * slotDuration * 1000);

    const ders: Record<string, { power: number; soc: number; weight: number }> = {};
    for (const [derId, derData] of Object.entries(slot.dg)) {
      ders[derId] = {
        power: derData.p,
        soc: derData.soc,
        weight: derData.w,
      };
    }

    return {
      timestamp,
      slotIndex: slot.t,
      mode: slot.m,
      price: slot.pr,
      loadForecast: slot.ld,
      productionForecast: slot.prod,
      gridImportLimit: slot.gil,
      gridExportLimit: slot.gel,
      ders,
    };
  });

  return {
    startTime,
    slotDuration,
    slots,
    generatedAt: new Date(envelope.generated_at),
  };
}

/**
 * Get parsed EMS schedule for a site
 */
export async function getEMSSchedule(siteId: string): Promise<EMSParsedSchedule> {
  // Use verbose format to get load/production forecasts
  const envelope = await getEMSScheduleRaw(siteId, 'verbose');

  // Check if it's verbose or compact format
  const sch = envelope.schedule.sch;
  if ('gs' in sch) {
    return parseVerboseSchedule(envelope);
  } else {
    return parseCompactSchedule(envelope);
  }
}

/**
 * Get current slot from schedule
 */
export function getCurrentSlot(schedule: EMSParsedSchedule): EMSParsedSlot | null {
  const now = new Date();

  for (const slot of schedule.slots) {
    const slotEnd = new Date(slot.timestamp.getTime() + schedule.slotDuration * 1000);
    if (now >= slot.timestamp && now < slotEnd) {
      return slot;
    }
  }

  return null;
}

/**
 * Get mode display info
 */
export function getModeInfo(mode: EMSMode): { label: string; color: string; description: string } {
  switch (mode) {
    case 'IDLE':
      return {
        label: 'Idle',
        color: 'gray',
        description: 'Battery is idle, grid handles load',
      };
    case 'SELF_CONSUMPTION':
      return {
        label: 'Self Consumption',
        color: 'green',
        description: 'Maximizing self-consumption, minimizing grid usage',
      };
    case 'FORCE_CHARGE':
      return {
        label: 'Force Charge',
        color: 'blue',
        description: 'Charging battery from grid (low price)',
      };
    case 'FORCE_DISCHARGE':
      return {
        label: 'Force Discharge',
        color: 'orange',
        description: 'Discharging battery to grid (high price)',
      };
    default:
      return {
        label: mode,
        color: 'gray',
        description: 'Unknown mode',
      };
  }
}

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  // Price is in SEK/kWh, convert to öre/kWh for display
  const ore = price * 100;
  return `${ore.toFixed(1)} öre/kWh`;
}
