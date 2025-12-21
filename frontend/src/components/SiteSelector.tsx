import { useEffect, useState } from 'react';
import { getSites } from '../api/client';

interface SiteSelectorProps {
  selectedSite: string | null;
  onSelectSite: (siteId: string) => void;
}

export function SiteSelector({ selectedSite, onSelectSite }: SiteSelectorProps) {
  const [sites, setSites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSites()
      .then((response) => {
        setSites(response.sites);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse bg-gray-700 h-10 w-64 rounded"></div>
    );
  }

  if (error) {
    return (
      <div className="text-red-400">Error loading sites: {error}</div>
    );
  }

  return (
    <select
      value={selectedSite || ''}
      onChange={(e) => onSelectSite(e.target.value)}
      className="bg-gray-800 text-white px-4 py-2 rounded-lg border border-gray-600 focus:border-blue-500 focus:outline-none w-full max-w-md"
    >
      <option value="">Select a site...</option>
      {sites.map((site) => (
        <option key={site} value={site}>
          {site}
        </option>
      ))}
    </select>
  );
}
