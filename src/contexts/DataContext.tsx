import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useSourcefulAuth } from '../hooks/useSourcefulAuth';
import type { AuthCredentials } from '../api/sourceful-auth';

interface DataContextType {
  credentials: AuthCredentials | null;
  isReady: boolean;
  isGeneratingCredentials: boolean;
  credentialError: string | null;
  generateCredentials: () => Promise<AuthCredentials | null>;
  clearCredentials: () => void;
  needsCredentials: boolean;
  // Demo mode
  isDemoMode: boolean;
  setDemoMode: (demo: boolean) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function useDataContext() {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useDataContext must be used within DataProvider');
  }
  return context;
}

interface DataProviderProps {
  children: ReactNode;
}

export function DataProvider({ children }: DataProviderProps) {
  const {
    credentials,
    isGenerating,
    error,
    ready,
    hasCredentials,
    generateCredentials,
    clearAuth,
  } = useSourcefulAuth();

  // Demo mode state - persisted in localStorage
  const [isDemoMode, setIsDemoMode] = useState(() => {
    const saved = localStorage.getItem('demo_mode');
    return saved === 'true';
  });

  const handleSetDemoMode = (demo: boolean) => {
    setIsDemoMode(demo);
    localStorage.setItem('demo_mode', String(demo));
  };

  // In demo mode, we're always ready
  const needsCredentials = !isDemoMode && !hasCredentials && !isGenerating;
  const isReady = isDemoMode || hasCredentials;

  // Create mock credentials for demo mode
  const demoCredentials: AuthCredentials = {
    message: 'demo-mode',
    signature: 'demo-signature',
    walletAddress: 'demo-wallet',
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };

  return (
    <DataContext.Provider
      value={{
        credentials: isDemoMode ? demoCredentials : credentials,
        isReady,
        isGeneratingCredentials: isGenerating,
        credentialError: error,
        generateCredentials,
        clearCredentials: clearAuth,
        needsCredentials,
        isDemoMode,
        setDemoMode: handleSetDemoMode,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
