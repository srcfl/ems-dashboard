import { useState } from 'react';
import { BatteryCharging, Zap, Settings, Loader2 } from 'lucide-react';
import { useDataContext } from '../contexts/DataContext';
import {
  enableChargeNow,
  disableChargeNow,
  updateDER,
} from '../api/ems-manager-client';
import type { EMSSiteDetail, EMSDERResponse } from '../api/ems-manager-types';

interface EMSControlPanelProps {
  siteId: string;
  siteDetail: EMSSiteDetail;
  onUpdate: () => void;
}

export function EMSControlPanel({ siteId, siteDetail, onUpdate }: EMSControlPanelProps) {
  const { credentials } = useDataContext();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showDERConfig, setShowDERConfig] = useState(false);

  // Get controllable DERs (batteries from either controller or optimizer)
  const allDers = [
    ...(siteDetail.ders.controller || []),
    ...(siteDetail.ders.optimizer || []),
  ];
  // Deduplicate by der_id
  const derMap = new Map<string, EMSDERResponse>();
  allDers.forEach(d => {
    if (!derMap.has(d.der_id) || d.power_w !== null) {
      derMap.set(d.der_id, d);
    }
  });
  const batteries = Array.from(derMap.values()).filter(
    d => d.type === 'battery' || d.type === 'bt'
  );

  const handleChargeNow = async (derId: string) => {
    if (!credentials) return;
    setActiveAction(`charge-${derId}`);
    setError(null);
    try {
      await enableChargeNow(siteId, derId, credentials);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to enable charge');
    } finally {
      setActiveAction(null);
    }
  };

  const handleStopCharge = async (derId: string) => {
    if (!credentials) return;
    setActiveAction(`stop-${derId}`);
    setError(null);
    try {
      await disableChargeNow(siteId, derId, credentials);
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disable charge');
    } finally {
      setActiveAction(null);
    }
  };

  const handleUpdateSoCLimits = async (derId: string, minSoc: number, maxSoc: number) => {
    if (!credentials) return;
    setActiveAction(`config-${derId}`);
    setError(null);
    try {
      await updateDER(siteId, derId, credentials, {
        min_soc_percent: minSoc,
        max_soc_percent: maxSoc,
      });
      onUpdate();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update DER');
    } finally {
      setActiveAction(null);
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-6 border-l-4 border-blue-500">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Zap className="w-7 h-7 text-blue-400" />
          <div>
            <h3 className="text-white text-sm font-semibold">Controls</h3>
            <p className="text-gray-500 text-xs">
              {siteDetail.paused ? 'Paused' : 'Active'} &middot; {siteDetail.control_frequency_seconds}s loop
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowDERConfig(!showDERConfig)}
          className="p-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          title="DER Configuration"
        >
          <Settings className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
          <p className="text-red-400 text-xs">{error}</p>
        </div>
      )}

      {/* Battery Controls */}
      {batteries.map(battery => (
        <div key={battery.der_id} className="mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-green-400" />
              <span className="text-white text-sm font-medium">Battery</span>
              {battery.soc !== null && (
                <span className="text-gray-400 text-xs">
                  {(battery.soc * 100).toFixed(0)}% SoC
                </span>
              )}
            </div>
          </div>

          {/* Charge Now buttons */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => handleChargeNow(battery.der_id)}
              disabled={activeAction !== null || battery.goal_power_override_w !== null}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                battery.goal_power_override_w !== null
                  ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50'
                  : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30'
              } disabled:opacity-50`}
            >
              {activeAction === `charge-${battery.der_id}` ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <BatteryCharging className="w-4 h-4" />
              )}
              {battery.goal_power_override_w !== null ? 'Charging' : 'Charge Now'}
            </button>
            {battery.goal_power_override_w !== null && (
              <button
                onClick={() => handleStopCharge(battery.der_id)}
                disabled={activeAction !== null}
                className="px-3 py-2.5 rounded-lg text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {activeAction === `stop-${battery.der_id}` ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Stop'
                )}
              </button>
            )}
          </div>

          {/* DER Config (expandable) */}
          {showDERConfig && (
            <DERConfigSection
              battery={battery}
              onUpdate={handleUpdateSoCLimits}
              isLoading={activeAction === `config-${battery.der_id}`}
            />
          )}
        </div>
      ))}

      {batteries.length === 0 && (
        <p className="text-gray-500 text-sm">No controllable batteries found</p>
      )}

      {/* Site Config Summary */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-gray-500">Grid Target</p>
            <p className="text-white font-medium">{(siteDetail.grid_target_power_w / 1000).toFixed(1)} kW</p>
          </div>
          <div>
            <p className="text-gray-500">Grid Tolerance</p>
            <p className="text-white font-medium">{(siteDetail.grid_tolerance_w / 1000).toFixed(1)} kW</p>
          </div>
          <div>
            <p className="text-gray-500">Site Power Limit</p>
            <p className="text-white font-medium">{(siteDetail.site_power_limit_w / 1000).toFixed(1)} kW</p>
          </div>
          <div>
            <p className="text-gray-500">Fuse Size</p>
            <p className="text-white font-medium">{siteDetail.fuse_size ?? 'N/A'} A</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── DER Config Section ────────────────────────────────────────────────

interface DERConfigSectionProps {
  battery: EMSDERResponse;
  onUpdate: (derId: string, minSoc: number, maxSoc: number) => void;
  isLoading: boolean;
}

function DERConfigSection({ battery, onUpdate, isLoading }: DERConfigSectionProps) {
  const [minSoc, setMinSoc] = useState(battery.min_soc_percent ?? 0);
  const [maxSoc, setMaxSoc] = useState(battery.max_soc_percent ?? 100);
  const [hasChanges, setHasChanges] = useState(false);

  const handleMinChange = (value: number) => {
    setMinSoc(value);
    setHasChanges(true);
  };

  const handleMaxChange = (value: number) => {
    setMaxSoc(value);
    setHasChanges(true);
  };

  return (
    <div className="bg-gray-700/30 rounded-lg p-3 space-y-3">
      <p className="text-gray-400 text-xs font-medium">SoC Limits</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Min SoC</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0}
              max={maxSoc}
              value={minSoc}
              onChange={(e) => handleMinChange(Number(e.target.value))}
              className="w-24 h-1 accent-blue-400"
            />
            <span className="text-white text-xs w-10 text-right">{minSoc}%</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">Max SoC</span>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={minSoc}
              max={100}
              value={maxSoc}
              onChange={(e) => handleMaxChange(Number(e.target.value))}
              className="w-24 h-1 accent-blue-400"
            />
            <span className="text-white text-xs w-10 text-right">{maxSoc}%</span>
          </div>
        </div>
      </div>

      {/* Capacity info */}
      <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-gray-600/50">
        <div>
          <p className="text-gray-500">Capacity</p>
          <p className="text-white">{((battery.capacity_wh ?? 0) / 1000).toFixed(1)} kWh</p>
        </div>
        <div>
          <p className="text-gray-500">Max Charge</p>
          <p className="text-white">{((battery.max_charge_power_w ?? 0) / 1000).toFixed(1)} kW</p>
        </div>
        <div>
          <p className="text-gray-500">Max Discharge</p>
          <p className="text-white">{((battery.max_discharge_power_w ?? 0) / 1000).toFixed(1)} kW</p>
        </div>
      </div>

      {hasChanges && (
        <button
          onClick={() => {
            onUpdate(battery.der_id, minSoc, maxSoc);
            setHasChanges(false);
          }}
          disabled={isLoading}
          className="w-full py-2 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 border border-blue-500/30 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-3 h-3 animate-spin mx-auto" />
          ) : (
            'Apply SoC Limits'
          )}
        </button>
      )}
    </div>
  );
}
