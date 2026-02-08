import { Brain, CheckCircle, XCircle, Clock, Zap, Wifi, WifiOff } from 'lucide-react';
import type { EMSCombinedStatus, EMSSiteDetail, EMSParsedSlot } from '../api/ems-manager-types';
import { getModeInfo, formatPrice } from '../api/ems-manager-client';

interface EMSStatusCardProps {
  status: EMSCombinedStatus | null;
  siteDetail: EMSSiteDetail | null;
  currentSlot: EMSParsedSlot | null;
  loading?: boolean;
}

export function EMSStatusCard({ status, siteDetail, currentSlot, loading }: EMSStatusCardProps) {

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500 animate-pulse">
        <div className="h-8 bg-gray-700 rounded w-1/3 mb-4" />
        <div className="h-12 bg-gray-700 rounded w-1/2 mb-4" />
        <div className="h-4 bg-gray-700 rounded w-2/3" />
      </div>
    );
  }

  if (!status) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-gray-500">
        <div className="flex items-center gap-3">
          <Brain className="w-8 h-8 text-gray-500" />
          <div>
            <h3 className="text-gray-400 text-sm font-medium">EMS Optimizer</h3>
            <p className="text-gray-500 text-xs">Not configured</p>
          </div>
        </div>
      </div>
    );
  }

  const modeInfo = currentSlot ? getModeInfo(currentSlot.mode) : null;
  const lastRunTime = status.optimization.last_run_at ? new Date(status.optimization.last_run_at) : null;
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

  // Get DERs with live data from controller
  const controllerDers = siteDetail?.ders.controller || [];
  const batteries = controllerDers.filter(d => d.type === 'battery' || d.type === 'bt');
  const pvs = controllerDers.filter(d => d.type === 'pv');
  const meters = controllerDers.filter(d => d.type === 'meter' || d.type === 'em');

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Brain className="w-7 h-7 text-purple-400" />
          <div>
            <h3 className="text-white text-sm font-semibold">Optimizer</h3>
            <p className="text-gray-500 text-xs">
              {siteDetail?.price_area || 'SE4'} &middot; {siteDetail?.optimization_interval_seconds ? `${siteDetail.optimization_interval_seconds / 60}min` : '15min'} interval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Connection status */}
          <div className="flex items-center gap-1.5">
            {status.control.connected ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
          </div>
          {/* Solver status */}
          <div className="flex items-center gap-1.5">
            {status.optimization.solver_status === 'success' ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <XCircle className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-xs ${status.optimization.solver_status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
              {status.optimization.solver_status === 'success' ? 'OK' : status.optimization.solver_status || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Current Mode */}
      {modeInfo && currentSlot && (
        <div className="mb-4">
          <div className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border ${getModeColorClass(modeInfo.color)}`}>
            <Zap className="w-4 h-4" />
            <span className="font-medium text-sm">{modeInfo.label}</span>
          </div>
          <p className="text-gray-500 text-xs mt-1.5">{modeInfo.description}</p>
        </div>
      )}

      {/* Price */}
      {currentSlot && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Import Price</p>
            <p className="text-lg font-bold text-white">{formatPrice(currentSlot.importPrice)}</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs mb-0.5">Export Price</p>
            <p className="text-lg font-bold text-white">{formatPrice(currentSlot.exportPrice)}</p>
          </div>
        </div>
      )}

      {/* Live DER Status */}
      {(batteries.length > 0 || pvs.length > 0 || meters.length > 0) && (
        <div className="grid grid-cols-2 gap-2 mb-4 pt-3 border-t border-gray-700">
          {batteries.map(der => (
            <div key={der.der_id} className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Battery</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-green-400">{((der.soc ?? 0) * 100).toFixed(0)}%</span>
                <span className="text-xs text-gray-500">SoC</span>
              </div>
              {der.power_w !== null && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {der.power_w > 0 ? '+' : ''}{(der.power_w / 1000).toFixed(1)} kW
                </p>
              )}
            </div>
          ))}
          {pvs.map(der => (
            <div key={der.der_id} className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Solar</p>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-yellow-400">{((der.power_w ?? 0) / 1000).toFixed(1)}</span>
                <span className="text-xs text-gray-500">kW</span>
              </div>
              {der.capacity_w && (
                <p className="text-xs text-gray-400 mt-0.5">{(der.capacity_w / 1000).toFixed(0)} kW capacity</p>
              )}
            </div>
          ))}
          {meters.map(der => (
            <div key={der.der_id} className="bg-gray-700/50 rounded-lg p-3">
              <p className="text-gray-500 text-xs mb-1">Grid Meter</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-lg font-bold ${(der.power_w ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {((der.power_w ?? 0) / 1000).toFixed(1)}
                </span>
                <span className="text-xs text-gray-500">kW</span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                {(der.power_w ?? 0) > 0 ? 'Importing' : 'Exporting'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Last Optimization */}
      <div className="flex items-center gap-2 text-gray-500 text-xs">
        <Clock className="w-3 h-3" />
        {timeSinceRun !== null ? (
          <span>Optimized {timeSinceRun < 1 ? 'just now' : `${timeSinceRun}min ago`} ({status.optimization.trigger_source})</span>
        ) : (
          <span>No recent optimization</span>
        )}
      </div>
    </div>
  );
}
