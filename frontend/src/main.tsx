import { Buffer } from 'buffer';

// Polyfill Buffer for browser (needed by bs58)
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PrivyProvider } from './auth/PrivyProvider.tsx';
import { SettingsProvider } from './contexts/SettingsContext.tsx';
import { DataProvider } from './contexts/DataContext.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <PrivyProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </PrivyProvider>
    </SettingsProvider>
  </StrictMode>
);
