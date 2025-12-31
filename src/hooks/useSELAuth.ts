import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';
import { selClient } from '../api/sel-client';
import { base58EncodeSignature } from '../api/sourceful-auth';

const SEL_SESSION_KEY = 'sel_session';
const SESSION_DURATION_SECONDS = 3600; // 1 hour

interface SELSession {
  walletAddress: string;
  signature: string;
  expiry: number; // Unix timestamp
}

function getCachedSession(): SELSession | null {
  try {
    const stored = localStorage.getItem(SEL_SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as SELSession;

    // Check if session is still valid (with 5 min buffer)
    const now = Math.floor(Date.now() / 1000);
    if (session.expiry < now + 300) {
      localStorage.removeItem(SEL_SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    localStorage.removeItem(SEL_SESSION_KEY);
    return null;
  }
}

function cacheSession(session: SELSession) {
  localStorage.setItem(SEL_SESSION_KEY, JSON.stringify(session));
}

export function clearSELSession() {
  localStorage.removeItem(SEL_SESSION_KEY);
}

/**
 * Hook to configure SEL client with session-based wallet authentication
 *
 * Signs a session message once (valid for 1 hour), caches it, and reuses
 * for all subsequent requests. No need to sign every request.
 */
export function useSELAuth() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();
  const [session, setSession] = useState<SELSession | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Try to load cached session on mount
  useEffect(() => {
    if (authenticated && wallets.length > 0) {
      const cached = getCachedSession();
      if (cached && cached.walletAddress === wallets[0].address) {
        setSession(cached);
      }
    }
  }, [authenticated, wallets]);

  // Clear session on logout
  useEffect(() => {
    if (!authenticated) {
      setSession(null);
      clearSELSession();
    }
  }, [authenticated]);

  // Generate a new session
  const generateSession = useCallback(async (): Promise<SELSession | null> => {
    if (!authenticated || !wallets || wallets.length === 0) {
      return null;
    }

    // Check for valid cached session first
    const cached = getCachedSession();
    if (cached && cached.walletAddress === wallets[0].address) {
      setSession(cached);
      return cached;
    }

    setIsGenerating(true);

    try {
      const wallet = wallets[0];
      const expiry = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;

      // Session message format that backend will verify
      const message = `SEL-SESSION:${wallet.address}:${expiry}`;
      const messageBytes = new TextEncoder().encode(message);

      console.log('🔐 Generating SEL session for wallet:', wallet.address);

      const signatureResult = await signMessage({
        message: messageBytes,
        wallet: wallet,
      });

      // Extract signature bytes
      let signatureBytes: Uint8Array;
      const result = signatureResult as unknown;
      if (result && typeof result === 'object' && 'signature' in result) {
        signatureBytes = (result as { signature: Uint8Array }).signature;
      } else if (result instanceof Uint8Array) {
        signatureBytes = result;
      } else {
        throw new Error('Unexpected signature format');
      }

      const newSession: SELSession = {
        walletAddress: wallet.address,
        signature: base58EncodeSignature(signatureBytes),
        expiry,
      };

      cacheSession(newSession);
      setSession(newSession);
      setIsGenerating(false);

      console.log('🔐 SEL session generated, valid until:', new Date(expiry * 1000));
      return newSession;
    } catch (err) {
      console.error('🔐 Failed to generate SEL session:', err);
      setIsGenerating(false);
      return null;
    }
  }, [authenticated, wallets, signMessage]);

  // Configure SEL client with session
  useEffect(() => {
    if (session) {
      selClient.setSession(session.walletAddress, session.signature, session.expiry);
    } else {
      selClient.clearSession();
    }
  }, [session]);

  // NOTE: No auto-generate - session is created on-demand when user
  // tries to make changes (add/edit automation). This avoids unnecessary
  // signing prompts just for viewing data.

  return {
    // isReady means we CAN make authenticated requests (have valid session)
    isReady: authenticated && wallets.length > 0 && !!session,
    // canSign means we're authenticated and could sign if needed
    canSign: authenticated && wallets.length > 0,
    walletAddress: wallets.length > 0 ? wallets[0].address : null,
    hasSession: !!session,
    isGenerating,
    generateSession,
    clearSession: clearSELSession,
  };
}
