import { usePrivyEnv } from '../auth/PrivyProvider';
import { usePrivy } from '@privy-io/react-auth';
import { Terminal, Building2 } from 'lucide-react';

export function EnvSwitcher() {
  const { env, switchEnv } = usePrivyEnv();
  const { logout, authenticated } = usePrivy();

  const handleSwitch = async () => {
    const newEnv = env === 'production' ? 'development' : 'production';

    // Logout first if authenticated, then switch
    if (authenticated) {
      await logout();
    }
    switchEnv(newEnv);
  };

  const isDev = env === 'development';

  return (
    <button
      onClick={handleSwitch}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors ${
        isDev
          ? 'bg-purple-900/50 text-purple-300 hover:bg-purple-900/70 border border-purple-700/50'
          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 border border-gray-600/50'
      }`}
      title={`Switch to ${isDev ? 'production' : 'development'} environment`}
    >
      {isDev ? (
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
  );
}
