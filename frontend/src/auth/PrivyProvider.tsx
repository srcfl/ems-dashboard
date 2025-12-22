import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { useEffect, type ReactNode } from 'react';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

// Sourceful Energy Privy App ID for production
const SOURCEFUL_PRIVY_APP_ID = 'cmeh0sbu300bfju0b7gwxctnk';

interface Props {
  children: ReactNode;
}

export function PrivyProvider({ children }: Props) {
  const appId = import.meta.env.VITE_PRIVY_APP_ID_PROD || SOURCEFUL_PRIVY_APP_ID;

  useEffect(() => {
    console.log('🔧 Privy Config:', {
      appId: appId ? `${appId.slice(0, 8)}...` : 'MISSING!',
      origin: window.location.origin,
    });
  }, [appId]);

  if (!appId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Privy App ID not configured</div>
      </div>
    );
  }

  return (
    <PrivyProviderBase
      appId={appId}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#EAB308',
          walletChainType: 'solana-only',
          walletList: ['phantom', 'solflare'],
        },
        loginMethods: ['email', 'wallet'],
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
      }}
    >
      {children}
    </PrivyProviderBase>
  );
}
