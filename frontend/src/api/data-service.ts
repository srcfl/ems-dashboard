import type { SiteOverview, TimeSeriesResponse } from './types';
import type { AuthCredentials } from './sourceful-auth';
import * as sourcefulClient from './sourceful-client';
import { getDemoSiteOverview, getDemoTimeSeries, DEMO_SITE_ID } from './demo-data';

// Check if running in demo mode
function isDemoMode(credentials: AuthCredentials): boolean {
  return credentials.message === 'demo-mode';
}

/**
 * Get sites for a wallet address
 */
export async function getSitesForWallet(
  credentials: AuthCredentials
): Promise<string[]> {
  if (isDemoMode(credentials)) {
    return [DEMO_SITE_ID];
  }
  return sourcefulClient.getSitesFromAPI(credentials);
}

/**
 * Get site overview
 */
export async function getSite(
  siteId: string,
  credentials: AuthCredentials
): Promise<SiteOverview> {
  if (isDemoMode(credentials)) {
    return getDemoSiteOverview();
  }
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
  if (isDemoMode(credentials)) {
    return getDemoTimeSeries(params.start, params.aggregate);
  }
  return sourcefulClient.getTimeSeriesFromAPI(siteId, credentials, params);
}
