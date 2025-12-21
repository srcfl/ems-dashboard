import { Sun } from 'lucide-react';
import type { DER } from '../api/types';

interface PVCardProps {
  pv: DER;
}

export function PVCard({ pv }: PVCardProps) {
  const power = Math.abs(pv.data.W ?? pv.data.dc_W ?? 0);
  const ratedPower = pv.data.rated_power_W;
  const mppt1_v = pv.data.mppt1_V;
  const mppt1_a = pv.data.mppt1_A;
  const mppt2_v = pv.data.mppt2_V;
  const mppt2_a = pv.data.mppt2_A;

  const formatPower = (w: number) => {
    if (w >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${w.toFixed(0)} W`;
  };

  const efficiency = ratedPower ? (power / ratedPower) * 100 : null;

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-yellow-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Sun className={`w-8 h-8 ${power > 0 ? 'text-yellow-400' : 'text-gray-500'}`} />
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Solar PV</h3>
            <p className="text-gray-500 text-xs">{pv.make || 'Unknown'}</p>
          </div>
        </div>
        {power > 0 && (
          <div className="text-sm font-medium text-yellow-400">Producing</div>
        )}
      </div>

      <div className="text-3xl font-bold text-white mb-4">
        {formatPower(power)}
      </div>

      {efficiency !== null && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-1">
            <span>Capacity Usage</span>
            <span>{efficiency.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-yellow-500 transition-all"
              style={{ width: `${Math.min(efficiency, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {(mppt1_v || mppt2_v) && (
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
          {mppt1_v && (
            <div>
              <p className="text-gray-500 text-xs">MPPT 1</p>
              <p className="text-sm text-white">
                {mppt1_v.toFixed(0)}V / {mppt1_a?.toFixed(1) ?? '-'}A
              </p>
            </div>
          )}
          {mppt2_v && (
            <div>
              <p className="text-gray-500 text-xs">MPPT 2</p>
              <p className="text-sm text-white">
                {mppt2_v.toFixed(0)}V / {mppt2_a?.toFixed(1) ?? '-'}A
              </p>
            </div>
          )}
        </div>
      )}

      {pv.data.heatsink_C && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-gray-500 text-xs">Temperature</p>
          <p className="text-lg text-white">{pv.data.heatsink_C.toFixed(1)}°C</p>
        </div>
      )}
    </div>
  );
}
