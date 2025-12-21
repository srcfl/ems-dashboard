import { Battery, BatteryCharging, BatteryFull, BatteryLow, BatteryMedium } from 'lucide-react';
import type { DER } from '../api/types';

interface BatteryCardProps {
  battery: DER;
}

export function BatteryCard({ battery }: BatteryCardProps) {
  const soc = battery.data.SoC_nom_fract ?? 0;
  const power = battery.data.W ?? 0;
  const capacity = battery.data.capacity_Wh;
  const isCharging = power > 0;
  const isDischarging = power < 0;

  const socPercent = Math.round(soc * 100);

  const getBatteryIcon = () => {
    if (isCharging) return <BatteryCharging className="w-8 h-8" />;
    if (socPercent >= 80) return <BatteryFull className="w-8 h-8" />;
    if (socPercent >= 40) return <BatteryMedium className="w-8 h-8" />;
    if (socPercent >= 20) return <BatteryLow className="w-8 h-8" />;
    return <Battery className="w-8 h-8" />;
  };

  const getStatusColor = () => {
    if (isCharging) return 'text-green-400';
    if (isDischarging) return 'text-orange-400';
    return 'text-gray-400';
  };

  const formatPower = (w: number) => {
    if (Math.abs(w) >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${Math.abs(w).toFixed(0)} W`;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-purple-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={getStatusColor()}>{getBatteryIcon()}</div>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Battery</h3>
            <p className="text-gray-500 text-xs">{battery.make || 'Unknown'}</p>
          </div>
        </div>
        <div className={`text-sm font-medium ${getStatusColor()}`}>
          {isCharging ? 'Charging' : isDischarging ? 'Discharging' : 'Idle'}
        </div>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-400 mb-1">
          <span>State of Charge</span>
          <span>{socPercent}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-4">
          <div
            className={`h-4 rounded-full transition-all ${
              socPercent >= 60
                ? 'bg-green-500'
                : socPercent >= 30
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${socPercent}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-gray-500 text-xs">Power</p>
          <p className={`text-xl font-bold ${getStatusColor()}`}>
            {isDischarging ? '-' : isCharging ? '+' : ''}
            {formatPower(power)}
          </p>
        </div>
        {capacity && (
          <div>
            <p className="text-gray-500 text-xs">Capacity</p>
            <p className="text-xl font-bold text-white">
              {(capacity / 1000).toFixed(1)} kWh
            </p>
          </div>
        )}
      </div>

      {battery.data.heatsink_C && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-gray-500 text-xs">Temperature</p>
          <p className="text-lg text-white">{battery.data.heatsink_C.toFixed(1)}°C</p>
        </div>
      )}
    </div>
  );
}
