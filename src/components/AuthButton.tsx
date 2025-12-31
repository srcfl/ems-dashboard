import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { User, LogOut, Loader2 } from 'lucide-react';

export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();

  if (!ready) {
    return (
      <button
        disabled
        className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-gray-400 rounded-lg"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading...
      </button>
    );
  }

  if (authenticated && user) {
    // Show email if available, otherwise wallet address
    const email = user.email?.address;
    const walletAddress = wallets?.[0]?.address;
    const displayName = email
      ? email
      : walletAddress
        ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
        : 'Connected';

    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-700 rounded-lg">
          <User className="w-4 h-4 text-green-400" />
          <span className="text-sm text-gray-300 truncate max-w-[150px]">{displayName}</span>
        </div>
        <button
          onClick={logout}
          className="p-2 bg-gray-700 text-gray-400 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={login}
      className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors"
    >
      <User className="w-4 h-4" />
      Sign In
    </button>
  );
}
