import { useState, useCallback, useEffect } from 'react';
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

  // Try to load cached credentials on mount
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      const cached = getCachedCredentials();
      if (cached && cached.walletAddress === wallets[0].address) {
        setCredentials(cached);
      }
    }
  }, [authenticated, wallets]);

  // Clear credentials on logout
  useEffect(() => {
    if (!authenticated) {
      setCredentials(null);
      clearCredentials();
    }
  }, [authenticated]);

  const generateCredentials = useCallback(async (): Promise<AuthCredentials | null> => {
    if (!ready) {
      setError('Privy is not ready');
      return null;
    }

    if (!wallets || wallets.length === 0) {
      setError('No wallet available');
      return null;
    }

    // Check for cached credentials first
    const cached = getCachedCredentials();
    if (cached && cached.walletAddress === wallets[0].address) {
      setCredentials(cached);
      return cached;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const wallet = wallets[0];
      console.log('🔐 Generating Sourceful credentials for wallet:', wallet.address);

      // Create message with 1 year expiration
      const issuedAt = new Date();
      const expirationTime = new Date();
      expirationTime.setFullYear(expirationTime.getFullYear() + 1);

      const plainTextMessage = generateAuthMessage(
        wallet.address,
        issuedAt,
        expirationTime
      );

      console.log('🔐 Requesting signature for message...');

      // Sign the message - no uiOptions for smoother auto-sign with embedded wallets
      const messageBytes = new TextEncoder().encode(plainTextMessage);
      const signatureResult = await signMessage({
        message: messageBytes,
        wallet: wallet,
      });

      console.log('🔐 Signature received:', signatureResult);

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

      console.log('🔐 Sourceful credentials generated successfully');
      return newCredentials;
    } catch (err) {
      console.error('🔐 Failed to generate credentials:', err);
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
