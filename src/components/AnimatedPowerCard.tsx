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
// Uses Sourceful Design System colors
function BatteryIcon({ level, color }: { level: number; color: string }) {
  const barColors = {
    green: { active: '#00FF84', inactive: 'rgba(0, 255, 132, 0.25)' },     // Sourceful neon green
    purple: { active: '#00FF84', inactive: 'rgba(0, 255, 132, 0.25)' },    // Battery uses neon green
    orange: { active: '#FF8533', inactive: 'rgba(255, 133, 51, 0.25)' },   // Sourceful orange
    yellow: { active: '#FFD500', inactive: 'rgba(255, 213, 0, 0.25)' },    // Sourceful yellow
    red: { active: '#FF3D3D', inactive: 'rgba(255, 61, 61, 0.25)' },       // Sourceful red
    blue: { active: '#42A5F5', inactive: 'rgba(66, 165, 245, 0.25)' },     // Sourceful blue
  };
  const colorScheme = barColors[color as keyof typeof barColors] || barColors.green;
  // Use red when battery is low
  const fillColor = level < 0.2 ? '#FF3D3D' : colorScheme.active;
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

// Sourceful Design System color map
const colorMap = {
  orange: {
    text: 'text-[#FF8533]',
    glow: 'shadow-[#FF8533]/50',
    bg: 'from-[#FF8533]/10 to-[#FF8533]/5',
    border: 'border-[#FF8533]/30',
    progressBg: 'bg-[#FF8533]',
    sparkline: '#FF8533',        // Sourceful orange
    sparklineFill: 'rgba(255, 133, 51, 0.15)',
  },
  yellow: {
    text: 'text-[#FFD500]',
    glow: 'shadow-[#FFD500]/50',
    bg: 'from-[#FFD500]/10 to-[#FFD500]/5',
    border: 'border-[#FFD500]/30',
    progressBg: 'bg-[#FFD500]',
    sparkline: '#FFD500',        // Sourceful yellow (solar)
    sparklineFill: 'rgba(255, 213, 0, 0.15)',
  },
  purple: {
    text: 'text-[#00FF84]',
    glow: 'shadow-[#00FF84]/50',
    bg: 'from-[#00FF84]/10 to-[#00FF84]/5',
    border: 'border-[#00FF84]/30',
    progressBg: 'bg-[#00FF84]',
    sparkline: '#00FF84',        // Sourceful neon green (battery)
    sparklineFill: 'rgba(0, 255, 132, 0.15)',
  },
  green: {
    text: 'text-[#00FF84]',
    glow: 'shadow-[#00FF84]/50',
    bg: 'from-[#00FF84]/10 to-[#00FF84]/5',
    border: 'border-[#00FF84]/30',
    progressBg: 'bg-[#00FF84]',
    sparkline: '#00FF84',        // Sourceful neon green
    sparklineFill: 'rgba(0, 255, 132, 0.15)',
  },
  red: {
    text: 'text-[#FF3D3D]',
    glow: 'shadow-[#FF3D3D]/50',
    bg: 'from-[#FF3D3D]/10 to-[#FF3D3D]/5',
    border: 'border-[#FF3D3D]/30',
    progressBg: 'bg-[#FF3D3D]',
    sparkline: '#FF3D3D',        // Sourceful red
    sparklineFill: 'rgba(255, 61, 61, 0.15)',
  },
  blue: {
    text: 'text-[#42A5F5]',
    glow: 'shadow-[#42A5F5]/50',
    bg: 'from-[#42A5F5]/10 to-[#42A5F5]/5',
    border: 'border-[#42A5F5]/30',
    progressBg: 'bg-[#42A5F5]',
    sparkline: '#42A5F5',        // Sourceful blue (grid)
    sparklineFill: 'rgba(66, 165, 245, 0.15)',
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
