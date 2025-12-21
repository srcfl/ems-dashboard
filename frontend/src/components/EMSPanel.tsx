import { useState, useEffect, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { EMSStatusCard } from './EMSStatusCard';
import { EMSScheduleChart } from './EMSScheduleChart';
import {
  checkSiteHasEMS,
  getEMSStatus,
  getEMSDERs,
  getEMSSchedule,
  getCurrentSlot,
} from '../api/ems-client';
import type { EMSSite, EMSStatus, EMSDER, EMSParsedSchedule, EMSParsedSlot } from '../api/ems-types';

interface EMSPanelProps {
  siteId: string;
}

export function EMSPanel({ siteId }: EMSPanelProps) {
  const [emsSite, setEmsSite] = useState<EMSSite | null>(null);
  const [status, setStatus] = useState<EMSStatus | null>(null);
  const [ders, setDers] = useState<EMSDER[]>([]);
  const [schedule, setSchedule] = useState<EMSParsedSchedule | null>(null);
  const [currentSlot, setCurrentSlot] = useState<EMSParsedSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchEMSData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // First check if site has EMS
      const site = await checkSiteHasEMS(siteId);
      setEmsSite(site);

      if (!site) {
        setLoading(false);
        return;
      }

      // Fetch all EMS data in parallel
      const [statusData, dersData, scheduleData] = await Promise.all([
        getEMSStatus(siteId),
        getEMSDERs(siteId),
        getEMSSchedule(siteId),
      ]);

      setStatus(statusData);
      setDers(dersData);
      setSchedule(scheduleData);
      setCurrentSlot(getCurrentSlot(scheduleData));
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Failed to fetch EMS data:', e);
      setError(e instanceof Error ? e.message : 'Failed to fetch EMS data');
    } finally {
      setLoading(false);
    }
  }, [siteId]);

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

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(fetchEMSData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchEMSData]);

  // Don't show panel if site doesn't have EMS and we're not loading
  if (!loading && !emsSite) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Energy Management System</h2>
        <div className="flex items-center gap-4">
          {lastRefresh && (
            <span className="text-gray-500 text-xs">
              Updated {lastRefresh.toLocaleTimeString('sv-SE')}
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

      {/* Status Card */}
      <EMSStatusCard
        status={status}
        ders={ders}
        currentSlot={currentSlot}
        loading={loading}
      />

      {/* Schedule Chart */}
      <EMSScheduleChart
        schedule={schedule}
        loading={loading}
      />
    </div>
  );
}
