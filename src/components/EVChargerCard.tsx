import { Car, Zap } from 'lucide-react';
import type { DER } from '../api/types';

interface EVChargerCardProps {
  charger: DER;
}

export function EVChargerCard({ charger }: EVChargerCardProps) {
  const power = charger.data.W ?? charger.data.dc_W ?? 0;
  const evSoc = charger.data.ev_soc_fract;
  const evMinReq = charger.data.ev_min_energy_req_Wh;
  const evMaxReq = charger.data.ev_max_energy_req_Wh;
  const offeredCurrent = charger.data.offered_A;

  const isCharging = power > 0;
  const isV2G = power < 0;

  const formatPower = (w: number) => {
    if (Math.abs(w) >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${Math.abs(w).toFixed(0)} W`;
  };

  const getStatusText = () => {
    if (isV2G) return 'V2G Discharging';
    if (isCharging) return 'Charging';
    return 'Idle / No Vehicle';
  };

  const getStatusColor = () => {
    if (isV2G) return 'text-green-400';
    if (isCharging) return 'text-cyan-400';
    return 'text-gray-400';
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-cyan-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`relative ${getStatusColor()}`}>
            <Car className="w-8 h-8" />
            {(isCharging || isV2G) && (
              <Zap className="w-4 h-4 absolute -top-1 -right-1 text-yellow-400" />
            )}
          </div>
          <div>
            <h3 className="text-gray-400 text-sm font-medium">EV Charger</h3>
            <p className="text-gray-500 text-xs">{charger.make || charger.type}</p>
          </div>
        </div>
        <div className={`text-sm font-medium ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>

      <div className={`text-3xl font-bold mb-4 ${getStatusColor()}`}>
        {isV2G ? '-' : ''}{formatPower(power)}
      </div>

      {evSoc !== undefined && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Vehicle SoC</span>
            <span>{(evSoc * 100).toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-cyan-500 transition-all"
              style={{ width: `${evSoc * 100}%` }}
            ></div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
        {offeredCurrent !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Offered Current</p>
            <p className="text-sm text-white">{offeredCurrent.toFixed(0)} A</p>
          </div>
        )}
        {evMinReq !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Min Energy Req</p>
            <p className="text-sm text-white">{(evMinReq / 1000).toFixed(1)} kWh</p>
          </div>
        )}
        {evMaxReq !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Max Energy Req</p>
            <p className="text-sm text-white">{(evMaxReq / 1000).toFixed(1)} kWh</p>
          </div>
        )}
      </div>
    </div>
  );
}
