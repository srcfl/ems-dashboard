import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { useDataContext } from '../contexts/DataContext';
import { EMSStatusCard } from './EMSStatusCard';
import { EMSScheduleChart } from './EMSScheduleChart';
import { EMSControlPanel } from './EMSControlPanel';
import {
  checkSiteHasEMS,
  getEMSStatus,
  getEMSSiteDetail,
  getEMSSchedule,
  getCurrentSlot,
} from '../api/ems-manager-client';
import type {
  EMSSiteListItem,
  EMSSiteDetail,
  EMSCombinedStatus,
  EMSParsedSchedule,
  EMSParsedSlot,
} from '../api/ems-manager-types';

interface EMSPanelProps {
  siteId: string;
}

export function EMSPanel({ siteId }: EMSPanelProps) {
  const { credentials } = useDataContext();
  const [emsSite, setEmsSite] = useState<EMSSiteListItem | null>(null);
  const [siteDetail, setSiteDetail] = useState<EMSSiteDetail | null>(null);
  const [status, setStatus] = useState<EMSCombinedStatus | null>(null);
  const [schedule, setSchedule] = useState<EMSParsedSchedule | null>(null);
  const [currentSlot, setCurrentSlot] = useState<EMSParsedSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchEMSData = useCallback(async () => {
    if (!credentials) return;

    try {
      setLoading(true);
      setError(null);

      // Check if site has EMS
      const site = await checkSiteHasEMS(siteId, credentials);
      setEmsSite(site);

      if (!site) {
        setLoading(false);
        return;
      }

      // Fetch all EMS data in parallel
      const [statusData, detailData, scheduleData] = await Promise.allSettled([
        getEMSStatus(siteId, credentials),
        getEMSSiteDetail(siteId, credentials),
        getEMSSchedule(siteId, credentials),
      ]);

      if (statusData.status === 'fulfilled') setStatus(statusData.value);
      if (detailData.status === 'fulfilled') setSiteDetail(detailData.value);
      if (scheduleData.status === 'fulfilled') {
        setSchedule(scheduleData.value);
        setCurrentSlot(getCurrentSlot(scheduleData.value));
      }

      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to fetch EMS data:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch EMS data');
    } finally {
      setLoading(false);
    }
  }, [siteId, credentials]);

  // Initial fetch
  useEffect(() => {
    fetchEMSData();
  }, [fetchEMSData]);

  // Update current slot every minute
  useEffect(() => {
    if (!schedule) return;
    const interval = setInterval(() => {
      setCurrentSlot(getCurrentSlot(schedule));
    }, 60000);
    return () => clearInterval(interval);
  }, [schedule]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(fetchEMSData, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEMSData]);

  // Don't show panel if site doesn't have EMS
  if (!loading && !emsSite) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white">Energy Management</h2>
          {status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status.overall_health === 'healthy'
                ? 'bg-green-500/20 text-green-400'
                : status.overall_health === 'degraded'
                ? 'bg-yellow-500/20 text-yellow-400'
                : 'bg-red-500/20 text-red-400'
            }`}>
              {status.overall_health}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-gray-500 text-xs">
              {lastRefresh.toLocaleTimeString('sv-SE')}
            </span>
          )}
          <button
            onClick={fetchEMSData}
            disabled={loading}
            className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Status + Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EMSStatusCard
          status={status}
          siteDetail={siteDetail}
          currentSlot={currentSlot}
          loading={loading}
        />
        {siteDetail && credentials && (
          <EMSControlPanel
            siteId={siteId}
            siteDetail={siteDetail}
            onUpdate={fetchEMSData}
          />
        )}
      </div>

      {/* Schedule Chart */}
      <EMSScheduleChart
        schedule={schedule}
        loading={loading}
      />
    </div>
  );
}
