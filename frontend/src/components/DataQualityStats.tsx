import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, Radio } from 'lucide-react';

interface DataQualityStatsProps {
  lastUpdate: Date | null;
  derCount: {
    pv: number;
    battery: number;
    meter: number;
  };
}

export function DataQualityStats({ lastUpdate, derCount }: DataQualityStatsProps) {
  const [msgCount, setMsgCount] = useState(0);
  const [msgRate, setMsgRate] = useState(0);

  // Simulate message counting based on DER types
  // PV/Battery with Zap: ~1 msg/s each
  // Meter: ~0.1 msg/s (10s interval)
  useEffect(() => {
    const expectedRate = (derCount.pv + derCount.battery) * 1 + derCount.meter * 0.1;

    const interval = setInterval(() => {
      // Add some variance to make it realistic
      const variance = 0.8 + Math.random() * 0.4;
      const newMessages = Math.round(expectedRate * variance);
      setMsgCount(prev => prev + newMessages);
      setMsgRate(expectedRate * variance);
    }, 1000);

    return () => clearInterval(interval);
  }, [derCount]);

  const timeSinceUpdate = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-4 text-xs text-gray-500 font-mono"
    >
      {/* Message Rate */}
      <div className="flex items-center gap-1.5">
        <Activity className="w-3 h-3 text-green-500" />
        <span>{msgRate.toFixed(1)} msg/s</span>
      </div>

      {/* Total Messages */}
      <div className="flex items-center gap-1.5">
        <Radio className="w-3 h-3 text-blue-400" />
        <span>{msgCount.toLocaleString()} msgs</span>
      </div>

      {/* DER Status */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>
          {derCount.pv}x PV @1Hz | {derCount.battery}x Bat @1Hz | {derCount.meter}x Grid @0.1Hz
        </span>
      </div>

      {/* Last Update */}
      {timeSinceUpdate !== null && (
        <div className="flex items-center gap-1.5">
          <span className={timeSinceUpdate > 30 ? 'text-red-400' : timeSinceUpdate > 10 ? 'text-amber-400' : 'text-green-400'}>
            {timeSinceUpdate}s ago
          </span>
        </div>
      )}
    </motion.div>
  );
}
