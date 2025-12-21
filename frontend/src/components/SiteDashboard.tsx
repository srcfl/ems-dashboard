import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, Pencil, Check, X } from 'lucide-react';
import { getSite } from '../api/data-service';
import { useDataContext } from '../contexts/DataContext';
import type { SiteOverview, DER } from '../api/types';
import { BatteryCard } from './BatteryCard';
import { PVCard } from './PVCard';
import { MeterCard } from './MeterCard';
import { EVChargerCard } from './EVChargerCard';
import { LoadCard } from './LoadCard';
import { PowerChart } from './PowerChart';
import { EMSPanel } from './EMSPanel';

// Local storage for site names (shared with UserSites)
function getSiteName(siteId: string): string | null {
  const names = JSON.parse(localStorage.getItem('site_names') || '{}');
  return names[siteId] || null;
}

function saveSiteName(siteId: string, name: string) {
  const names = JSON.parse(localStorage.getItem('site_names') || '{}');
  names[siteId] = name;
  localStorage.setItem('site_names', JSON.stringify(names));
}

interface SiteDashboardProps {
  siteId: string;
}

export function SiteDashboard({ siteId }: SiteDashboardProps) {
  const { dataSource, credentials } = useDataContext();
  const [site, setSite] = useState<SiteOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState('-1h');
  const [siteName, setSiteName] = useState(() => getSiteName(siteId) || '');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState(siteName);

  // Update site name when siteId changes
  useEffect(() => {
    const name = getSiteName(siteId) || '';
    setSiteName(name);
    setEditNameValue(name);
  }, [siteId]);

  const handleSaveName = () => {
    saveSiteName(siteId, editNameValue);
    setSiteName(editNameValue);
    setIsEditingName(false);
  };

  const handleCancelEdit = () => {
    setEditNameValue(siteName);
    setIsEditingName(false);
  };

  const fetchSite = useCallback(async () => {
    // Wait for credentials when using API mode
    if (dataSource === 'api' && !credentials) {
      return;
    }

    try {
      const data = await getSite(siteId, { dataSource, credentials });
      setSite(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }, [siteId, dataSource, credentials]);

  useEffect(() => {
    setLoading(true);
    fetchSite();
  }, [fetchSite]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchSite, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSite]);

  const categorizedDers = site?.ders.reduce(
    (acc, der) => {
      const type = der.type.toLowerCase();
      if (type === 'battery') {
        acc.batteries.push(der);
      } else if (type === 'pv') {
        acc.pvs.push(der);
      } else if (['meter', 'energymeter', 'p1meter'].includes(type)) {
        acc.meters.push(der);
      } else if (['ev_charger', 'v2x_charger', 'charger'].includes(type)) {
        acc.evChargers.push(der);
      }
      return acc;
    },
    { batteries: [] as DER[], pvs: [] as DER[], meters: [] as DER[], evChargers: [] as DER[] }
  );

  if (loading && !site) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading site data...</div>
      </div>
    );
  }

  if (error && !site) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchSite}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!site) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          {isEditingName ? (
            <div className="flex items-center gap-2 mb-1">
              <input
                type="text"
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                placeholder="Enter site name..."
                className="px-3 py-1 text-xl font-bold bg-gray-800 border border-gray-600 rounded-lg focus:border-yellow-500 focus:outline-none text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveName();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
              />
              <button
                onClick={handleSaveName}
                className="p-1.5 text-green-400 hover:text-green-300 bg-gray-700 rounded"
              >
                <Check className="w-5 h-5" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1.5 text-gray-400 hover:text-gray-300 bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-white">
                {siteName || 'Unnamed Site'}
              </h2>
              <button
                onClick={() => setIsEditingName(true)}
                className="p-1 text-gray-500 hover:text-gray-300"
                title="Edit site name"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
          <p className="text-gray-500 text-sm font-mono">{siteId}</p>
          {lastUpdate && (
            <p className="text-gray-500 text-xs">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 text-sm"
          >
            <option value="-1h">Last Hour</option>
            <option value="-6h">Last 6 Hours</option>
            <option value="-24h">Last 24 Hours</option>
            <option value="-7d">Last 7 Days</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Auto-refresh
          </label>
          <button
            onClick={fetchSite}
            className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LoadCard loadW={site.load_w} />
        {site.total_pv_power_w !== 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-yellow-500">
            <p className="text-gray-400 text-sm">Total Solar</p>
            <p className="text-2xl font-bold text-yellow-400">
              {Math.abs(site.total_pv_power_w) >= 1000
                ? `${(Math.abs(site.total_pv_power_w) / 1000).toFixed(2)} kW`
                : `${Math.abs(site.total_pv_power_w).toFixed(0)} W`}
            </p>
          </div>
        )}
        {site.total_battery_power_w !== 0 && (
          <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500">
            <p className="text-gray-400 text-sm">Total Battery</p>
            <p className={`text-2xl font-bold ${site.total_battery_power_w > 0 ? 'text-green-400' : 'text-orange-400'}`}>
              {site.total_battery_power_w > 0 ? '+' : ''}
              {Math.abs(site.total_battery_power_w) >= 1000
                ? `${(site.total_battery_power_w / 1000).toFixed(2)} kW`
                : `${site.total_battery_power_w.toFixed(0)} W`}
            </p>
            {site.battery_soc_avg && (
              <p className="text-gray-500 text-sm mt-1">
                Avg SoC: {(site.battery_soc_avg * 100).toFixed(0)}%
              </p>
            )}
          </div>
        )}
        <div className={`bg-gray-800 rounded-xl p-6 border-l-4 ${site.total_grid_power_w > 0 ? 'border-red-500' : 'border-green-500'}`}>
          <p className="text-gray-400 text-sm">Grid</p>
          <p className={`text-2xl font-bold ${site.total_grid_power_w > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {site.total_grid_power_w > 0 ? 'Import ' : site.total_grid_power_w < 0 ? 'Export ' : ''}
            {Math.abs(site.total_grid_power_w) >= 1000
              ? `${(Math.abs(site.total_grid_power_w) / 1000).toFixed(2)} kW`
              : `${Math.abs(site.total_grid_power_w).toFixed(0)} W`}
          </p>
        </div>
      </div>

      {/* Power Chart */}
      <PowerChart siteId={siteId} timeRange={timeRange} />

      {/* EMS Panel */}
      <EMSPanel siteId={siteId} />

      {/* DER Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categorizedDers?.batteries.map((battery, idx) => (
          <BatteryCard key={`battery-${idx}`} battery={battery} />
        ))}
        {categorizedDers?.pvs.map((pv, idx) => (
          <PVCard key={`pv-${idx}`} pv={pv} />
        ))}
        {categorizedDers?.meters.map((meter, idx) => (
          <MeterCard key={`meter-${idx}`} meter={meter} />
        ))}
        {categorizedDers?.evChargers.map((charger, idx) => (
          <EVChargerCard key={`ev-${idx}`} charger={charger} />
        ))}
      </div>

      {/* DER Summary */}
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-gray-400 text-sm font-medium mb-4">
          Connected DERs ({site.ders.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left py-2">Type</th>
                <th className="text-left py-2">Make</th>
                <th className="text-left py-2">Device Serial</th>
                <th className="text-right py-2">Power</th>
              </tr>
            </thead>
            <tbody>
              {site.ders.map((der, idx) => (
                <tr key={idx} className="border-b border-gray-700/50">
                  <td className="py-2 text-white">{der.type}</td>
                  <td className="py-2 text-gray-400">{der.make || '-'}</td>
                  <td className="py-2 text-gray-400 font-mono text-xs">
                    {der.device_serial?.slice(0, 20) || '-'}...
                  </td>
                  <td className="py-2 text-right text-white">
                    {der.power_w.toFixed(0)} W
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
