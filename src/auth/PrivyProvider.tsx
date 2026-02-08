import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createContext, useContext, useState, type ReactNode } from 'react';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: false,
});

type EnvType = 'production' | 'development';

interface PrivyEnvContextType {
  env: EnvType;
  switchEnv: (env: EnvType) => void;
}

const PrivyEnvContext = createContext<PrivyEnvContextType | undefined>(undefined);

export function usePrivyEnv() {
  const context = useContext(PrivyEnvContext);
  if (!context) {
    throw new Error('usePrivyEnv must be used within PrivyProvider');
  }
  return context;
}

function getStoredEnv(): EnvType {
  if (typeof window !== 'undefined') {
    const stored = sessionStorage.getItem('privy_env');
    if (stored === 'development' || stored === 'production') {
      return stored;
    }
  }
  return 'production';
}

// Sourceful Energy Privy App IDs
const SOURCEFUL_PRIVY_APP_ID_PROD = 'cmeh0sbu300bfju0b7gwxctnk';
const SOURCEFUL_PRIVY_APP_ID_DEV = 'cmdpnpacq01jtl40iof3ptm4u';

function getAppId(env: EnvType): string {
  if (env === 'development') {
    return import.meta.env.VITE_PRIVY_APP_ID_DEV || SOURCEFUL_PRIVY_APP_ID_DEV;
  }
  return import.meta.env.VITE_PRIVY_APP_ID_PROD || SOURCEFUL_PRIVY_APP_ID_PROD;
}

interface Props {
  children: ReactNode;
}

export function PrivyProvider({ children }: Props) {
  const [env] = useState<EnvType>(getStoredEnv);

  const appId = getAppId(env);

  const switchEnv = (newEnv: EnvType) => {
    if (newEnv !== env) {
      sessionStorage.setItem('privy_env', newEnv);
      // Reload to reinitialize Privy with new app ID
      window.location.reload();
    }
  };

  if (!appId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Privy App ID not configured for {env} environment</div>
      </div>
    );
  }

  return (
    <PrivyEnvContext.Provider value={{ env, switchEnv }}>
      <PrivyProviderBase
        key={`privy-${env}-${appId}`}
        appId={appId}
        config={{
          appearance: {
            theme: 'dark',
            accentColor: env === 'development' ? '#8B5CF6' : '#00FF84', // Sourceful neon green
            walletChainType: 'solana-only',
            walletList: ['phantom', 'solflare'],
          },
          loginMethods: ['email', 'wallet'],
          embeddedWallets: {
            solana: {
              createOnLogin: 'all-users',
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
    </PrivyEnvContext.Provider>
  );
}
