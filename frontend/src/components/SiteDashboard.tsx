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
import { WebhookPanel } from './WebhookPanel';
import { DashboardLayout } from './DashboardLayout';
import type { DashboardWidget } from './DashboardLayout';
import { DEMO_SITES } from '../api/demo-data';

// Get demo site name by ID
const getDemoSiteName = (siteId: string): string => {
  const site = DEMO_SITES.find(s => s.id === siteId);
  return site?.name || 'Demo Site';
};

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
  const [chartRefreshTrigger, setChartRefreshTrigger] = useState(0);
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
      setChartRefreshTrigger(prev => prev + 1); // Trigger incremental chart update
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

  // Build dashboard widgets
  const dashboardWidgets = useMemo((): DashboardWidget[] => {
    if (!site) return [];

    // Determine grid color based on import/export
    const gridColor = site.total_grid_power_w > 0 ? 'red' : 'green';
    const gridPrefix = site.total_grid_power_w > 0 ? 'Import' : site.total_grid_power_w < 0 ? 'Export' : '';

    // Determine battery color
    const batteryColor = site.total_battery_power_w > 0 ? 'green' : site.total_battery_power_w < 0 ? 'purple' : 'purple';
    const batteryPrefix = site.total_battery_power_w > 0 ? '+' : '';

    const widgets: DashboardWidget[] = [
      // Power Cards Row
      {
        id: 'power-cards',
        title: 'Power Overview',
        defaultLayout: { x: 0, y: 0, w: 12, h: 5, minH: 4, minW: 6 },
        component: (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 h-full">
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
          </div>
        ),
      },
      // Power Chart
      {
        id: 'power-chart',
        title: 'Power Chart',
        defaultLayout: { x: 0, y: 5, w: 12, h: 12, minH: 8, minW: 6 },
        component: (
          <ErrorBoundary
            fallback={
              <div className="bg-gray-800/50 rounded-xl p-6 h-full flex items-center justify-center border border-gray-700/50 backdrop-blur-sm">
                <div className="text-red-400">Chart failed to load</div>
              </div>
            }
          >
            <div className="h-full">
              <PowerChart siteId={siteId} timeRange={timeRange} refreshTrigger={chartRefreshTrigger} />
            </div>
          </ErrorBoundary>
        ),
      },
      // Automations Panel
      {
        id: 'automations',
        title: 'Automations',
        defaultLayout: { x: 0, y: 17, w: 12, h: 14, minH: 8, minW: 4 },
        component: (
          <ErrorBoundary>
            <AutomationPanel siteId={siteId} />
          </ErrorBoundary>
        ),
      },
    ];

    // EMS Panel (only if not demo mode)
    if (!isDemoMode) {
      widgets.push({
        id: 'ems-panel',
        title: 'EMS Optimization',
        defaultLayout: { x: 0, y: 31, w: 12, h: 10, minH: 6, minW: 4 },
        component: (
          <ErrorBoundary>
            <EMSPanel siteId={siteId} />
          </ErrorBoundary>
        ),
      });
    }

    // DER Cards (if any exist)
    const hasDers = categorizedDers?.batteries.length || categorizedDers?.pvs.length ||
                    categorizedDers?.meters.length || categorizedDers?.evChargers.length;

    if (hasDers) {
      widgets.push({
        id: 'der-cards',
        title: 'Device Details',
        defaultLayout: { x: 0, y: 41, w: 12, h: 10, minH: 6, minW: 4 },
        component: (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full overflow-auto">
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
        ),
      });
    }

    // Webhooks Panel
    widgets.push({
      id: 'webhooks',
      title: 'Webhooks',
      defaultLayout: { x: 0, y: 51, w: 12, h: 10, minH: 6, minW: 4 },
      component: (
        <ErrorBoundary>
          <WebhookPanel siteId={siteId} />
        </ErrorBoundary>
      ),
    });

    // Data Quality Stats
    widgets.push({
      id: 'data-quality',
      title: 'Data Quality',
      defaultLayout: { x: 0, y: 61, w: 12, h: 3, minH: 2, minW: 4 },
      component: (
        <div className="pt-2">
          <DataQualityStats
            lastUpdate={lastUpdate}
            derCount={{
              pv: categorizedDers?.pvs.length || 0,
              battery: categorizedDers?.batteries.length || 0,
              meter: categorizedDers?.meters.length || 0,
            }}
          />
        </div>
      ),
    });

    return widgets;
  }, [site, sparklineData, siteId, timeRange, isDemoMode, categorizedDers, lastUpdate]);

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
            {isDemoMode ? getDemoSiteName(siteId) : 'Site Dashboard'}
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
            siteName={isDemoMode ? getDemoSiteName(siteId) : 'Site Dashboard'}
            timeRange={timeRange}
          />
        </div>
      </motion.div>

      {/* Customizable Dashboard */}
      <DashboardLayout
        widgets={dashboardWidgets}
        storageKey={`site_${siteId}`}
        columns={12}
        rowHeight={30}
      />
    </div>
  );
}
