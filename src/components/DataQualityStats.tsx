import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Activity, Wifi, WifiOff, Zap, Clock } from 'lucide-react';

interface DataQualityStatsProps {
  lastUpdate: Date | null;
  derCount: {
    pv: number;
    battery: number;
    meter: number;
  };
}

// Measure API latency by making a lightweight request
async function measureLatency(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    // Use the GraphQL endpoint with a minimal query
    const response = await fetch('https://api-vnext.srcful.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    const latencyMs = Math.round(performance.now() - start);
    return { ok: response.ok, latencyMs };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return { ok: false, latencyMs };
  }
}

export function DataQualityStats({ lastUpdate, derCount }: DataQualityStatsProps) {
  const [apiStatus, setApiStatus] = useState<'ok' | 'error' | 'checking'>('checking');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const checkApi = useCallback(async () => {
    setApiStatus('checking');
    const result = await measureLatency();
    setApiStatus(result.ok ? 'ok' : 'error');
    setLatencyMs(result.latencyMs);
  }, []);

  // Check API status on mount and every 30 seconds
  useEffect(() => {
    checkApi();
    const interval = setInterval(checkApi, 30000);
    return () => clearInterval(interval);
  }, [checkApi]);

  const timeSinceUpdate = lastUpdate
    ? Math.floor((Date.now() - lastUpdate.getTime()) / 1000)
    : null;

  const totalDers = derCount.pv + derCount.battery + derCount.meter;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-4 text-xs text-gray-500 font-mono"
    >
      {/* API Connection Status */}
      <div className="flex items-center gap-1.5">
        {apiStatus === 'ok' ? (
          <Wifi className="w-3 h-3 text-green-500" />
        ) : apiStatus === 'error' ? (
          <WifiOff className="w-3 h-3 text-red-500" />
        ) : (
          <Activity className="w-3 h-3 text-gray-400 animate-pulse" />
        )}
        <span className={apiStatus === 'ok' ? 'text-green-400' : apiStatus === 'error' ? 'text-red-400' : 'text-gray-400'}>
          API {apiStatus === 'ok' ? 'OK' : apiStatus === 'error' ? 'Error' : '...'}
        </span>
      </div>

      {/* Latency */}
      {latencyMs !== null && (
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-blue-400" />
          <span className={latencyMs < 200 ? 'text-green-400' : latencyMs < 500 ? 'text-amber-400' : 'text-red-400'}>
            {latencyMs}ms
          </span>
        </div>
      )}

      {/* DER Count */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>
          {totalDers} DERs ({derCount.pv} PV, {derCount.battery} Bat, {derCount.meter} Grid)
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
