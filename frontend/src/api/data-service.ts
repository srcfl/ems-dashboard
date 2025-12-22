import type { SiteOverview, TimeSeriesResponse } from './types';
import type { AuthCredentials } from './sourceful-auth';
import * as sourcefulClient from './sourceful-client';

/**
 * Get sites for a wallet address
 */
export async function getSitesForWallet(
  credentials: AuthCredentials
): Promise<string[]> {
  return sourcefulClient.getSitesFromAPI(credentials);
}

/**
 * Get site overview
 */
export async function getSite(
  siteId: string,
  credentials: AuthCredentials
): Promise<SiteOverview> {
  return sourcefulClient.getSiteFromAPI(siteId, credentials);
}

/**
 * Get time series data
 */
export async function getTimeSeries(
  siteId: string,
  credentials: AuthCredentials,
  params: { start?: string; aggregate?: string } = {}
): Promise<TimeSeriesResponse> {
  return sourcefulClient.getTimeSeriesFromAPI(siteId, credentials, params);
}
