import { PrivyProvider as PrivyProviderBase } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const solanaConnectors = toSolanaWalletConnectors({
  shouldAutoConnect: true,
});

type EnvType = 'production' | 'development';

interface PrivyEnvContextType {
  env: EnvType;
  switchEnv: (env: EnvType) => void;
  appId: string;
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

function getAppId(env: EnvType): string {
  if (env === 'development') {
    return import.meta.env.VITE_PRIVY_APP_ID_DEV || '';
  }
  return import.meta.env.VITE_PRIVY_APP_ID_PROD || '';
}

interface Props {
  children: ReactNode;
}

export function PrivyProvider({ children }: Props) {
  const [env] = useState<EnvType>(getStoredEnv);
  const [isReady, setIsReady] = useState(false);

  const appId = getAppId(env);

  useEffect(() => {
    setIsReady(true);
    console.log('🔧 Privy Config:', {
      env,
      appId: appId ? `${appId.slice(0, 8)}...` : 'MISSING!',
      origin: window.location.origin,
    });
  }, [env, appId]);

  const switchEnv = (newEnv: EnvType) => {
    if (newEnv !== env) {
      console.log(`🔄 Switching Privy env from ${env} to ${newEnv}`);
      sessionStorage.setItem('privy_env', newEnv);
      // Reload to reinitialize Privy with new app ID
      window.location.reload();
    }
  };

  if (!isReady) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!appId) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-red-400">Privy App ID not configured for {env} environment</div>
      </div>
    );
  }

  return (
    <PrivyEnvContext.Provider value={{ env, switchEnv, appId }}>
      <PrivyProviderBase
        key={`privy-${env}-${appId}`}
        appId={appId}
        config={{
          appearance: {
            theme: 'dark',
            accentColor: env === 'development' ? '#8B5CF6' : '#EAB308',
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
    </PrivyEnvContext.Provider>
  );
}
