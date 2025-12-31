import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SparklinePoint {
  time: Date;
  value: number;
}

interface AnimatedPowerCardProps {
  label: string;
  value: number;
  unit?: string;
  color: 'orange' | 'yellow' | 'purple' | 'green' | 'red' | 'blue';
  prefix?: string;
  showBatteryIcon?: boolean;
  batteryLevel?: number; // 0-1
  sparklineData?: SparklinePoint[];
}

// Battery icon - horizontal battery shape with fill level
function BatteryIcon({ level, color }: { level: number; color: string }) {
  const barColors = {
    green: { active: '#22C55E', inactive: 'rgba(34, 197, 94, 0.25)' },
    purple: { active: '#A855F7', inactive: 'rgba(168, 85, 247, 0.25)' },
    orange: { active: '#F97316', inactive: 'rgba(249, 115, 22, 0.25)' },
    yellow: { active: '#EAB308', inactive: 'rgba(234, 179, 8, 0.25)' },
    red: { active: '#EF4444', inactive: 'rgba(239, 68, 68, 0.25)' },
    blue: { active: '#3B82F6', inactive: 'rgba(59, 130, 246, 0.25)' },
  };
  const colorScheme = barColors[color as keyof typeof barColors] || barColors.green;
  // Use red when battery is low
  const fillColor = level < 0.2 ? '#EF4444' : colorScheme.active;
  const fillWidth = Math.max(2, level * 20); // 20px max width for fill

  return (
    <div className="flex items-center">
      {/* Battery body */}
      <div
        className="relative w-6 h-3 rounded-sm border-2 flex items-center p-[2px]"
        style={{ borderColor: colorScheme.active }}
      >
        {/* Fill level */}
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${fillWidth}px` }}
          transition={{ duration: 0.3 }}
          className="h-full rounded-[1px]"
          style={{
            backgroundColor: fillColor,
            boxShadow: `0 0 4px ${fillColor}`,
          }}
        />
      </div>
      {/* Battery cap */}
      <div
        className="w-[3px] h-1.5 rounded-r-sm"
        style={{ backgroundColor: colorScheme.active }}
      />
    </div>
  );
}

const colorMap = {
  orange: {
    text: 'text-orange-400',
    glow: 'shadow-orange-500/50',
    bg: 'from-orange-500/10 to-orange-500/5',
    border: 'border-orange-500/30',
    progressBg: 'bg-orange-500',
    sparkline: '#F97316',
    sparklineFill: 'rgba(249, 115, 22, 0.15)',
  },
  yellow: {
    text: 'text-yellow-400',
    glow: 'shadow-yellow-500/50',
    bg: 'from-yellow-500/10 to-yellow-500/5',
    border: 'border-yellow-500/30',
    progressBg: 'bg-yellow-500',
    sparkline: '#EAB308',
    sparklineFill: 'rgba(234, 179, 8, 0.15)',
  },
  purple: {
    text: 'text-purple-400',
    glow: 'shadow-purple-500/50',
    bg: 'from-purple-500/10 to-purple-500/5',
    border: 'border-purple-500/30',
    progressBg: 'bg-purple-500',
    sparkline: '#A855F7',
    sparklineFill: 'rgba(168, 85, 247, 0.15)',
  },
  green: {
    text: 'text-green-400',
    glow: 'shadow-green-500/50',
    bg: 'from-green-500/10 to-green-500/5',
    border: 'border-green-500/30',
    progressBg: 'bg-green-500',
    sparkline: '#22C55E',
    sparklineFill: 'rgba(34, 197, 94, 0.15)',
  },
  red: {
    text: 'text-red-400',
    glow: 'shadow-red-500/50',
    bg: 'from-red-500/10 to-red-500/5',
    border: 'border-red-500/30',
    progressBg: 'bg-red-500',
    sparkline: '#EF4444',
    sparklineFill: 'rgba(239, 68, 68, 0.15)',
  },
  blue: {
    text: 'text-blue-400',
    glow: 'shadow-blue-500/50',
    bg: 'from-blue-500/10 to-blue-500/5',
    border: 'border-blue-500/30',
    progressBg: 'bg-blue-500',
    sparkline: '#3B82F6',
    sparklineFill: 'rgba(59, 130, 246, 0.15)',
  },
};

function formatPower(watts: number): string {
  const absWatts = Math.abs(watts);
  if (absWatts >= 1000) {
    return (watts / 1000).toFixed(1);
  }
  return watts.toFixed(0);
}

function getUnit(watts: number): string {
  return Math.abs(watts) >= 1000 ? 'kW' : 'W';
}

// Calculate trend from sparkline data
function calculateTrend(data: SparklinePoint[]): { direction: 'up' | 'down' | 'flat'; percentage: number } {
  if (!data || data.length < 2) return { direction: 'flat', percentage: 0 };

  // Compare first quarter average with last quarter average
  const quarterLength = Math.max(1, Math.floor(data.length / 4));
  const firstQuarter = data.slice(0, quarterLength);
  const lastQuarter = data.slice(-quarterLength);

  const firstAvg = firstQuarter.reduce((sum, p) => sum + p.value, 0) / firstQuarter.length;
  const lastAvg = lastQuarter.reduce((sum, p) => sum + p.value, 0) / lastQuarter.length;

  if (firstAvg === 0) return { direction: lastAvg > 0 ? 'up' : 'flat', percentage: 0 };

  const changePercent = ((lastAvg - firstAvg) / Math.abs(firstAvg)) * 100;

  if (Math.abs(changePercent) < 3) return { direction: 'flat', percentage: 0 };

  return {
    direction: changePercent > 0 ? 'up' : 'down',
    percentage: Math.abs(changePercent),
  };
}

// Generate SVG path for sparkline
function generateSparklinePath(data: SparklinePoint[], width: number, height: number): { line: string; area: string } {
  if (!data || data.length < 2) return { line: '', area: '' };

  const values = data.map(d => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((d.value - minVal) / range) * chartHeight;
    return { x, y };
  });

  // Generate smooth curve using quadratic bezier
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    linePath += ` Q ${prev.x} ${prev.y} ${cpX} ${(prev.y + curr.y) / 2}`;
  }
  linePath += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;

  // Area path (line + bottom fill)
  const areaPath = linePath + ` L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return { line: linePath, area: areaPath };
}

export function AnimatedPowerCard({
  label,
  value,
  color,
  prefix = '',
  showBatteryIcon = false,
  batteryLevel = 0,
  sparklineData,
}: AnimatedPowerCardProps) {
  const colors = colorMap[color];
  const [isGlowing, setIsGlowing] = useState(false);
  const [prevValue, setPrevValue] = useState(value);

  // Animated value
  const springValue = useSpring(value, { stiffness: 100, damping: 30 });
  const displayValue = useTransform(springValue, (v) => formatPower(v));

  // Calculate trend
  const trend = useMemo(() => calculateTrend(sparklineData || []), [sparklineData]);

  // Generate sparkline paths
  const sparklinePaths = useMemo(() => {
    if (!sparklineData || sparklineData.length < 2) return null;
    return generateSparklinePath(sparklineData, 200, 60);
  }, [sparklineData]);

  // Detect value changes for glow effect
  useEffect(() => {
    if (Math.abs(value - prevValue) > 50) {
      setIsGlowing(true);
      setTimeout(() => setIsGlowing(false), 1000);
    }
    setPrevValue(value);
    springValue.set(value);
  }, [value, prevValue, springValue]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`
        relative overflow-hidden rounded-2xl p-5
        bg-gradient-to-br ${colors.bg}
        backdrop-blur-xl
        border ${colors.border}
        transition-shadow duration-500
        ${isGlowing ? `shadow-lg ${colors.glow}` : 'shadow-md shadow-black/20'}
      `}
    >
      {/* Sparkline background */}
      {sparklinePaths && (
        <svg
          className="absolute bottom-0 right-0 w-full h-16 pointer-events-none opacity-60"
          viewBox="0 0 200 60"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`gradient-${label}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={colors.sparkline} stopOpacity="0.3" />
              <stop offset="100%" stopColor={colors.sparkline} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={sparklinePaths.area}
            fill={`url(#gradient-${label})`}
          />
          <path
            d={sparklinePaths.line}
            fill="none"
            stroke={colors.sparkline}
            strokeWidth="1.5"
            strokeOpacity="0.6"
          />
        </svg>
      )}

      {/* Animated background pulse */}
      {isGlowing && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: [0, 0.3, 0], scale: [0.8, 1.2, 1.5] }}
          transition={{ duration: 1 }}
          className={`absolute inset-0 bg-gradient-radial ${colors.bg} pointer-events-none`}
        />
      )}

      {/* Glass effect overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />

      {/* Header with label, battery icon, and trend */}
      <div className="flex items-center justify-between relative z-10 mb-2">
        <div className="flex items-center gap-2">
          <p className="text-gray-400 text-sm">{label}</p>
          {showBatteryIcon && (
            <div className="flex items-center gap-1.5">
              <BatteryIcon level={batteryLevel} color={color} />
              <span className="text-xs text-gray-500">{(batteryLevel * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
        {trend.direction !== 'flat' && (
          <motion.div
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`flex items-center gap-1 text-xs ${
              trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
            }`}
          >
            {trend.direction === 'up' ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            <span>{trend.percentage.toFixed(0)}%</span>
          </motion.div>
        )}
        {trend.direction === 'flat' && sparklineData && sparklineData.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Minus className="w-3 h-3" />
            <span>stable</span>
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-1 relative z-10">
        {prefix && <span className={`text-lg ${colors.text}`}>{prefix}</span>}
        <motion.span className={`text-3xl font-bold ${colors.text}`}>
          {displayValue}
        </motion.span>
        <span className={`text-lg ${colors.text} opacity-70`}>{getUnit(value)}</span>
      </div>

    </motion.div>
  );
}
