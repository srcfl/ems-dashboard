import { usePrivy } from '@privy-io/react-auth';
import { useCallback, useState } from 'react';

export function useAuth() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const [userSites, setUserSites] = useState<string[]>([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const walletAddress = user?.wallet?.address || null;

  const fetchUserSites = useCallback(async () => {
    if (!walletAddress) return;

    setIsLoadingSites(true);
    setError(null);

    try {
      const response = await fetch(`/api/wallet/${walletAddress}/sites`);
      const data = await response.json();
      setUserSites(data.sites || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sites');
    } finally {
      setIsLoadingSites(false);
    }
  }, [walletAddress]);

  const handleLogin = useCallback(async () => {
    try {
      await login();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }, [login]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      setUserSites([]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  }, [logout]);

  return {
    ready,
    isAuthenticated: authenticated,
    isLoading: !ready || isLoadingSites,
    walletAddress,
    userSites,
    error,
    login: handleLogin,
    logout: handleLogout,
    fetchUserSites,
  };
}
