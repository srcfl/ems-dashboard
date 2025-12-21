import { Buffer } from 'buffer';
import bs58 from 'bs58';

// Polyfill Buffer for browser
declare global {
  interface Window {
    Buffer: typeof Buffer;
  }
}

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer;
}

/**
 * Generates a Sourceful authentication message for signing
 */
export function generateAuthMessage(
  walletAddress: string,
  issuedAt: Date,
  expirationTime: Date
): string {
  return `Sourceful Energy EMS Dashboard wants you to sign data with your Solana account:\n${walletAddress}\n\nGrant basic application access\n\nIssued At (UTC): ${issuedAt.toISOString()}\nExpiration Time (UTC): ${expirationTime.toISOString()}`;
}

/**
 * Encodes a string to Base58 format
 */
export function base58Encode(message: string): string {
  const encoder = new TextEncoder();
  const buffer = encoder.encode(message);
  return bs58.encode(buffer);
}

/**
 * Encodes a Uint8Array signature to Base58 format
 */
export function base58EncodeSignature(signature: Uint8Array): string {
  return bs58.encode(signature);
}

export interface AuthCredentials {
  message: string;        // Base58 encoded message
  signature: string;      // Base58 encoded signature
  walletAddress: string;
  issuedAt: string;
  expiresAt: string;
}

// Storage key for cached credentials
const CREDENTIALS_KEY = 'sourceful_auth_credentials';

/**
 * Get cached credentials if still valid
 */
export function getCachedCredentials(): AuthCredentials | null {
  try {
    const stored = localStorage.getItem(CREDENTIALS_KEY);
    if (!stored) return null;

    const credentials = JSON.parse(stored) as AuthCredentials;
    const expiresAt = new Date(credentials.expiresAt);

    // Check if credentials are still valid (with 5 min buffer)
    if (expiresAt.getTime() - Date.now() > 5 * 60 * 1000) {
      return credentials;
    }

    // Expired, remove them
    localStorage.removeItem(CREDENTIALS_KEY);
    return null;
  } catch {
    return null;
  }
}

/**
 * Cache credentials
 */
export function cacheCredentials(credentials: AuthCredentials): void {
  localStorage.setItem(CREDENTIALS_KEY, JSON.stringify(credentials));
}

/**
 * Clear cached credentials
 */
export function clearCredentials(): void {
  localStorage.removeItem(CREDENTIALS_KEY);
}
