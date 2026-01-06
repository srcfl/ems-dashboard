import { Buffer } from 'buffer';

// Polyfill Buffer for browser (needed by bs58)
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

// Force dark mode - add class to html element
document.documentElement.classList.add('dark');

import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { PrivyProvider } from './auth/PrivyProvider.tsx';
import { DataProvider } from './contexts/DataContext.tsx';

// Note: StrictMode removed to avoid double-render issues with Privy
createRoot(document.getElementById('root')!).render(
  <PrivyProvider>
    <DataProvider>
      <App />
    </DataProvider>
  </PrivyProvider>
);
