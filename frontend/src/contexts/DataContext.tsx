import { createContext, useContext, useEffect, type ReactNode } from 'react';
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

  // Log when credentials are needed
  useEffect(() => {
    if (ready && !hasCredentials && !isGenerating) {
      console.log('🔐 Credentials needed. User must click to sign.');
    }
  }, [ready, hasCredentials, isGenerating]);

  const needsCredentials = !hasCredentials && !isGenerating;
  const isReady = hasCredentials;

  return (
    <DataContext.Provider
      value={{
        credentials,
        isReady,
        isGeneratingCredentials: isGenerating,
        credentialError: error,
        generateCredentials,
        clearCredentials: clearAuth,
        needsCredentials,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}
