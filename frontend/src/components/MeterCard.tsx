import { Gauge, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import type { DER } from '../api/types';

interface MeterCardProps {
  meter: DER;
}

export function MeterCard({ meter }: MeterCardProps) {
  const power = meter.data.W ?? 0;
  const isImporting = power > 0;
  const isExporting = power < 0;

  const l1_w = meter.data.L1_W;
  const l2_w = meter.data.L2_W;
  const l3_w = meter.data.L3_W;
  const l1_v = meter.data.L1_V;
  const l2_v = meter.data.L2_V;
  const l3_v = meter.data.L3_V;
  const frequency = meter.data.Hz;
  const totalImport = meter.data.total_import_Wh;
  const totalExport = meter.data.total_export_Wh;

  const formatPower = (w: number) => {
    if (Math.abs(w) >= 1000) {
      return `${(w / 1000).toFixed(2)} kW`;
    }
    return `${Math.abs(w).toFixed(0)} W`;
  };

  const formatEnergy = (wh: number) => {
    if (wh >= 1000000) {
      return `${(wh / 1000000).toFixed(1)} MWh`;
    }
    if (wh >= 1000) {
      return `${(wh / 1000).toFixed(1)} kWh`;
    }
    return `${wh.toFixed(0)} Wh`;
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Gauge className="w-8 h-8 text-blue-400" />
          <div>
            <h3 className="text-gray-400 text-sm font-medium">Grid Meter</h3>
            <p className="text-gray-500 text-xs">{meter.make || 'Unknown'}</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-sm font-medium ${isImporting ? 'text-red-400' : isExporting ? 'text-green-400' : 'text-gray-400'}`}>
          {isImporting ? (
            <>
              <ArrowDownToLine className="w-4 h-4" />
              Import
            </>
          ) : isExporting ? (
            <>
              <ArrowUpFromLine className="w-4 h-4" />
              Export
            </>
          ) : (
            'Balanced'
          )}
        </div>
      </div>

      <div className={`text-3xl font-bold mb-4 ${isImporting ? 'text-red-400' : isExporting ? 'text-green-400' : 'text-white'}`}>
        {isExporting ? '-' : ''}{formatPower(power)}
      </div>

      {(l1_w !== undefined || l2_w !== undefined || l3_w !== undefined) && (
        <div className="grid grid-cols-3 gap-2 mb-4 pt-4 border-t border-gray-700">
          <div>
            <p className="text-gray-500 text-xs">L1</p>
            <p className="text-sm text-white">
              {l1_w?.toFixed(0) ?? '-'}W
            </p>
            <p className="text-xs text-gray-500">{l1_v?.toFixed(0) ?? '-'}V</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">L2</p>
            <p className="text-sm text-white">
              {l2_w?.toFixed(0) ?? '-'}W
            </p>
            <p className="text-xs text-gray-500">{l2_v?.toFixed(0) ?? '-'}V</p>
          </div>
          <div>
            <p className="text-gray-500 text-xs">L3</p>
            <p className="text-sm text-white">
              {l3_w?.toFixed(0) ?? '-'}W
            </p>
            <p className="text-xs text-gray-500">{l3_v?.toFixed(0) ?? '-'}V</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-700">
        {totalImport !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Total Import</p>
            <p className="text-sm text-red-400">{formatEnergy(totalImport)}</p>
          </div>
        )}
        {totalExport !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Total Export</p>
            <p className="text-sm text-green-400">{formatEnergy(totalExport)}</p>
          </div>
        )}
        {frequency !== undefined && (
          <div>
            <p className="text-gray-500 text-xs">Frequency</p>
            <p className="text-sm text-white">{frequency.toFixed(2)} Hz</p>
          </div>
        )}
      </div>
    </div>
  );
}
