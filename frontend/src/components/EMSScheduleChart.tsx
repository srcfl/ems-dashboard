import { useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import type { EMSParsedSchedule, EMSMode } from '../api/ems-types';
import { getModeInfo } from '../api/ems-client';

interface EMSScheduleChartProps {
  schedule: EMSParsedSchedule | null;
  loading?: boolean;
}

interface ChartDataPoint {
  timestamp: Date;
  timeLabel: string;
  mode: EMSMode;
  price: number;
  priceOre: number;
  batterySoc: number | null;
  evSoc: number | null;
  batteryPower: number | null;
  evPower: number | null;
  loadForecast: number;
  productionForecast: number;
  isCurrent: boolean;
}

const MODE_COLORS: Record<EMSMode, string> = {
  IDLE: '#6b7280',           // gray-500
  SELF_CONSUMPTION: '#22c55e', // green-500
  FORCE_CHARGE: '#3b82f6',    // blue-500
  FORCE_DISCHARGE: '#f97316', // orange-500
};

export function EMSScheduleChart({ schedule, loading }: EMSScheduleChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const chartData = useMemo(() => {
    if (!schedule) return [];

    const now = new Date();

    return schedule.slots.map((slot) => {
      const slotEnd = new Date(slot.timestamp.getTime() + schedule.slotDuration * 1000);
      const isCurrent = now >= slot.timestamp && now < slotEnd;

      // Find battery and EV DERs
      let batterySoc: number | null = null;
      let evSoc: number | null = null;
      let batteryPower: number | null = null;
      let evPower: number | null = null;

      for (const [derId, derData] of Object.entries(slot.ders)) {
        if (derId.startsWith('bt-')) {
          batterySoc = derData.soc;
          batteryPower = derData.power;
        } else if (derId.startsWith('v2x-')) {
          evSoc = derData.soc;
          evPower = derData.power;
        }
      }

      return {
        timestamp: slot.timestamp,
        timeLabel: slot.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
        mode: slot.mode,
        price: slot.price,
        priceOre: slot.price * 100,
        batterySoc,
        evSoc,
        batteryPower,
        evPower,
        loadForecast: slot.loadForecast,
        productionForecast: slot.productionForecast,
        isCurrent,
      };
    });
  }, [schedule]);

  // Find current slot index for reference line
  const currentSlotIndex = chartData.findIndex(d => d.isCurrent);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/4 mb-4"></div>
        <div className="h-64 bg-gray-700 rounded"></div>
      </div>
    );
  }

  if (!schedule || chartData.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">24h Schedule</h3>
        <p className="text-gray-500">No schedule data available</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
    if (!active || !payload || !payload[0]) return null;

    const data = payload[0].payload;
    const modeInfo = getModeInfo(data.mode);

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
        <p className="text-white font-medium mb-2">{data.timeLabel}</p>
        <div className="space-y-1 text-sm">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded"
              style={{ backgroundColor: MODE_COLORS[data.mode] }}
            />
            <span className="text-gray-400">Mode:</span>
            <span className="text-white">{modeInfo.label}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-gray-400">Price:</span>
            <span className="text-white">{data.priceOre.toFixed(1)} öre/kWh</span>
          </div>
          {data.batterySoc !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Battery SoC:</span>
              <span className="text-yellow-400">{data.batterySoc.toFixed(0)}%</span>
            </div>
          )}
          {data.evSoc !== null && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">EV SoC:</span>
              <span className="text-cyan-400">{data.evSoc.toFixed(0)}%</span>
            </div>
          )}
          {data.batteryPower !== null && data.batteryPower !== 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Battery Power:</span>
              <span className="text-white">{(data.batteryPower / 1000).toFixed(1)} kW</span>
            </div>
          )}
          {data.loadForecast > 0 && (
            <div className="flex justify-between gap-4">
              <span className="text-gray-400">Load:</span>
              <span className="text-white">{data.loadForecast.toFixed(0)} W</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Calculate Y-axis domain for price
  const minPrice = Math.min(...chartData.map(d => d.priceOre));
  const maxPrice = Math.max(...chartData.map(d => d.priceOre));
  const pricePadding = (maxPrice - minPrice) * 0.1;

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-medium">24h Optimization Schedule</h3>
        <div className="flex items-center gap-4 text-xs">
          {Object.entries(MODE_COLORS).map(([mode, color]) => (
            <div key={mode} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: color }} />
              <span className="text-gray-400">{getModeInfo(mode as EMSMode).label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            onMouseMove={(e) => {
              if (e.activeTooltipIndex !== undefined && typeof e.activeTooltipIndex === 'number') {
                setHoveredIndex(e.activeTooltipIndex);
              }
            }}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <XAxis
              dataKey="timeLabel"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              interval={11}  // Show every 3 hours (12 x 15min = 3h)
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              domain={[minPrice - pricePadding, maxPrice + pricePadding]}
              tickFormatter={(v) => `${v.toFixed(0)}`}
              label={{
                value: 'öre/kWh',
                angle: -90,
                position: 'insideLeft',
                fill: '#9ca3af',
                fontSize: 10,
              }}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              stroke="#6b7280"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              tickLine={false}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: 'SoC',
                angle: 90,
                position: 'insideRight',
                fill: '#9ca3af',
                fontSize: 10,
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Current time reference line */}
            {currentSlotIndex >= 0 && (
              <ReferenceLine
                x={chartData[currentSlotIndex].timeLabel}
                stroke="#a855f7"
                strokeWidth={2}
                strokeDasharray="4 4"
                yAxisId="price"
              />
            )}

            {/* Mode bars (background) */}
            <Bar
              yAxisId="price"
              dataKey="priceOre"
              barSize={8}
              radius={[2, 2, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={MODE_COLORS[entry.mode]}
                  opacity={hoveredIndex === index ? 1 : 0.7}
                />
              ))}
            </Bar>

            {/* Price line */}
            <Line
              yAxisId="price"
              type="stepAfter"
              dataKey="priceOre"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Price"
            />

            {/* Battery SoC line */}
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="batterySoc"
              stroke="#eab308"
              strokeWidth={2}
              dot={false}
              name="Battery SoC"
              connectNulls
            />

            {/* EV SoC line */}
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="evSoc"
              stroke="#06b6d4"
              strokeWidth={2}
              dot={false}
              name="EV SoC"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-yellow-500" />
          <span className="text-gray-400">Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-yellow-400" />
          <span className="text-gray-400">Battery SoC</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-cyan-400" />
          <span className="text-gray-400">EV SoC</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-purple-500 rounded-full" />
          <span className="text-gray-400">Current Time</span>
        </div>
      </div>
    </div>
  );
}
