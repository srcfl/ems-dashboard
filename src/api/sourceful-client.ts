import type { AuthCredentials } from './sourceful-auth';
import type { SiteOverview, TimeSeriesResponse, DER } from './types';

const API_BASE = 'https://api-vnext.srcful.dev/';

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string }>;
}

/**
 * Execute a GraphQL query against the Sourceful API
 */
async function graphqlQuery<T>(
  query: string,
  variables?: Record<string, unknown>,
  credentials?: AuthCredentials | null
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (credentials) {
    headers['x-auth-message'] = credentials.message;
    headers['x-auth-signature'] = credentials.signature;
  }

  const body = JSON.stringify({ query, variables });
  console.log('📡 GraphQL request:', {
    url: API_BASE,
    hasCredentials: !!credentials,
    variables,
    body: body.substring(0, 500)
  });

  const response = await fetch(API_BASE, {
    method: 'POST',
    headers,
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('📡 API error response:', response.status, errorText);
    throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const result: GraphQLResponse<T> = await response.json();
  console.log('📡 GraphQL response:', result);

  if (result.errors && result.errors.length > 0) {
    console.error('📡 GraphQL errors:', result.errors);
    throw new Error(result.errors[0].message);
  }

  if (!result.data) {
    throw new Error('No data returned from API');
  }

  return result.data;
}

// ============ Types for API responses ============

interface SiteV2 {
  id: string;
  devices: DeviceV2[];
  settings?: SettingV2[];
}

interface DeviceV2 {
  rawSn: string;
  ders: DerV2[];
}

interface DerV2 {
  derSn: string;
  gwId: string;
  settings?: SettingV2[];
}

interface SettingV2 {
  key: string;
  value: string;
}

interface LatestPvData {
  timestamp: string;
  W: number | null;
  mppt1_V: number | null;
  mppt1_A: number | null;
  mppt2_V: number | null;
  mppt2_A: number | null;
  heatsink_C: number | null;
  total_generation_Wh: number | null;
}

interface LatestBatteryData {
  timestamp: string;
  W: number | null;
  A: number | null;
  V: number | null;
  SoC_nom_fract: number | null;
  heatsink_C: number | null;
  total_charge_Wh: number | null;
  total_discharge_Wh: number | null;
}

interface LatestMeterData {
  timestamp: string;
  W: number | null;
  Hz: number | null;
  L1_V: number | null;
  L1_A: number | null;
  L1_W: number | null;
  L2_V: number | null;
  L2_A: number | null;
  L2_W: number | null;
  L3_V: number | null;
  L3_A: number | null;
  L3_W: number | null;
  total_import_Wh: number | null;
  total_export_Wh: number | null;
}

interface LatestLoadData {
  timestamp: string;
  W: number | null;
}

interface TimeSeriesDataPoint {
  start: string;  // API uses 'start' for time series data points
  W: number | null;
}

// ============ API Functions ============

/**
 * Get all sites for the authenticated wallet
 */
export async function getSitesFromAPI(credentials: AuthCredentials): Promise<string[]> {
  const query = `
    query Sites {
      sites {
        list {
          id
        }
      }
    }
  `;

  const data = await graphqlQuery<{ sites: { list: SiteV2[] } }>(query, undefined, credentials);
  return data.sites.list.map(site => site.id);
}

/**
 * Get site overview with all DER data
 */
export async function getSiteFromAPI(siteId: string, credentials: AuthCredentials): Promise<SiteOverview> {
  // First get the site structure
  const siteQuery = `
    query Site {
      sites {
        list {
          id
          devices {
            rawSn
            ders {
              derSn
              gwId
              settings {
                key
                value
              }
            }
          }
        }
      }
    }
  `;

  console.log('📡 Fetching site structure for:', siteId);
  const siteData = await graphqlQuery<{ sites: { list: SiteV2[] } }>(siteQuery, undefined, credentials);
  console.log('📡 Sites response:', siteData);

  const site = siteData.sites.list.find(s => s.id === siteId);

  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  console.log('📡 Found site:', site.id, 'with', site.devices.length, 'devices');

  // Get load data first (meter might not be available for all sites)
  // Note: This API doesn't support GraphQL variables, so we inline values
  const loadQuery = `{
    data {
      load(siteId: "${siteId}") {
        latest {
          timestamp
          W
        }
      }
    }
  }`;

  console.log('📡 Fetching load data for site:', siteId);

  let loadPower = 0;

  try {
    const loadData = await graphqlQuery<{
      data: {
        load: { latest: LatestLoadData | null };
      };
    }>(loadQuery, undefined, credentials);
    loadPower = loadData.data.load?.latest?.W || 0;
    console.log('📡 Load power:', loadPower);
  } catch (e) {
    console.warn('Failed to fetch load data:', e);
  }

  // Try to get meter data if we have a meter serial number
  // For now, we'll skip meter data and calculate from DER values

  // Collect DERs with their device serial numbers
  interface DerInfo {
    derSn: string;      // DER ID for API calls (pv-xxx, bt-xxx, etc.)
    deviceSn: string;   // Actual device serial (rawSn)
    isPrimary?: boolean; // For meters: is this the default energy meter?
  }

  const dersByType: Record<string, DerInfo[]> = {
    pv: [],
    battery: [],
    charger: [],
    meter: [],
  };

  for (const device of site.devices) {
    console.log('📡 Device:', device.rawSn, 'has', device.ders.length, 'DERs');
    for (const der of device.ders) {
      // Determine type from derSn prefix
      const derSn = der.derSn.toLowerCase();
      const derInfo: DerInfo = { derSn: der.derSn, deviceSn: device.rawSn };

      // Check settings for primary meter flag
      const isPrimaryMeter = der.settings?.some(
        s => s.key === 'DEFAULT_ENERGY_METER' && s.value === 'true'
      );
      if (isPrimaryMeter) {
        derInfo.isPrimary = true;
      }

      console.log('📡 DER:', der.derSn, '-> device:', device.rawSn, isPrimaryMeter ? '(primary)' : '');

      if (derSn.startsWith('pv-')) {
        dersByType.pv.push(derInfo);
      } else if (derSn.startsWith('bt-')) {
        dersByType.battery.push(derInfo);
      } else if (derSn.startsWith('ch-')) {
        dersByType.charger.push(derInfo);
      } else if (derSn.startsWith('em-')) {
        dersByType.meter.push(derInfo);
      }
    }
  }

  console.log('📡 Found DERs:', dersByType);

  // Fetch PV data
  let totalPvPower = 0;
  const pvDers: DER[] = [];

  for (const pvInfo of dersByType.pv) {
    try {
      // Note: This API doesn't support GraphQL variables, so we inline values
      const pvQuery = `{
        data {
          pv(sn: "${pvInfo.derSn}") {
            latest {
              timestamp
              W
              mppt1_V
              mppt1_A
              mppt2_V
              mppt2_A
              heatsink_C
              total_generation_Wh
            }
          }
        }
      }`;
      console.log('📡 Fetching PV data for:', pvInfo.derSn, 'device:', pvInfo.deviceSn);
      const pvData = await graphqlQuery<{ data: { pv: { latest: LatestPvData | null } } }>(
        pvQuery,
        undefined,
        credentials
      );

      if (pvData.data.pv?.latest) {
        const pv = pvData.data.pv.latest;
        totalPvPower += pv.W || 0;
        pvDers.push({
          type: 'pv',
          device_serial: pvInfo.deviceSn,
          make: '',
          power_w: pv.W || 0,
          data: {
            W: pv.W || 0,
            mppt1_V: pv.mppt1_V || 0,
            mppt1_A: pv.mppt1_A || 0,
            mppt2_V: pv.mppt2_V || 0,
            mppt2_A: pv.mppt2_A || 0,
            heatsink_C: pv.heatsink_C || 0,
            total_generation_Wh: pv.total_generation_Wh || 0,
          },
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch PV data for ${pvInfo.derSn}:`, e);
    }
  }

  // Fetch Battery data
  let totalBatteryPower = 0;
  let batterySocSum = 0;
  let batterySocCount = 0;
  const batteryDers: DER[] = [];

  for (const batInfo of dersByType.battery) {
    try {
      // Note: This API doesn't support GraphQL variables, so we inline values
      const batQuery = `{
        data {
          battery(sn: "${batInfo.derSn}") {
            latest {
              timestamp
              W
              A
              V
              SoC_nom_fract
              heatsink_C
              total_charge_Wh
              total_discharge_Wh
            }
          }
        }
      }`;
      console.log('📡 Fetching battery data for:', batInfo.derSn, 'device:', batInfo.deviceSn);
      const batData = await graphqlQuery<{ data: { battery: { latest: LatestBatteryData | null } } }>(
        batQuery,
        undefined,
        credentials
      );

      if (batData.data.battery?.latest) {
        const bat = batData.data.battery.latest;
        totalBatteryPower += bat.W || 0;
        if (bat.SoC_nom_fract !== null) {
          batterySocSum += bat.SoC_nom_fract;
          batterySocCount++;
        }
        batteryDers.push({
          type: 'battery',
          device_serial: batInfo.deviceSn,
          make: '',
          power_w: bat.W || 0,
          data: {
            W: bat.W || 0,
            A: bat.A || 0,
            V: bat.V || 0,
            SoC_nom_fract: bat.SoC_nom_fract || 0,
            heatsink_C: bat.heatsink_C || 0,
            total_charge_Wh: bat.total_charge_Wh || 0,
            total_discharge_Wh: bat.total_discharge_Wh || 0,
          },
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch battery data for ${batInfo.derSn}:`, e);
    }
  }

  // Fetch Meter data
  let totalGridPower = 0;
  const meterDers: DER[] = [];

  for (const meterInfo of dersByType.meter) {
    try {
      const meterQuery = `{
        data {
          meter(sn: "${meterInfo.derSn}") {
            latest {
              timestamp
              W
              Hz
              L1_V
              L1_A
              L1_W
              L2_V
              L2_A
              L2_W
              L3_V
              L3_A
              L3_W
              total_import_Wh
              total_export_Wh
            }
          }
        }
      }`;
      console.log('📡 Fetching meter data for:', meterInfo.derSn, 'device:', meterInfo.deviceSn, meterInfo.isPrimary ? '(primary)' : '');
      const meterData = await graphqlQuery<{ data: { meter: { latest: LatestMeterData | null } } }>(
        meterQuery,
        undefined,
        credentials
      );

      if (meterData.data.meter?.latest) {
        const meter = meterData.data.meter.latest;
        // Only sum power from primary meter for total grid power
        if (meterInfo.isPrimary) {
          totalGridPower += meter.W || 0;
        }
        meterDers.push({
          type: 'meter',
          device_serial: meterInfo.deviceSn,
          make: '',
          power_w: meter.W || 0,
          data: {
            W: meter.W || 0,
            Hz: meter.Hz || 0,
            L1_V: meter.L1_V || 0,
            L1_A: meter.L1_A || 0,
            L1_W: meter.L1_W || 0,
            L2_V: meter.L2_V || 0,
            L2_A: meter.L2_A || 0,
            L2_W: meter.L2_W || 0,
            L3_V: meter.L3_V || 0,
            L3_A: meter.L3_A || 0,
            L3_W: meter.L3_W || 0,
            total_import_Wh: meter.total_import_Wh || 0,
            total_export_Wh: meter.total_export_Wh || 0,
          },
          isPrimary: meterInfo.isPrimary,
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch meter data for ${meterInfo.derSn}:`, e);
    }
  }

  // Use meter power if available, otherwise calculate from load
  const gridPower = totalGridPower !== 0 ? totalGridPower : (loadPower - totalPvPower - totalBatteryPower);

  return {
    site_id: siteId,
    timestamp: new Date().toISOString(),
    total_pv_power_w: totalPvPower,
    total_battery_power_w: totalBatteryPower,
    total_grid_power_w: gridPower,
    total_ev_power_w: 0, // TODO: Add charger support
    load_w: loadPower,
    battery_soc_avg: batterySocCount > 0 ? batterySocSum / batterySocCount : null,
    ders: [...pvDers, ...batteryDers, ...meterDers],
  };
}

/**
 * Get time series data for a site
 */
export async function getTimeSeriesFromAPI(
  siteId: string,
  credentials: AuthCredentials,
  options: { start?: string; aggregate?: string } = {}
): Promise<TimeSeriesResponse> {
  // Convert relative time to absolute
  const now = new Date();
  let fromDate: Date;

  const start = options.start || '-1h';
  if (start.startsWith('-')) {
    const match = start.match(/^-(\d+)([hdm])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      fromDate = new Date(now);
      if (unit === 'h') fromDate.setHours(fromDate.getHours() - value);
      else if (unit === 'd') fromDate.setDate(fromDate.getDate() - value);
      else if (unit === 'm') fromDate.setMinutes(fromDate.getMinutes() - value);
    } else {
      fromDate = new Date(now.getTime() - 60 * 60 * 1000); // Default 1 hour
    }
  } else {
    fromDate = new Date(start);
  }

  const resolution = options.aggregate || '1m';
  const fromISO = fromDate.toISOString();
  const toISO = now.toISOString();

  console.log('📡 Fetching time series for site:', siteId, 'from:', fromISO);

  const result: TimeSeriesResponse = {
    site_id: siteId,
    der_type: null,
    field: 'W',
    start: fromISO,
    aggregate: resolution,
    data: [],
    count: 0,
  };

  // First, get DER serial numbers for this site
  const siteQuery = `{
    sites {
      list {
        id
        devices {
          rawSn
          ders {
            derSn
          }
        }
      }
    }
  }`;

  let pvSerials: string[] = [];
  let batterySerials: string[] = [];
  let meterSerials: string[] = [];

  try {
    const siteData = await graphqlQuery<{ sites: { list: SiteV2[] } }>(siteQuery, undefined, credentials);
    const site = siteData.sites.list.find(s => s.id === siteId);
    if (site) {
      for (const device of site.devices) {
        for (const der of device.ders) {
          const derSn = der.derSn.toLowerCase();
          if (derSn.startsWith('pv-')) {
            pvSerials.push(der.derSn);
          } else if (derSn.startsWith('bt-')) {
            batterySerials.push(der.derSn);
          } else if (derSn.startsWith('em-')) {
            meterSerials.push(der.derSn);
          }
        }
      }
    }
    console.log('📡 Found DERs for time series - PV:', pvSerials.length, 'Battery:', batterySerials.length, 'Meter:', meterSerials.length);
  } catch (e) {
    console.warn('Failed to fetch site DERs:', e);
  }

  // Fetch load time series
  try {
    const loadQuery = `{
      data {
        load(siteId: "${siteId}") {
          timeSeries(from: "${fromISO}", to: "${toISO}", resolution: "${resolution}") {
            start
            W
          }
        }
      }
    }`;

    const data = await graphqlQuery<{
      data: {
        load: { timeSeries: TimeSeriesDataPoint[] | null };
      };
    }>(loadQuery, undefined, credentials);

    if (data.data.load?.timeSeries) {
      for (const point of data.data.load.timeSeries) {
        result.data.push({
          timestamp: point.start,
          value: point.W || 0,
          type: 'load',
          device_serial: 'load',
        });
      }
      console.log('📡 Load time series points:', data.data.load.timeSeries.length);
    }
  } catch (e) {
    console.warn('Failed to fetch load time series:', e);
  }

  // Fetch PV time series for each inverter
  for (const pvSn of pvSerials) {
    try {
      const pvQuery = `{
        data {
          pv(sn: "${pvSn}") {
            timeSeries(from: "${fromISO}", to: "${toISO}", resolution: "${resolution}") {
              start
              W
            }
          }
        }
      }`;

      const data = await graphqlQuery<{
        data: {
          pv: { timeSeries: TimeSeriesDataPoint[] | null };
        };
      }>(pvQuery, undefined, credentials);

      if (data.data.pv?.timeSeries) {
        for (const point of data.data.pv.timeSeries) {
          result.data.push({
            timestamp: point.start,
            value: point.W || 0,
            type: 'pv',
            device_serial: pvSn,
          });
        }
        console.log('📡 PV time series points for', pvSn, ':', data.data.pv.timeSeries.length);
      }
    } catch (e) {
      console.warn(`Failed to fetch PV time series for ${pvSn}:`, e);
    }
  }

  // Fetch battery time series for each battery
  for (const batSn of batterySerials) {
    try {
      const batQuery = `{
        data {
          battery(sn: "${batSn}") {
            timeSeries(from: "${fromISO}", to: "${toISO}", resolution: "${resolution}") {
              start
              W
            }
          }
        }
      }`;

      const data = await graphqlQuery<{
        data: {
          battery: { timeSeries: TimeSeriesDataPoint[] | null };
        };
      }>(batQuery, undefined, credentials);

      if (data.data.battery?.timeSeries) {
        for (const point of data.data.battery.timeSeries) {
          result.data.push({
            timestamp: point.start,
            value: point.W || 0,
            type: 'battery',
            device_serial: batSn,
          });
        }
        console.log('📡 Battery time series points for', batSn, ':', data.data.battery.timeSeries.length);
      }
    } catch (e) {
      console.warn(`Failed to fetch battery time series for ${batSn}:`, e);
    }
  }

  // Fetch meter (grid) time series
  for (const meterSn of meterSerials) {
    try {
      const meterQuery = `{
        data {
          meter(sn: "${meterSn}") {
            timeSeries(from: "${fromISO}", to: "${toISO}", resolution: "${resolution}") {
              start
              W
            }
          }
        }
      }`;

      const data = await graphqlQuery<{
        data: {
          meter: { timeSeries: TimeSeriesDataPoint[] | null };
        };
      }>(meterQuery, undefined, credentials);

      if (data.data.meter?.timeSeries) {
        for (const point of data.data.meter.timeSeries) {
          result.data.push({
            timestamp: point.start,
            value: point.W || 0,
            type: 'grid',
            device_serial: meterSn,
          });
        }
        console.log('📡 Meter time series points for', meterSn, ':', data.data.meter.timeSeries.length);
      }
    } catch (e) {
      console.warn(`Failed to fetch meter time series for ${meterSn}:`, e);
    }
  }

  result.count = result.data.length;
  return result;
}
