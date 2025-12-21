import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useSettings, type DataSource } from './SettingsContext';
import { useSourcefulAuth } from '../hooks/useSourcefulAuth';
import type { AuthCredentials } from '../api/sourceful-auth';

interface DataContextType {
  dataSource: DataSource;
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
  const { settings } = useSettings();
  const {
    credentials,
    isGenerating,
    error,
    ready,
    hasCredentials,
    generateCredentials,
    clearAuth,
  } = useSourcefulAuth();

  // Log when API mode is selected but credentials are needed
  useEffect(() => {
    if (settings.dataSource === 'api' && ready && !hasCredentials && !isGenerating) {
      console.log('🔐 API mode selected, credentials needed. User must click to sign.');
    }
  }, [settings.dataSource, ready, hasCredentials, isGenerating]);

  const needsCredentials = settings.dataSource === 'api' && !hasCredentials && !isGenerating;
  const isReady = settings.dataSource === 'influxdb' || (settings.dataSource === 'api' && hasCredentials);

  return (
    <DataContext.Provider
      value={{
        dataSource: settings.dataSource,
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
