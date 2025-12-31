import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { getSite, getTimeSeries } from '../api/data-service';
import { useDataContext } from '../contexts/DataContext';
import type { SiteOverview, DER } from '../api/types';
import { AnimatedPowerCard } from './AnimatedPowerCard';
import { BatteryCard } from './BatteryCard';
import { PVCard } from './PVCard';
import { MeterCard } from './MeterCard';
import { EVChargerCard } from './EVChargerCard';
import { PowerChart } from './PowerChart';
import { EMSPanel } from './EMSPanel';
import { ErrorBoundary } from './ErrorBoundary';
import { DataQualityStats } from './DataQualityStats';
import { AutomationPanel } from './AutomationPanel';
import { SharePanel } from './SharePanel';
import { DEMO_SITE_NAME } from '../api/demo-data';

interface SiteDashboardProps {
  siteId: string;
}

interface SparklinePoint {
  time: Date;
  value: number;
}

interface SparklineData {
  load: SparklinePoint[];
  pv: SparklinePoint[];
  battery: SparklinePoint[];
  grid: SparklinePoint[];
}

export function SiteDashboard({ siteId }: SiteDashboardProps) {
  const { credentials, isDemoMode } = useDataContext();
  const [site, setSite] = useState<SiteOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [timeRange, setTimeRange] = useState('-1h');
  const [sparklineData, setSparklineData] = useState<SparklineData>({
    load: [],
    pv: [],
    battery: [],
    grid: [],
  });

  const getResolution = (range: string): string => {
    if (range.includes('7d')) return '1h';
    if (range.includes('24h')) return '15m';
    if (range.includes('6h')) return '5m';
    return '1m';
  };

  const fetchSite = useCallback(async () => {
    if (!credentials) return;

    try {
      const data = await getSite(siteId, credentials);
      setSite(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load site');
    } finally {
      setLoading(false);
    }
  }, [siteId, credentials]);

  // Fetch sparkline data when time range changes
  const fetchSparklineData = useCallback(async () => {
    if (!credentials) return;

    try {
      const resolution = getResolution(timeRange);
      const response = await getTimeSeries(siteId, credentials, {
        start: timeRange,
        aggregate: resolution,
      });

      // Group data by type
      const grouped: Record<string, Map<string, number>> = {
        load: new Map(),
        pv: new Map(),
        battery: new Map(),
        grid: new Map(),
      };

      response.data.forEach((point) => {
        const timeKey = new Date(point.timestamp).toISOString();
        const derType = point.type || 'unknown';

        if (grouped[derType]) {
          const current = grouped[derType].get(timeKey) || 0;
          grouped[derType].set(timeKey, current + (point.value || 0));
        }
      });

      // Convert to sparkline format
      const toSparkline = (map: Map<string, number>): SparklinePoint[] => {
        return Array.from(map.entries())
          .map(([time, value]) => ({ time: new Date(time), value }))
          .sort((a, b) => a.time.getTime() - b.time.getTime());
      };

      setSparklineData({
        load: toSparkline(grouped.load),
        pv: toSparkline(grouped.pv),
        battery: toSparkline(grouped.battery),
        grid: toSparkline(grouped.grid),
      });
    } catch (err) {
      console.error('Failed to fetch sparkline data:', err);
    }
  }, [siteId, credentials, timeRange]);

  useEffect(() => {
    setLoading(true);
    fetchSite();
  }, [fetchSite]);

  useEffect(() => {
    fetchSparklineData();
  }, [fetchSparklineData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchSite();
      fetchSparklineData();
    }, 10000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchSite, fetchSparklineData]);

  const categorizedDers = useMemo(() => {
    if (!site) return null;
    return site.ders.reduce(
      (acc, der) => {
        const type = der.type.toLowerCase();
        if (type === 'battery') acc.batteries.push(der);
        else if (type === 'pv') acc.pvs.push(der);
        else if (['meter', 'energymeter', 'p1meter'].includes(type)) acc.meters.push(der);
        else if (['ev_charger', 'v2x_charger', 'charger'].includes(type)) acc.evChargers.push(der);
        return acc;
      },
      { batteries: [] as DER[], pvs: [] as DER[], meters: [] as DER[], evChargers: [] as DER[] }
    );
  }, [site]);

  if (loading && !site) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="text-gray-400"
        >
          Loading site data...
        </motion.div>
      </div>
    );
  }

  if (error && !site) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-red-900/20 border border-red-500/50 rounded-xl p-6 backdrop-blur-sm"
      >
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={fetchSite}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </motion.div>
    );
  }

  if (!site) return null;

  // Determine grid color based on import/export
  const gridColor = site.total_grid_power_w > 0 ? 'red' : 'green';
  const gridPrefix = site.total_grid_power_w > 0 ? 'Import' : site.total_grid_power_w < 0 ? 'Export' : '';

  // Determine battery color
  const batteryColor = site.total_battery_power_w > 0 ? 'green' : site.total_battery_power_w < 0 ? 'purple' : 'purple';
  const batteryPrefix = site.total_battery_power_w > 0 ? '+' : '';

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h2 className="text-xl font-bold text-white mb-1">
            {isDemoMode ? DEMO_SITE_NAME : 'Site Dashboard'}
          </h2>
          {lastUpdate && (
            <p className="text-gray-500 text-sm">
              Updated {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-gray-800/80 text-white px-3 py-2 rounded-lg border border-gray-700/50 text-sm focus:border-amber-500 focus:outline-none backdrop-blur-sm"
          >
            <option value="-1h">Last Hour</option>
            <option value="-6h">Last 6 Hours</option>
            <option value="-24h">Last 24 Hours</option>
            <option value="-7d">Last 7 Days</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500"
            />
            Auto-refresh
          </label>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => { fetchSite(); fetchSparklineData(); }}
            className="p-2 bg-gray-800/80 rounded-lg hover:bg-gray-700 transition-colors border border-gray-700/50 backdrop-blur-sm"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
          <SharePanel
            siteId={siteId}
            siteName={isDemoMode ? DEMO_SITE_NAME : 'Site Dashboard'}
            timeRange={timeRange}
          />
        </div>
      </motion.div>

      {/* Animated Power Cards with Sparklines */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ staggerChildren: 0.1 }}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <AnimatedPowerCard
          label="Load"
          value={site.load_w}
          color="orange"
          sparklineData={sparklineData.load}
        />
        <AnimatedPowerCard
          label="Solar"
          value={site.total_pv_power_w}
          color="yellow"
          sparklineData={sparklineData.pv}
        />
        <AnimatedPowerCard
          label="Battery"
          value={Math.abs(site.total_battery_power_w)}
          color={batteryColor}
          prefix={batteryPrefix}
          showBatteryIcon={site.battery_soc_avg !== null}
          batteryLevel={site.battery_soc_avg || 0}
          sparklineData={sparklineData.battery}
        />
        <AnimatedPowerCard
          label="Grid"
          value={Math.abs(site.total_grid_power_w)}
          color={gridColor}
          prefix={gridPrefix}
          sparklineData={sparklineData.grid}
        />
      </motion.div>

      {/* Power Chart */}
      <ErrorBoundary
        fallback={
          <div className="bg-gray-800/50 rounded-xl p-6 h-80 flex items-center justify-center border border-gray-700/50 backdrop-blur-sm">
            <div className="text-red-400">Chart failed to load</div>
          </div>
        }
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <PowerChart siteId={siteId} timeRange={timeRange} />
        </motion.div>
      </ErrorBoundary>

      {/* EMS Panel - only show if not demo mode */}
      {!isDemoMode && (
        <ErrorBoundary>
          <EMSPanel siteId={siteId} />
        </ErrorBoundary>
      )}

      {/* Automations Panel */}
      <ErrorBoundary>
        <AutomationPanel siteId={siteId} />
      </ErrorBoundary>

      {/* DER Cards */}
      {(categorizedDers?.batteries.length || categorizedDers?.pvs.length || categorizedDers?.meters.length || categorizedDers?.evChargers.length) ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
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
        </motion.div>
      ) : null}

      {/* Data Quality Stats Footer */}
      <div className="mt-8 pt-4 border-t border-gray-800">
        <DataQualityStats
          lastUpdate={lastUpdate}
          derCount={{
            pv: categorizedDers?.pvs.length || 0,
            battery: categorizedDers?.batteries.length || 0,
            meter: categorizedDers?.meters.length || 0,
          }}
        />
      </div>
    </div>
  );
}
