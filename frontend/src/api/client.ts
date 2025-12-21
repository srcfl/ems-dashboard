import type { SitesResponse, SiteOverview, TimeSeriesResponse } from './types';

const API_BASE = '/api';

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getSites(): Promise<SitesResponse> {
  return fetchJson<SitesResponse>(`${API_BASE}/sites`);
}

export async function getSite(siteId: string): Promise<SiteOverview> {
  return fetchJson<SiteOverview>(`${API_BASE}/sites/${siteId}`);
}

export async function getTimeSeries(
  siteId: string,
  options?: {
    derType?: string;
    field?: string;
    start?: string;
    aggregate?: string;
  }
): Promise<TimeSeriesResponse> {
  const params = new URLSearchParams();
  if (options?.derType) params.set('der_type', options.derType);
  if (options?.field) params.set('field', options.field);
  if (options?.start) params.set('start', options.start);
  if (options?.aggregate) params.set('aggregate', options.aggregate);

  const queryString = params.toString();
  const url = `${API_BASE}/sites/${siteId}/timeseries${queryString ? `?${queryString}` : ''}`;
  return fetchJson<TimeSeriesResponse>(url);
}
