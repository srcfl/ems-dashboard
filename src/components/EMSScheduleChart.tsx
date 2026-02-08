import { useMemo } from 'react';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
} from 'recharts';
import type { EMSParsedSchedule, EMSMode } from '../api/ems-manager-types';
import { getModeInfo } from '../api/ems-manager-client';

interface EMSScheduleChartProps {
  schedule: EMSParsedSchedule | null;
  loading?: boolean;
}

interface ChartDataPoint {
  timestamp: Date;
  timeLabel: string;
  mode: EMSMode;
  importPrice: number;
  exportPrice: number;
  importPriceOre: number;
  exportPriceOre: number;
  batterySoc: number | null;
  evSoc: number | null;
  batteryPower: number | null;
  loadForecast: number;
  productionForecast: number;
  isCurrent: boolean;
  slotIndex: number;
}

const MODE_COLORS: Record<EMSMode, { bg: string; border: string }> = {
  IDLE: { bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8' },
  SELF_CONSUMPTION: { bg: 'rgba(0, 255, 132, 0.15)', border: '#00FF84' },
  FORCE_CHARGE: { bg: 'rgba(66, 165, 245, 0.2)', border: '#42A5F5' },
  FORCE_DISCHARGE: { bg: 'rgba(255, 133, 51, 0.2)', border: '#FF8533' },
};

export function EMSScheduleChart({ schedule, loading }: EMSScheduleChartProps) {
  const chartData = useMemo(() => {
    if (!schedule) return [];

    const now = new Date();

    return schedule.slots.map((slot) => {
      const slotEnd = new Date(slot.timestamp.getTime() + schedule.slotDuration * 1000);
      const isCurrent = now >= slot.timestamp && now < slotEnd;

      let batterySoc: number | null = null;
      let evSoc: number | null = null;
      let batteryPower: number | null = null;

      for (const [derId, derData] of Object.entries(slot.ders)) {
        if (derId.startsWith('bt-')) {
          batterySoc = derData.soc;
          batteryPower = derData.power;
        } else if (derId.startsWith('v2x-')) {
          evSoc = derData.soc;
        }
      }

      return {
        timestamp: slot.timestamp,
        timeLabel: slot.timestamp.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }),
        mode: slot.mode,
        importPrice: slot.importPrice,
        exportPrice: slot.exportPrice,
        importPriceOre: slot.importPrice * 100,
        exportPriceOre: slot.exportPrice * 100,
        batterySoc,
        evSoc,
        batteryPower,
        loadForecast: slot.loadForecast,
        productionForecast: Math.abs(slot.productionForecast),
        isCurrent,
        slotIndex: slot.slotIndex,
      };
    });
  }, [schedule]);

  const currentSlotIndex = chartData.findIndex(d => d.isCurrent);

  const modeRegions = useMemo(() => {
    if (chartData.length === 0) return [];

    const regions: { startIndex: number; endIndex: number; mode: EMSMode }[] = [];
    let currentRegion = { startIndex: 0, endIndex: 0, mode: chartData[0].mode };

    for (let i = 1; i < chartData.length; i++) {
      if (chartData[i].mode === currentRegion.mode) {
        currentRegion.endIndex = i;
      } else {
        regions.push({ ...currentRegion });
        currentRegion = { startIndex: i, endIndex: i, mode: chartData[i].mode };
      }
    }
    regions.push(currentRegion);

    return regions;
  }, [chartData]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 animate-pulse">
        <div className="h-6 bg-gray-700 rounded w-1/4 mb-4" />
        <div className="h-80 bg-gray-700 rounded" />
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
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 shadow-xl min-w-[240px]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-white font-bold text-lg">{data.timeLabel}</p>
          {data.isCurrent && (
            <span className="px-2 py-0.5 bg-purple-500/30 text-purple-300 text-xs rounded-full">NOW</span>
          )}
        </div>

        {/* Mode */}
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-700">
          <div
            className="w-3 h-3 rounded"
            style={{ backgroundColor: MODE_COLORS[data.mode].border }}
          />
          <span className="text-white font-medium">{modeInfo.label}</span>
        </div>

        <div className="space-y-2 text-sm">
          {/* Prices */}
          <div className="flex justify-between">
            <span className="text-gray-400">Import</span>
            <span className="text-amber-400 font-medium">{data.importPriceOre.toFixed(1)} öre/kWh</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Export</span>
            <span className="text-emerald-400 font-medium">{data.exportPriceOre.toFixed(1)} öre/kWh</span>
          </div>

          {/* Load */}
          {data.loadForecast > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Load</span>
              <span className="text-gray-300 font-medium">{(data.loadForecast / 1000).toFixed(1)} kW</span>
            </div>
          )}

          {/* Production */}
          {data.productionForecast > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Solar</span>
              <span className="text-yellow-400 font-medium">{(data.productionForecast / 1000).toFixed(1)} kW</span>
            </div>
          )}

          {/* Battery SoC */}
          {data.batterySoc != null && (
            <div className="flex justify-between">
              <span className="text-gray-400">Battery</span>
              <span className="text-green-400 font-bold">{data.batterySoc.toFixed(0)}%</span>
            </div>
          )}

          {/* Battery Power */}
          {data.batteryPower != null && data.batteryPower !== 0 && (
            <div className="flex justify-between">
              <span className="text-gray-400">Battery Power</span>
              <span className={`font-medium ${data.batteryPower > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                {data.batteryPower > 0 ? '+' : ''}{(data.batteryPower / 1000).toFixed(1)} kW
              </span>
            </div>
          )}

          {/* EV SoC */}
          {data.evSoc != null && (
            <div className="flex justify-between">
              <span className="text-gray-400">EV</span>
              <span className="text-cyan-400 font-bold">{data.evSoc.toFixed(0)}%</span>
            </div>
          )}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-gray-500 text-xs italic">{modeInfo.description}</p>
        </div>
      </div>
    );
  };

  const maxPrice = Math.max(...chartData.map(d => d.importPriceOre));
  const minPrice = Math.min(...chartData.map(d => d.importPriceOre));
  const pricePadding = Math.max((maxPrice - minPrice) * 0.15, 2);

  const currentTimeLabel = currentSlotIndex >= 0 ? chartData[currentSlotIndex].timeLabel : null;

  // Check if there's any production forecast data
  const hasProduction = chartData.some(d => d.productionForecast > 0);
  const hasLoad = chartData.some(d => d.loadForecast > 0);

  return (
    <div className="bg-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-medium">24h Optimization Schedule</h3>
          <p className="text-gray-500 text-xs mt-1">
            Generated {schedule.generatedAt.toLocaleTimeString('sv-SE')}
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs flex-wrap">
          {Object.entries(MODE_COLORS).map(([mode, colors]) => (
            <div key={mode} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: colors.border }} />
              <span className="text-gray-400">{getModeInfo(mode as EMSMode).label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 60, left: 10, bottom: 10 }}
          >
            {/* Mode background shading */}
            {modeRegions.map((region, idx) => (
              <ReferenceArea
                key={idx}
                x1={chartData[region.startIndex].timeLabel}
                x2={chartData[Math.min(region.endIndex + 1, chartData.length - 1)].timeLabel}
                fill={MODE_COLORS[region.mode].bg}
                fillOpacity={1}
                yAxisId="price"
              />
            ))}

            <XAxis
              dataKey="timeLabel"
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              interval={11}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              domain={[minPrice - pricePadding, maxPrice + pricePadding]}
              tickFormatter={(v) => `${v.toFixed(0)}`}
              label={{
                value: 'öre/kWh',
                angle: -90,
                position: 'insideLeft',
                fill: '#6b7280',
                fontSize: 11,
                offset: 0,
              }}
            />
            <YAxis
              yAxisId="soc"
              orientation="right"
              stroke="#4b5563"
              tick={{ fill: '#9ca3af', fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#374151' }}
              domain={[0, 100]}
              tickFormatter={(v) => `${v}%`}
              label={{
                value: 'SoC %',
                angle: 90,
                position: 'insideRight',
                fill: '#6b7280',
                fontSize: 11,
                offset: 0,
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Current time indicator */}
            {currentTimeLabel && (
              <>
                <ReferenceLine
                  x={currentTimeLabel}
                  stroke="#00FF84"
                  strokeWidth={3}
                  yAxisId="price"
                />
                <ReferenceLine
                  x={currentTimeLabel}
                  stroke="#00FF84"
                  strokeWidth={12}
                  strokeOpacity={0.2}
                  yAxisId="price"
                />
              </>
            )}

            {/* Load forecast area */}
            {hasLoad && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey={(d: ChartDataPoint) => d.loadForecast > 0 ? (d.loadForecast / 1000) * 5 + minPrice : null}
                stroke="none"
                fill="#94a3b8"
                fillOpacity={0.1}
                connectNulls
              />
            )}

            {/* Production forecast area */}
            {hasProduction && (
              <Area
                yAxisId="price"
                type="monotone"
                dataKey={(d: ChartDataPoint) => d.productionForecast > 0 ? (d.productionForecast / 1000) * 5 + minPrice : null}
                stroke="none"
                fill="#FFD500"
                fillOpacity={0.1}
                connectNulls
              />
            )}

            {/* Import price line */}
            <Line
              yAxisId="price"
              type="stepAfter"
              dataKey="importPriceOre"
              stroke="#FFD500"
              strokeWidth={2}
              dot={false}
              name="Import Price"
            />

            {/* Export price line */}
            <Line
              yAxisId="price"
              type="stepAfter"
              dataKey="exportPriceOre"
              stroke="#10B981"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Export Price"
            />

            {/* Battery SoC */}
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="batterySoc"
              stroke="#00FF84"
              strokeWidth={3}
              dot={false}
              name="Battery SoC"
              connectNulls
            />

            {/* EV SoC */}
            <Line
              yAxisId="soc"
              type="monotone"
              dataKey="evSoc"
              stroke="#14B8A6"
              strokeWidth={3}
              dot={false}
              name="EV SoC"
              connectNulls
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-4 pt-4 border-t border-gray-700 text-xs flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-[#FFD500]" />
          <span className="text-gray-400">Import Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-0.5 bg-[#10B981] border-dashed" style={{ borderTop: '1.5px dashed #10B981', height: 0 }} />
          <span className="text-gray-400">Export Price</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-1 bg-[#00FF84] rounded" />
          <span className="text-gray-400">Battery SoC</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-1 bg-[#14B8A6] rounded" />
          <span className="text-gray-400">EV SoC</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-[#00FF84] rounded-full" />
          <span className="text-gray-400">Now</span>
        </div>
      </div>
    </div>
  );
}
