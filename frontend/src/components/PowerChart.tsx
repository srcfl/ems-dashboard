import { useEffect, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { getTimeSeries } from '../api/data-service';
import { useDataContext } from '../contexts/DataContext';

interface PowerChartProps {
  siteId: string;
  timeRange?: string;
}

interface ChartDataPoint {
  time: string;
  timestamp: Date;
  [key: string]: string | number | Date;
}

const DER_COLORS: Record<string, string> = {
  load: '#F97316',      // Orange for load
  pv: '#EAB308',        // Yellow for solar
  battery: '#A855F7',   // Purple for battery
  meter: '#3B82F6',     // Blue for grid
  grid: '#3B82F6',      // Alias
  ev_charger: '#06B6D4',
  v2x_charger: '#06B6D4',
  charger: '#06B6D4',
  energyMeter: '#3B82F6',
  p1Meter: '#3B82F6',
};

const DER_LABELS: Record<string, string> = {
  load: 'Load',
  grid: 'Grid',
  pv: 'Solar',
  battery: 'Battery',
  meter: 'Grid',
  ev_charger: 'EV Charger',
  v2x_charger: 'V2X Charger',
  charger: 'Charger',
};

// Custom legend with click-to-toggle functionality
interface CustomLegendProps {
  payload?: Array<{ value: string; color: string; dataKey: string }>;
  hiddenSeries: Set<string>;
  onToggle: (dataKey: string) => void;
}

function CustomLegend({ payload, hiddenSeries, onToggle }: CustomLegendProps) {
  if (!payload) return null;

  return (
    <div className="flex justify-center gap-4 mt-2 flex-wrap">
      {payload.map((entry) => {
        const isHidden = hiddenSeries.has(entry.dataKey);
        return (
          <button
            key={entry.dataKey}
            onClick={() => onToggle(entry.dataKey)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded transition-all ${
              isHidden ? 'opacity-40' : 'opacity-100'
            } hover:bg-gray-700`}
          >
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className={`text-sm ${isHidden ? 'line-through text-gray-500' : 'text-gray-300'}`}>
              {entry.value}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function PowerChart({ siteId, timeRange = '-1h' }: PowerChartProps) {
  const { dataSource, credentials } = useDataContext();
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [derTypes, setDerTypes] = useState<string[]>([]);
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());

  const toggleSeries = useCallback((dataKey: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(dataKey)) {
        next.delete(dataKey);
      } else {
        next.add(dataKey);
      }
      return next;
    });
  }, []);

  // Determine appropriate resolution based on time range
  const getResolutionForRange = (range: string): string => {
    if (range.includes('7d')) return '1h';      // 7 days -> hourly (168 points)
    if (range.includes('24h')) return '15m';    // 24 hours -> 15 min (96 points)
    if (range.includes('6h')) return '5m';      // 6 hours -> 5 min (72 points)
    return '1m';                                 // 1 hour -> 1 min (60 points)
  };

  // Format time label based on time range
  const formatTimeLabel = (date: Date, range: string): string => {
    if (range.includes('7d')) {
      // Show day and hour for 7 days
      return date.toLocaleDateString('sv-SE', { weekday: 'short', hour: '2-digit', minute: '2-digit' });
    }
    if (range.includes('24h')) {
      // Show hour:minute for 24 hours
      return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
    }
    // Default: just time
    return date.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    // Wait for credentials when using API mode
    if (dataSource === 'api' && !credentials) {
      return;
    }

    setLoading(true);
    setError(null);

    const resolution = getResolutionForRange(timeRange);

    getTimeSeries(siteId, { dataSource, credentials }, { start: timeRange, aggregate: resolution })
      .then((response) => {
        // Group by timestamp and DER type
        const grouped: Record<string, ChartDataPoint> = {};
        const types = new Set<string>();

        response.data.forEach((point) => {
          const time = new Date(point.timestamp);
          const key = time.toISOString();

          if (!grouped[key]) {
            grouped[key] = {
              time: formatTimeLabel(time, timeRange),
              timestamp: time,
            };
          }

          const derType = point.type || 'unknown';
          types.add(derType);

          // Aggregate by type if multiple devices
          const currentValue = (grouped[key][derType] as number) || 0;
          grouped[key][derType] = currentValue + (point.value || 0);
        });

        // Calculate load for each timestamp if not already provided by API
        // Load = Grid + |PV| + Battery (where PV is typically negative)
        Object.values(grouped).forEach((point) => {
          // Only calculate load if it wasn't directly provided by the API
          if (!point.load) {
            const grid = (point.meter as number) || (point.energyMeter as number) || (point.p1Meter as number) || 0;
            const pv = (point.pv as number) || 0;
            const battery = (point.battery as number) || 0;

            // Calculate load: grid import + solar production + battery discharge
            point.load = grid + Math.abs(pv) + battery;
          }
        });

        // Only add load to types if we have load data
        const hasLoadData = Object.values(grouped).some((point) => (point.load as number) > 0);
        if (hasLoadData) {
          types.add('load');
        }

        const sortedData = Object.values(grouped).sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );

        // Prioritize display order: load first, then others
        const displayOrder = ['load', 'grid', 'pv', 'battery', 'meter', 'energyMeter', 'p1Meter', 'ev_charger', 'v2x_charger', 'charger'];
        const orderedTypes = displayOrder.filter(t => types.has(t));

        setData(sortedData);
        setDerTypes(orderedTypes.filter(t => t !== 'unknown'));
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [siteId, timeRange, dataSource, credentials]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="text-gray-400">Loading chart data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 h-80 flex items-center justify-center">
        <div className="text-gray-400">No data available for this time range</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <h3 className="text-gray-400 text-sm font-medium mb-4">Power Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="time"
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
          />
          <YAxis
            stroke="#9CA3AF"
            tick={{ fill: '#9CA3AF', fontSize: 12 }}
            tickFormatter={(value) =>
              Math.abs(value) >= 1000
                ? `${(value / 1000).toFixed(1)}k`
                : value.toFixed(0)
            }
            label={{
              value: 'W',
              angle: -90,
              position: 'insideLeft',
              fill: '#9CA3AF',
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '0.5rem',
            }}
            labelStyle={{ color: '#9CA3AF' }}
            formatter={(value) => [
              `${Number(value).toFixed(0)} W`,
              undefined,
            ]}
          />
          <Legend
            content={
              <CustomLegend
                hiddenSeries={hiddenSeries}
                onToggle={toggleSeries}
              />
            }
          />
          {derTypes.map((type) => (
            <Line
              key={type}
              type="monotone"
              dataKey={type}
              stroke={DER_COLORS[type.toLowerCase()] || '#6B7280'}
              strokeWidth={type === 'load' ? 3 : 2}
              dot={false}
              name={DER_LABELS[type] || type.replace('_', ' ').toUpperCase()}
              hide={hiddenSeries.has(type)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
