import { useState } from 'react';
import { X, Settings, Database, Cloud, Terminal, Building2 } from 'lucide-react';
import { useSettings, type DataSource, type Environment } from '../contexts/SettingsContext';
import { usePrivyEnv } from '../auth/PrivyProvider';
import { usePrivy } from '@privy-io/react-auth';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { settings, updateSettings } = useSettings();
  const { env, switchEnv } = usePrivyEnv();
  const { logout, authenticated } = usePrivy();
  const [pendingDataSource, setPendingDataSource] = useState<DataSource>(settings.dataSource);
  const [pendingEnv, setPendingEnv] = useState<Environment>(env);

  if (!isOpen) return null;

  const handleSave = async () => {
    // Update data source
    if (pendingDataSource !== settings.dataSource) {
      updateSettings({ dataSource: pendingDataSource });
    }

    // Switch Privy environment if changed (requires logout + reload)
    if (pendingEnv !== env) {
      if (authenticated) {
        await logout();
      }
      switchEnv(pendingEnv);
      return; // switchEnv will reload the page
    }

    onClose();
  };

  const hasChanges = pendingDataSource !== settings.dataSource || pendingEnv !== env;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-gray-800 rounded-xl border border-gray-700 shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-white">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-white rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Data Source */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Data Source
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPendingDataSource('api')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  pendingDataSource === 'api'
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <Cloud className={`w-8 h-8 ${pendingDataSource === 'api' ? 'text-yellow-400' : 'text-gray-400'}`} />
                <span className={`font-medium ${pendingDataSource === 'api' ? 'text-white' : 'text-gray-300'}`}>
                  Sourceful API
                </span>
                <span className="text-xs text-gray-500">Recommended</span>
              </button>
              <button
                onClick={() => setPendingDataSource('influxdb')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  pendingDataSource === 'influxdb'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <Database className={`w-8 h-8 ${pendingDataSource === 'influxdb' ? 'text-purple-400' : 'text-gray-400'}`} />
                <span className={`font-medium ${pendingDataSource === 'influxdb' ? 'text-white' : 'text-gray-300'}`}>
                  InfluxDB
                </span>
                <span className="text-xs text-gray-500">Advanced</span>
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {pendingDataSource === 'api'
                ? 'Uses the official Sourceful API for real-time data.'
                : 'Direct InfluxDB access for development and debugging.'}
            </p>
          </div>

          {/* Privy Environment */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Privy Environment
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPendingEnv('production')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  pendingEnv === 'production'
                    ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <Building2 className={`w-8 h-8 ${pendingEnv === 'production' ? 'text-yellow-400' : 'text-gray-400'}`} />
                <span className={`font-medium ${pendingEnv === 'production' ? 'text-white' : 'text-gray-300'}`}>
                  Production
                </span>
              </button>
              <button
                onClick={() => setPendingEnv('development')}
                className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-colors ${
                  pendingEnv === 'development'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <Terminal className={`w-8 h-8 ${pendingEnv === 'development' ? 'text-purple-400' : 'text-gray-400'}`} />
                <span className={`font-medium ${pendingEnv === 'development' ? 'text-white' : 'text-gray-300'}`}>
                  Development
                </span>
              </button>
            </div>
            {pendingEnv !== env && (
              <p className="mt-2 text-xs text-orange-400">
                Changing environment will log you out and reload the page.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              hasChanges
                ? 'bg-yellow-600 text-white hover:bg-yellow-500'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            {pendingEnv !== env ? 'Save & Reload' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
