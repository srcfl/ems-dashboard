import { useState, useCallback, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';
import {
  generateAuthMessage,
  base58Encode,
  base58EncodeSignature,
  getCachedCredentials,
  cacheCredentials,
  clearCredentials,
  type AuthCredentials,
} from '../api/sourceful-auth';

export function useSourcefulAuth() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [credentials, setCredentials] = useState<AuthCredentials | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref guard to prevent double-firing of auto-generation
  const autoGenerateAttempted = useRef(false);

  // Load cached credentials on mount, or auto-generate if none exist
  useEffect(() => {
    if (!authenticated || wallets.length === 0) {
      if (!authenticated) {
        setCredentials(null);
        clearCredentials();
      }
      // Reset guard when logged out so re-login triggers generation
      autoGenerateAttempted.current = false;
      return;
    }

    const wallet = wallets[0];

    // Clear stale credentials from a different wallet
    const cached = getCachedCredentials();
    if (cached && cached.walletAddress !== wallet.address) {
      clearCredentials();
      setCredentials(null);
    } else if (cached && cached.walletAddress === wallet.address) {
      setCredentials(cached);
      return;
    }

    // No valid cached credentials - auto-trigger signing (once)
    if (!autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      generateCredentials();
    }
  }, [authenticated, wallets]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateCredentials = useCallback(async (): Promise<AuthCredentials | null> => {
    if (!ready) {
      setError('Privy is not ready');
      return null;
    }

    if (!wallets || wallets.length === 0) {
      setError('No wallet available. Please ensure you are logged in.');
      return null;
    }

    // Check if wallet is connected and ready
    const wallet = wallets[0];
    if (!wallet.address) {
      setError('Wallet not connected. Please try logging out and back in.');
      return null;
    }

    // Check for cached credentials first
    const cached = getCachedCredentials();
    if (cached && cached.walletAddress === wallet.address) {
      setCredentials(cached);
      return cached;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Create message with 1 year expiration
      const issuedAt = new Date();
      const expirationTime = new Date();
      expirationTime.setFullYear(expirationTime.getFullYear() + 1);

      const plainTextMessage = generateAuthMessage(
        wallet.address,
        issuedAt,
        expirationTime
      );

      // Sign the message with timeout to prevent infinite loading
      const messageBytes = new TextEncoder().encode(plainTextMessage);

      const signaturePromise = signMessage({
        message: messageBytes,
        wallet: wallet,
      });

      // Add 30 second timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Signing timed out. Please try again.')), 30000);
      });

      const signatureResult = await Promise.race([signaturePromise, timeoutPromise]);

      // Extract signature bytes - handle different response formats
      let signatureBytes: Uint8Array;
      const result = signatureResult as unknown;
      if (result && typeof result === 'object' && 'signature' in result) {
        signatureBytes = (result as { signature: Uint8Array }).signature;
      } else if (result instanceof Uint8Array) {
        signatureBytes = result;
      } else {
        throw new Error('Unexpected signature format');
      }

      // Encode to base58
      const base58Message = base58Encode(plainTextMessage);
      const base58Signature = base58EncodeSignature(signatureBytes);

      const newCredentials: AuthCredentials = {
        message: base58Message,
        signature: base58Signature,
        walletAddress: wallet.address,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expirationTime.toISOString(),
      };

      // Cache and set credentials
      cacheCredentials(newCredentials);
      setCredentials(newCredentials);
      setIsGenerating(false);
      return newCredentials;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate credentials';
      setError(errorMessage);
      setIsGenerating(false);
      return null;
    }
  }, [ready, wallets, signMessage]);

  const clearAuth = useCallback(() => {
    setCredentials(null);
    clearCredentials();
    setError(null);
    autoGenerateAttempted.current = false;
  }, []);

  return {
    credentials,
    isGenerating,
    error,
    ready: ready && wallets.length > 0,
    hasCredentials: !!credentials,
    generateCredentials,
    clearAuth,
  };
}
