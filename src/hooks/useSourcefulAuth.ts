import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignMessage, useCreateWallet } from '@privy-io/react-auth/solana';
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
  const { ready, authenticated, user } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const { createWallet } = useCreateWallet();
  const [credentials, setCredentials] = useState<AuthCredentials | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref guards
  const autoGenerateAttempted = useRef(false);
  const walletCreationAttempted = useRef(false);

  // Find embedded wallet address from Privy user's linked accounts
  const embeddedWalletAddress = useMemo(() => {
    const linked = user?.linkedAccounts?.find(
      (a) => a.type === 'wallet' && (a.walletClientType === 'privy' || a.walletClientType === 'privy-v2'),
    );
    return linked && 'address' in linked ? linked.address : null;
  }, [user?.linkedAccounts]);

  // Create embedded wallet if user doesn't have one
  useEffect(() => {
    if (!authenticated || !user || !ready) return;
    if (embeddedWalletAddress) return; // already has one
    if (walletCreationAttempted.current) return;

    walletCreationAttempted.current = true;
    console.log('[AUTH] No embedded wallet found, creating one...');
    createWallet().then(({ wallet }) => {
      console.log('[AUTH] Embedded wallet created:', wallet.address);
    }).catch((err) => {
      // "already exists" is fine — means it exists but wasn't in linkedAccounts yet
      console.log('[AUTH] createWallet result:', err?.message || err);
    });
  }, [authenticated, user, ready, embeddedWalletAddress, createWallet]);

  // Get the embedded wallet from the wallets array, falling back to first available
  const getPreferredWallet = useCallback(() => {
    if (embeddedWalletAddress) {
      const embedded = wallets.find((w) => w.address === embeddedWalletAddress);
      if (embedded) return embedded;
    }
    return wallets[0];
  }, [wallets, embeddedWalletAddress]);

  // Load cached credentials on mount, or auto-generate if none exist
  useEffect(() => {
    if (!authenticated || wallets.length === 0) {
      if (!authenticated) {
        setCredentials(null);
        clearCredentials();
      }
      autoGenerateAttempted.current = false;
      return;
    }

    // Accept cached credentials if they match ANY connected wallet
    const cached = getCachedCredentials();
    if (cached) {
      const cachedWalletConnected = wallets.some((w) => w.address === cached.walletAddress);
      if (cachedWalletConnected) {
        setCredentials(cached);
        return;
      }
      // Also accept if cached wallet matches the embedded wallet (might not be in wallets array yet)
      if (embeddedWalletAddress && cached.walletAddress === embeddedWalletAddress) {
        setCredentials(cached);
        return;
      }
      clearCredentials();
      setCredentials(null);
    }

    // Wait for user object and embedded wallet before generating
    if (!user) return;
    if (!embeddedWalletAddress) return; // wait for embedded wallet to be created

    // Only generate once the embedded wallet is available in the wallets array
    const embeddedInWallets = wallets.some((w) => w.address === embeddedWalletAddress);
    if (!embeddedInWallets) return; // wait for it to appear

    if (!autoGenerateAttempted.current) {
      autoGenerateAttempted.current = true;
      generateCredentials();
    }
  }, [authenticated, wallets, user, embeddedWalletAddress]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateCredentials = useCallback(async (): Promise<AuthCredentials | null> => {
    if (!ready) {
      setError('Privy is not ready');
      return null;
    }

    if (!wallets || wallets.length === 0) {
      setError('No wallet available. Please ensure you are logged in.');
      return null;
    }

    const wallet = getPreferredWallet();
    if (!wallet?.address) {
      setError('Wallet not connected. Please try logging out and back in.');
      return null;
    }

    // Accept cached credentials matching any connected wallet
    const cached = getCachedCredentials();
    if (cached && wallets.some((w) => w.address === cached.walletAddress)) {
      setCredentials(cached);
      return cached;
    }

    console.log('[AUTH] Signing with wallet:', wallet.address, '(embedded:', wallet.address === embeddedWalletAddress, ')');
    setIsGenerating(true);
    setError(null);

    try {
      const issuedAt = new Date();
      const expirationTime = new Date();
      expirationTime.setFullYear(expirationTime.getFullYear() + 1);

      const plainTextMessage = generateAuthMessage(
        wallet.address,
        issuedAt,
        expirationTime
      );

      const messageBytes = new TextEncoder().encode(plainTextMessage);

      const signaturePromise = signMessage({
        message: messageBytes,
        wallet: wallet,
      });

      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Signing timed out. Please try again.')), 30000);
      });

      const signatureResult = await Promise.race([signaturePromise, timeoutPromise]);

      let signatureBytes: Uint8Array;
      const result = signatureResult as unknown;
      if (result && typeof result === 'object' && 'signature' in result) {
        signatureBytes = (result as { signature: Uint8Array }).signature;
      } else if (result instanceof Uint8Array) {
        signatureBytes = result;
      } else {
        throw new Error('Unexpected signature format');
      }

      const base58Message = base58Encode(plainTextMessage);
      const base58Signature = base58EncodeSignature(signatureBytes);

      const newCredentials: AuthCredentials = {
        message: base58Message,
        signature: base58Signature,
        walletAddress: wallet.address,
        issuedAt: issuedAt.toISOString(),
        expiresAt: expirationTime.toISOString(),
      };

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
  }, [ready, wallets, signMessage, getPreferredWallet, embeddedWalletAddress]);

  const clearAuth = useCallback(() => {
    setCredentials(null);
    clearCredentials();
    setError(null);
    autoGenerateAttempted.current = false;
    walletCreationAttempted.current = false;
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
