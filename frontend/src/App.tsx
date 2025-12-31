import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Zap, Loader2, Terminal, Building2, Play } from 'lucide-react';
import { SiteDashboard } from './components/SiteDashboard';
import { AuthButton } from './components/AuthButton';
import { UserSites } from './components/UserSites';
import { usePrivyEnv } from './auth/PrivyProvider';
import { useDataContext } from './contexts/DataContext';
import { DEMO_SITE_ID, DEMO_SITE_NAME } from './api/demo-data';

function App() {
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const { ready, authenticated, login, logout } = usePrivy();
  const { env, switchEnv } = usePrivyEnv();
  const { isDemoMode, setDemoMode } = useDataContext();

  // Auto-select demo site when in demo mode
  useEffect(() => {
    if (isDemoMode && !selectedSite) {
      setSelectedSite(DEMO_SITE_ID);
    }
  }, [isDemoMode, selectedSite]);

  const handleEnvSwitch = async () => {
    const newEnv = env === 'production' ? 'development' : 'production';
    if (authenticated) {
      await logout();
    }
    switchEnv(newEnv);
  };

  const handleDemoMode = () => {
    setDemoMode(true);
    setSelectedSite(DEMO_SITE_ID);
  };

  const handleExitDemo = () => {
    setDemoMode(false);
    setSelectedSite(null);
  };

  // Loading state
  if (!ready && !isDemoMode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated and not in demo mode
  if (!authenticated && !isDemoMode) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-900 to-gray-800 flex flex-col">
        {/* Header */}
        <header className="border-b border-gray-800/50 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <img src="/sourceful-logo.png" alt="Sourceful" className="h-8" />
          </div>
        </header>

        {/* Login Content */}
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="mb-8">
              <img src="/sourceful-roundel.png" alt="Sourceful" className="w-24 h-24 mx-auto mb-6" />
              <h1 className="text-4xl font-bold text-white mb-3">
                EMS Dashboard
              </h1>
              <p className="text-gray-400 text-lg">
                Monitor and manage your energy assets in real-time
              </p>
            </div>

            <div className="space-y-4">
              <button
                onClick={login}
                className="w-full px-8 py-4 bg-amber-500 text-gray-900 rounded-xl hover:bg-amber-400 transition-all font-semibold text-lg shadow-lg shadow-amber-500/20"
              >
                Sign In with Wallet
              </button>

              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-gray-700" />
                <span className="text-gray-500 text-sm">or</span>
                <div className="flex-1 h-px bg-gray-700" />
              </div>

              <button
                onClick={handleDemoMode}
                className="w-full px-8 py-4 bg-gray-800 text-white rounded-xl hover:bg-gray-700 transition-all font-medium text-lg border border-gray-700 flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" />
                Try Demo
              </button>
            </div>

            <p className="mt-8 text-gray-500 text-sm">
              View real-time solar, battery, and grid data
            </p>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-800/50">
          <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between text-gray-500 text-sm">
            <span>Sourceful Energy</span>
            <button
              onClick={handleEnvSwitch}
              className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
                env === 'development'
                  ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-900/70 border border-purple-700/50'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700'
              }`}
            >
              {env === 'development' ? (
                <>
                  <Terminal className="w-3 h-3" />
                  DEV
                </>
              ) : (
                <>
                  <Building2 className="w-3 h-3" />
                  PROD
                </>
              )}
            </button>
          </div>
        </footer>
      </div>
    );
  }

  // Authenticated or Demo Mode - show dashboard
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800/50 border-b border-gray-700/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img src="/sourceful-logo.png" alt="Sourceful" className="h-7" />
              {isDemoMode && (
                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-medium rounded-full border border-amber-500/30">
                  DEMO
                </span>
              )}
            </div>
            {isDemoMode ? (
              <button
                onClick={handleExitDemo}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Exit Demo
              </button>
            ) : (
              <AuthButton />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Site Selector */}
        {isDemoMode ? (
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg border border-gray-700">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-white font-medium">{DEMO_SITE_NAME}</span>
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <UserSites
              selectedSite={selectedSite}
              onSelectSite={setSelectedSite}
            />
          </div>
        )}

        {selectedSite ? (
          <SiteDashboard siteId={selectedSite} />
        ) : (
          <div className="flex flex-col items-center justify-center h-96 text-center">
            <Zap className="w-16 h-16 text-gray-700 mb-4" />
            <h2 className="text-2xl font-bold text-gray-400 mb-2">
              Select a Site
            </h2>
            <p className="text-gray-500 max-w-md">
              Choose one of your sites above to view its dashboard.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
