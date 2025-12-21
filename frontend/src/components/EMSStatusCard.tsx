import { useState, useEffect } from 'react';
import { Brain, CheckCircle, XCircle, Clock, Zap } from 'lucide-react';
import type { EMSStatus, EMSDER, EMSParsedSlot } from '../api/ems-types';
import { getModeInfo, formatPrice } from '../api/ems-client';

interface EMSStatusCardProps {
  status: EMSStatus | null;
  ders: EMSDER[];
  currentSlot: EMSParsedSlot | null;
  loading?: boolean;
}

export function EMSStatusCard({ status, ders, currentSlot, loading }: EMSStatusCardProps) {
  const [, setNow] = useState(new Date());

  // Update every minute for relative time display
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-12 bg-gray-700 rounded w-1/2 mb-4"></div>
        <div className="h-4 bg-gray-700 rounded w-2/3"></div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-gray-500">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-8 h-8 text-gray-500" />
          <div>
            <h3 className="text-gray-400 text-sm font-medium">EMS Optimizer</h3>
            <p className="text-gray-500 text-xs">Not configured</p>
          </div>
        </div>
        <p className="text-gray-500">This site does not have EMS enabled.</p>
      </div>
    );
  }

  const modeInfo = currentSlot ? getModeInfo(currentSlot.mode) : null;
  const lastRunTime = status.last_run_at ? new Date(status.last_run_at) : null;
  const timeSinceRun = lastRunTime
    ? Math.floor((Date.now() - lastRunTime.getTime()) / 60000)
    : null;

  const getModeColorClass = (color: string) => {
    switch (color) {
      case 'green': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'blue': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'orange': return 'bg-orange-500/20 text-orange-400 border-orange-500/50';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/50';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-purple-400" />
          <div>
            <h3 className="text-gray-400 text-sm font-medium">EMS Optimizer</h3>
            <p className="text-gray-500 text-xs">
              {ders.length} DER{ders.length !== 1 ? 's' : ''} managed
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status.solver_status === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : (
            <XCircle className="w-5 h-5 text-red-400" />
          )}
          <span className={`text-sm ${status.solver_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
            {status.solver_status === 'success' ? 'Running' : 'Error'}
          </span>
        </div>
      </div>

      {/* Current Mode */}
      {modeInfo && currentSlot && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-2">Current Mode</p>
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getModeColorClass(modeInfo.color)}`}>
            <Zap className="w-4 h-4" />
            <span className="font-medium">{modeInfo.label}</span>
          </div>
          <p className="text-gray-500 text-xs mt-2">{modeInfo.description}</p>
        </div>
      )}

      {/* Current Price */}
      {currentSlot && (
        <div className="mb-4">
          <p className="text-gray-500 text-xs mb-1">Current Electricity Price</p>
          <p className="text-xl font-bold text-white">{formatPrice(currentSlot.price)}</p>
        </div>
      )}

      {/* DER Status Summary */}
      {ders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4 pt-4 border-t border-gray-700">
          {ders.map(der => (
            <div key={der.id} className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">
                {der.type === 'battery' ? 'Battery' : der.type === 'v2x' ? 'EV (V2X)' : der.type}
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-white">{der.soc_percent.toFixed(0)}%</span>
                <span className="text-xs text-gray-500">SoC</span>
              </div>
              <p className="text-xs text-gray-500">
                {(der.capacity_wh / 1000).toFixed(1)} kWh capacity
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Last Run */}
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <Clock className="w-3 h-3" />
        {timeSinceRun !== null ? (
          <span>Last optimization {timeSinceRun} min ago</span>
        ) : (
          <span>No recent optimization</span>
        )}
      </div>
    </div>
  );
}
