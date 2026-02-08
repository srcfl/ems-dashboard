import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets } from '@privy-io/react-auth/solana';
import { Home, Loader2, AlertCircle, Pencil, Check, X } from 'lucide-react';
import { useDataContext } from '../contexts/DataContext';
import { getSitesWithNames } from '../api/data-service';
import type { SiteInfo } from '../api/sourceful-client';

// Local storage for user-customized site names
// The API names are stored separately and used as fallback
const USER_NAMES_KEY = 'site_names_user';
const API_NAMES_KEY = 'site_names_api';

function safeParse(key: string): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function getSiteName(siteId: string): string | null {
  // First check user-customized names
  const userNames = safeParse(USER_NAMES_KEY);
  if (userNames[siteId]) return userNames[siteId];
  // Fall back to API-provided names
  const apiNames = safeParse(API_NAMES_KEY);
  return apiNames[siteId] || null;
}

function setSiteName(siteId: string, name: string) {
  const names = safeParse(USER_NAMES_KEY);
  names[siteId] = name;
  localStorage.setItem(USER_NAMES_KEY, JSON.stringify(names));
}

function cacheApiSiteNames(sites: SiteInfo[]) {
  const apiNames: Record<string, string> = {};
  for (const site of sites) {
    if (site.name) {
      apiNames[site.id] = site.name;
    }
  }
  localStorage.setItem(API_NAMES_KEY, JSON.stringify(apiNames));
}

interface UserSitesProps {
  onSelectSite: (siteId: string) => void;
  selectedSite: string | null;
}

export function UserSites({ onSelectSite, selectedSite }: UserSitesProps) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { credentials, isGeneratingCredentials, credentialError, generateCredentials, needsCredentials } = useDataContext();
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get the first wallet (embedded or external)
  const walletAddress = wallets?.[0]?.address;

  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setSites([]);
      return;
    }

    if (!credentials) return;

    setLoading(true);
    setError(null);

    getSitesWithNames(credentials)
      .then((siteInfoList) => {
        // Cache API-provided names
        cacheApiSiteNames(siteInfoList);
        // Extract just the IDs for the sites list
        setSites(siteInfoList.map(s => s.id));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [authenticated, walletAddress, credentials]);

  if (!authenticated) {
    return null;
  }

  // Show credential generation state
  if (isGeneratingCredentials) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-2 text-yellow-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Authenticating with Sourceful API...
        </div>
        <p className="text-gray-500 text-xs mt-2">
          Please approve the signature request in your wallet.
        </p>
      </div>
    );
  }

  // Credentials are auto-generated - show error with retry if it failed
  if (needsCredentials) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 text-center">
        {credentialError ? (
          <>
            <p className="text-red-400 text-sm mb-3">{credentialError}</p>
            <button
              onClick={() => generateCredentials()}
              className="px-6 py-2.5 bg-yellow-600 text-white rounded-lg hover:bg-yellow-500 transition-colors font-medium"
            >
              Retry Sign
            </button>
          </>
        ) : (
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting...</span>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading your sites...
        </div>
        {walletAddress && (
          <p className="text-gray-500 text-sm mt-2 font-mono">
            Wallet: {walletAddress}
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-400">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
        <p className="text-gray-400">No sites found for your wallet.</p>
        {walletAddress && (
          <p className="text-gray-500 text-sm mt-1 font-mono">
            Wallet: {walletAddress}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-400 flex items-center gap-2">
          <Home className="w-4 h-4" />
          Your Sites ({sites.length})
        </h3>
        {walletAddress && (
          <span className="text-xs text-gray-500 font-mono">
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {sites.map((siteId) => (
          <SiteCard
            key={siteId}
            siteId={siteId}
            isSelected={selectedSite === siteId}
            onSelect={() => onSelectSite(siteId)}
          />
        ))}
      </div>
    </div>
  );
}

interface SiteCardProps {
  siteId: string;
  isSelected: boolean;
  onSelect: () => void;
}

function SiteCard({ siteId, isSelected, onSelect }: SiteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(() => getSiteName(siteId) || '');
  const [editValue, setEditValue] = useState(name);

  const handleSave = () => {
    setSiteName(siteId, editValue);
    setName(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(name);
    setIsEditing(false);
  };

  return (
    <div
      className={`rounded-lg p-3 transition-colors cursor-pointer ${
        isSelected
          ? 'bg-yellow-600/20 border-2 border-yellow-500'
          : 'bg-gray-700 border-2 border-transparent hover:border-gray-500'
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder="Site name..."
                className="w-full px-2 py-1 text-sm bg-gray-800 border border-gray-600 rounded focus:border-yellow-500 focus:outline-none"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
              />
              <button
                onClick={handleSave}
                className="p-1 text-green-400 hover:text-green-300"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1 text-gray-400 hover:text-gray-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className={`font-medium ${name ? 'text-white' : 'text-gray-400'}`}>
                {name || 'Unnamed Site'}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 text-gray-500 hover:text-gray-300"
                title="Edit name"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="text-xs text-gray-500 font-mono mt-1 truncate" title={siteId}>
            {siteId}
          </div>
        </div>
      </div>
    </div>
  );
}
