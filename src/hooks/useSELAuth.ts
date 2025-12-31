import { useCallback, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSignMessage } from '@privy-io/react-auth/solana';
import { selClient, type SignRequestFn } from '../api/sel-client';
import { base58EncodeSignature } from '../api/sourceful-auth';

/**
 * Hook to configure SEL client with wallet authentication
 *
 * This hook sets up the SEL client to sign requests using the user's
 * Solana wallet. Each request to protected SEL endpoints will include:
 * - X-Wallet-Address: The user's wallet public key (base58)
 * - X-Signature: Ed25519 signature of "{method}:{path}:{timestamp}"
 * - X-Timestamp: Unix timestamp in seconds
 */
export function useSELAuth() {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage } = useSignMessage();

  // Create the signing function for SEL requests
  const createSigningFunction = useCallback((): SignRequestFn | null => {
    if (!authenticated || !wallets || wallets.length === 0) {
      return null;
    }

    const wallet = wallets[0];

    return async (message: string) => {
      const messageBytes = new TextEncoder().encode(message);

      const signatureResult = await signMessage({
        message: messageBytes,
        wallet: wallet,
      });

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

      return {
        signature: base58EncodeSignature(signatureBytes),
        walletAddress: wallet.address,
      };
    };
  }, [authenticated, wallets, signMessage]);

  // Configure the SEL client with the signing function
  useEffect(() => {
    const signFn = createSigningFunction();
    selClient.setSigningFunction(signFn);

    // Cleanup on unmount or when auth changes
    return () => {
      selClient.setSigningFunction(null);
    };
  }, [createSigningFunction]);

  return {
    isReady: authenticated && wallets.length > 0,
    walletAddress: wallets.length > 0 ? wallets[0].address : null,
    hasSigningCapability: selClient.hasSigningFunction(),
  };
}
