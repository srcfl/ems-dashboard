// EMS Manager API Client
// Uses wallet auth (x-auth-message + x-auth-signature) instead of API key

import type { AuthCredentials } from './sourceful-auth';
import type {
  EMSSiteListItem,
  EMSSitesListResponse,
  EMSSiteDetail,
  EMSCombinedStatus,
  EMSDERResponse,
  EMSScheduleEnvelope,
  EMSScheduleVerbose,
  EMSScheduleCompact,
  EMSParsedSchedule,
  EMSParsedSlot,
  EMSMode,
  EMSGoals,
  EMSGoalsUpdate,
  ChargeNowRequest,
  ChargeNowResponse,
  V2XTarget,
  V2XTargetUpdate,
  DERUpdateRequest,
  ChargerScheduleCreate,
  ChargerScheduleResponse,
} from './ems-manager-types';

// Proxied via vite config → https://mainnet.srcful.dev
const MANAGER_API_BASE = '/ems/manager/api/v1';

// ── Request helpers ───────────────────────────────────────────────────

function authHeaders(credentials: AuthCredentials): Record<string, string> {
  return {
    'x-auth-message': credentials.message,
    'x-auth-signature': credentials.signature,
    'Content-Type': 'application/json',
  };
}

async function managerGet<T>(endpoint: string, credentials: AuthCredentials): Promise<T> {
  const response = await fetch(`${MANAGER_API_BASE}${endpoint}`, {
    method: 'GET',
    headers: authHeaders(credentials),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS Manager API error:', response.status, errorText);
    throw new Error(`EMS Manager API: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function managerPost<T>(endpoint: string, credentials: AuthCredentials, body?: unknown): Promise<T> {
  const response = await fetch(`${MANAGER_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(credentials),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS Manager API error:', response.status, errorText);
    throw new Error(`EMS Manager API: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function managerPut<T>(endpoint: string, credentials: AuthCredentials, body: unknown): Promise<T> {
  const response = await fetch(`${MANAGER_API_BASE}${endpoint}`, {
    method: 'PUT',
    headers: authHeaders(credentials),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS Manager API error:', response.status, errorText);
    throw new Error(`EMS Manager API: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function managerPatch<T>(endpoint: string, credentials: AuthCredentials, body: unknown): Promise<T> {
  const response = await fetch(`${MANAGER_API_BASE}${endpoint}`, {
    method: 'PATCH',
    headers: authHeaders(credentials),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS Manager API error:', response.status, errorText);
    throw new Error(`EMS Manager API: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function managerDelete(endpoint: string, credentials: AuthCredentials): Promise<void> {
  const response = await fetch(`${MANAGER_API_BASE}${endpoint}`, {
    method: 'DELETE',
    headers: authHeaders(credentials),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('EMS Manager API error:', response.status, errorText);
    throw new Error(`EMS Manager API: ${response.status} ${response.statusText}`);
  }
}

// ── Sites ─────────────────────────────────────────────────────────────

export async function getEMSSites(credentials: AuthCredentials): Promise<EMSSiteListItem[]> {
  const data = await managerGet<EMSSitesListResponse>('/sites', credentials);
  return data.items;
}

export async function getEMSSiteDetail(siteId: string, credentials: AuthCredentials): Promise<EMSSiteDetail> {
  return managerGet<EMSSiteDetail>(`/sites/${siteId}`, credentials);
}

export async function checkSiteHasEMS(siteId: string, credentials: AuthCredentials): Promise<EMSSiteListItem | null> {
  try {
    const sites = await getEMSSites(credentials);
    return sites.find(s => s.site_id === siteId) || null;
  } catch (e) {
    console.warn('Failed to check EMS status for site:', e);
    return null;
  }
}

// ── Status ────────────────────────────────────────────────────────────

export async function getEMSStatus(siteId: string, credentials: AuthCredentials): Promise<EMSCombinedStatus> {
  return managerGet<EMSCombinedStatus>(`/sites/${siteId}/status`, credentials);
}

// ── DERs ──────────────────────────────────────────────────────────────

export async function updateDER(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
  update: DERUpdateRequest,
): Promise<EMSDERResponse> {
  return managerPatch<EMSDERResponse>(`/sites/${siteId}/ders/${derId}`, credentials, update);
}

// ── Goals ─────────────────────────────────────────────────────────────

export async function getGoals(siteId: string, credentials: AuthCredentials): Promise<EMSGoals> {
  return managerGet<EMSGoals>(`/sites/${siteId}/goals`, credentials);
}

export async function updateGoals(
  siteId: string,
  credentials: AuthCredentials,
  update: EMSGoalsUpdate,
): Promise<EMSGoals> {
  return managerPut<EMSGoals>(`/sites/${siteId}/goals`, credentials, update);
}

// ── Charge Now ────────────────────────────────────────────────────────

export async function enableChargeNow(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
  request?: ChargeNowRequest,
): Promise<ChargeNowResponse> {
  return managerPut<ChargeNowResponse>(
    `/sites/${siteId}/ders/${derId}/charge-now`,
    credentials,
    request || {},
  );
}

export async function disableChargeNow(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
): Promise<void> {
  return managerDelete(`/sites/${siteId}/ders/${derId}/charge-now`, credentials);
}

// ── V2X Target ────────────────────────────────────────────────────────

export async function getV2XTarget(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
): Promise<V2XTarget> {
  return managerGet<V2XTarget>(`/sites/${siteId}/ders/${derId}/v2x-target`, credentials);
}

export async function updateV2XTarget(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
  update: V2XTargetUpdate,
): Promise<V2XTarget> {
  return managerPut<V2XTarget>(`/sites/${siteId}/ders/${derId}/v2x-target`, credentials, update);
}

// ── Charger Schedules ─────────────────────────────────────────────────

export async function getChargerSchedules(
  siteId: string,
  credentials: AuthCredentials,
): Promise<ChargerScheduleResponse[]> {
  return managerGet<ChargerScheduleResponse[]>(`/schedules/charger/${siteId}`, credentials);
}

export async function createChargerSchedule(
  credentials: AuthCredentials,
  schedule: ChargerScheduleCreate,
): Promise<ChargerScheduleResponse> {
  return managerPost<ChargerScheduleResponse>('/schedules/charger', credentials, schedule);
}

export async function deleteChargerSchedule(
  siteId: string,
  derId: string,
  credentials: AuthCredentials,
): Promise<void> {
  return managerDelete(`/schedules/charger/${siteId}/${derId}`, credentials);
}

// ── Schedule ──────────────────────────────────────────────────────────

export async function getEMSScheduleRaw(
  siteId: string,
  credentials: AuthCredentials,
  format: 'compact' | 'verbose' = 'verbose',
): Promise<EMSScheduleEnvelope> {
  return managerGet<EMSScheduleEnvelope>(
    `/sites/${siteId}/schedule?format=${format}`,
    credentials,
  );
}

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
      importPrice: slot.sig.pr,
      exportPrice: slot.sig.epr,
      loadForecast: slot.sig.ld,
      productionForecast: slot.sig.prod,
      gridImportLimit: slot.gil,
      gridExportLimit: slot.gel,
      gridTargetPower: slot.sg.tgp,
      gridTolerance: slot.sg.gt,
      ders,
    };
  });

  return {
    startTime,
    slotDuration,
    slots,
    generatedAt: new Date(envelope.schedule.generated_at || envelope.generated_at || new Date().toISOString()),
  };
}

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
      importPrice: sch.pr[i],
      exportPrice: 0, // Not in compact format
      loadForecast: 0,
      productionForecast: 0,
      gridImportLimit: sch.gil[i],
      gridExportLimit: sch.gel[i],
      gridTargetPower: sch.sg.tgp[i],
      gridTolerance: sch.sg.gt[i],
      ders,
    });
  }

  return {
    startTime,
    slotDuration,
    slots,
    generatedAt: new Date(envelope.schedule.generated_at || envelope.generated_at || new Date().toISOString()),
  };
}

export async function getEMSSchedule(
  siteId: string,
  credentials: AuthCredentials,
): Promise<EMSParsedSchedule> {
  const envelope = await getEMSScheduleRaw(siteId, credentials, 'verbose');
  const sch = envelope.schedule.sch;
  if ('gs' in sch) {
    return parseVerboseSchedule(envelope);
  }
  return parseCompactSchedule(envelope);
}

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

// ── Mode helpers ──────────────────────────────────────────────────────

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
        label: 'Charge',
        color: 'blue',
        description: 'Charging battery from grid (low price)',
      };
    case 'FORCE_DISCHARGE':
      return {
        label: 'Discharge',
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

export function formatPrice(priceSEK: number): string {
  const ore = priceSEK * 100;
  return `${ore.toFixed(1)} öre/kWh`;
}
