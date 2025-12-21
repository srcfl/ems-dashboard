import type { SiteOverview, TimeSeriesResponse } from './types';
import type { AuthCredentials } from './sourceful-auth';
import * as influxClient from './client';
import * as sourcefulClient from './sourceful-client';

export type DataSource = 'influxdb' | 'api';

interface DataServiceOptions {
  dataSource: DataSource;
  credentials?: AuthCredentials | null;
}

/**
 * Get sites for a wallet address
 */
export async function getSitesForWallet(
  walletAddress: string,
  options: DataServiceOptions
): Promise<string[]> {
  if (options.dataSource === 'api' && options.credentials) {
    return sourcefulClient.getSitesFromAPI(options.credentials);
  }

  // Fallback to InfluxDB
  const response = await fetch(`/api/wallet/${walletAddress}/sites`);
  const data = await response.json();
  return data.sites || [];
}

/**
 * Get site overview
 */
export async function getSite(
  siteId: string,
  options: DataServiceOptions
): Promise<SiteOverview> {
  if (options.dataSource === 'api' && options.credentials) {
    return sourcefulClient.getSiteFromAPI(siteId, options.credentials);
  }

  // Fallback to InfluxDB
  return influxClient.getSite(siteId);
}

/**
 * Get time series data
 */
export async function getTimeSeries(
  siteId: string,
  options: DataServiceOptions,
  params: { start?: string; aggregate?: string } = {}
): Promise<TimeSeriesResponse> {
  if (options.dataSource === 'api' && options.credentials) {
    return sourcefulClient.getTimeSeriesFromAPI(siteId, options.credentials, params);
  }

  // Fallback to InfluxDB
  return influxClient.getTimeSeries(siteId, params);
}
