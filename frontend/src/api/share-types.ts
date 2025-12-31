// Types for shareable dashboard links

export interface SharedDashboard {
  id: string;
  siteId: string;
  siteName: string;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  accessCount: number;
  lastAccessedAt?: string;
  settings: {
    timeRange: string;
    showDerCards: boolean;
    showAutomations: boolean;
  };
}

export type ExpirationPeriod = '1d' | '7d' | '30d' | '90d' | '180d';

export const EXPIRATION_LABELS: Record<ExpirationPeriod, string> = {
  '1d': '1 Day',
  '7d': '7 Days',
  '30d': '30 Days',
  '90d': '90 Days',
  '180d': '180 Days',
};

export function generateShareId(): string {
  // Generate a URL-safe random ID
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function getExpirationDate(period: ExpirationPeriod): Date {
  const now = new Date();
  const days = parseInt(period);
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function isShareExpired(share: SharedDashboard): boolean {
  return new Date(share.expiresAt) < new Date();
}

export function getShareUrl(shareId: string): string {
  // In production, this would be the actual domain
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${shareId}`;
}

export function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return 'Expired';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;
  return 'Less than 1h remaining';
}

// Storage functions
const SHARES_STORAGE_KEY = 'ems_shared_dashboards';

export function loadShares(): SharedDashboard[] {
  try {
    const saved = localStorage.getItem(SHARES_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function saveShares(shares: SharedDashboard[]): void {
  localStorage.setItem(SHARES_STORAGE_KEY, JSON.stringify(shares));
}

export function getShareById(shareId: string): SharedDashboard | null {
  const shares = loadShares();
  return shares.find(s => s.id === shareId) || null;
}

export function createShare(
  siteId: string,
  siteName: string,
  createdBy: string,
  expiration: ExpirationPeriod,
  settings: SharedDashboard['settings']
): SharedDashboard {
  const share: SharedDashboard = {
    id: generateShareId(),
    siteId,
    siteName,
    createdAt: new Date().toISOString(),
    expiresAt: getExpirationDate(expiration).toISOString(),
    createdBy,
    accessCount: 0,
    settings,
  };

  const shares = loadShares();
  shares.push(share);
  saveShares(shares);

  return share;
}

export function deleteShare(shareId: string): void {
  const shares = loadShares().filter(s => s.id !== shareId);
  saveShares(shares);
}

export function incrementAccessCount(shareId: string): void {
  const shares = loadShares();
  const share = shares.find(s => s.id === shareId);
  if (share) {
    share.accessCount++;
    share.lastAccessedAt = new Date().toISOString();
    saveShares(shares);
  }
}
