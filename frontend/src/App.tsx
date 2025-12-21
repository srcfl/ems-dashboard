import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Zap, Loader2, Settings } from 'lucide-react';
import { SiteDashboard } from './components/SiteDashboard';
import { AuthButton } from './components/AuthButton';
import { UserSites } from './components/UserSites';
import { SettingsModal } from './components/SettingsModal';
import { useSettings } from './contexts/SettingsContext';
import { usePrivyEnv } from './auth/PrivyProvider';

function App() {
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const { ready, authenticated, login } = usePrivy();
  const { settings } = useSettings();
  const { env } = usePrivyEnv();

  // Show loading state while Privy initializes
  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold text-white">EMS Dashboard</h1>
                <p className="text-gray-500 text-sm">Sourceful Energy</p>
              </div>
            </div>
          </div>
        </header>

        {/* Login Content */}
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <Zap className="w-20 h-20 text-yellow-400 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">
              Welcome to EMS Dashboard
            </h2>
            <p className="text-gray-400 mb-8">
              Sign in to view and manage your energy sites.
            </p>
            <button
              onClick={login}
              className="px-8 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors font-medium text-lg"
            >
              Sign In
            </button>
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-gray-800 border-t border-gray-700">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-gray-500 text-sm">
            <span>Sourceful Energy Management System</span>
            <div className="flex items-center gap-2">
              <StatusBadges dataSource={settings.dataSource} env={env} />
              <button
                onClick={() => setShowSettings(true)}
                className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>
        </footer>
        <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      </div>
    );
  }

  // Authenticated - show dashboard
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-yellow-400" />
              <div>
                <h1 className="text-xl font-bold">EMS Dashboard</h1>
                <p className="text-gray-500 text-sm">Sourceful Energy</p>
              </div>
            </div>
            <AuthButton />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Show user's sites */}
        <div className="mb-6">
          <UserSites
            selectedSite={selectedSite}
            onSelectSite={setSelectedSite}
          />
        </div>

        {selectedSite ? (
          <SiteDashboard siteId={selectedSite} />
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Zap className="w-16 h-16 text-gray-600 mb-4" />
            <h2 className="text-2xl font-bold text-gray-400 mb-2">
              Select a Site
            </h2>
            <p className="text-gray-500 max-w-md">
              Select one of your sites above to view its dashboard.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-gray-500 text-sm">
          <span>Sourceful Energy Management System</span>
          <div className="flex items-center gap-2">
            <StatusBadges dataSource={settings.dataSource} env={env} />
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-gray-700"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </footer>
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}

// Status badges component
function StatusBadges({ dataSource, env }: { dataSource: string; env: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${
          dataSource === 'api'
            ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700/50'
            : 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
        }`}
      >
        {dataSource === 'api' ? 'API' : 'InfluxDB'}
      </span>
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded ${
          env === 'production'
            ? 'bg-gray-700/50 text-gray-300 border border-gray-600/50'
            : 'bg-purple-900/50 text-purple-300 border border-purple-700/50'
        }`}
      >
        {env === 'production' ? 'PROD' : 'DEV'}
      </span>
    </div>
  );
}

export default App;
