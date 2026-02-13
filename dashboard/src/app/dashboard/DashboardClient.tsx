'use client';

import { useState, useEffect, useCallback } from 'react';
import { QualityScore } from '@/components/dashboard/QualityScore';
import { MetricCard } from '@/components/dashboard/MetricCard';
import { ProbeSelector } from '@/components/dashboard/ProbeSelector';
import { LiveIndicator } from '@/components/dashboard/LiveIndicator';
import { Activity, Waves, AlertTriangle, Globe, Gauge } from 'lucide-react';
import type { QualityScore as QualityScoreType, MetricPenalty, ProbeOption } from '@/types';

interface DashboardProbe extends ProbeOption {
  isActive: boolean | null;
}

interface DashboardClientProps {
  probes: DashboardProbe[];
}

interface SSEConnectionStatus {
  status: 'connected' | 'reconnecting' | 'disconnected';
}

export function DashboardClient({ probes }: DashboardClientProps) {
  const [selectedProbeId, setSelectedProbeId] = useState<string>(
    probes[0]?.id || ''
  );
  const [scoreData, setScoreData] = useState<QualityScoreType | null>(null);
  const [metrics, setMetrics] = useState<Record<string, MetricPenalty>>({});
  const [sseStatus, setSseStatus] = useState<SSEConnectionStatus['status']>('disconnected');
  const [loading, setLoading] = useState(true);

  const fetchScore = useCallback(async (probeId: string) => {
    try {
      const response = await fetch(`/api/v1/score?probe_id=${probeId}`);
      if (response.ok) {
        const data = await response.json();
        setScoreData(data);
        setMetrics(data.breakdown);
      }
    } catch (error) {
      console.error('Failed to fetch score:', error);
    }
  }, []);

  useEffect(() => {
    if (!selectedProbeId) return;

    setLoading(true);
    fetchScore(selectedProbeId)
      .finally(() => setLoading(false));

    const scoreInterval = setInterval(() => {
      fetchScore(selectedProbeId);
    }, 60000);

    return () => clearInterval(scoreInterval);
  }, [selectedProbeId, fetchScore]);

  useEffect(() => {
    if (!selectedProbeId) return;

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connect = () => {
      setSseStatus('reconnecting');

      eventSource = new EventSource(
        `/api/v1/events?probe_ids=${selectedProbeId}`
      );

      eventSource.addEventListener('connected', () => {
        setSseStatus('connected');
      });

      eventSource.addEventListener('measurement', (event) => {
        const data = JSON.parse(event.data);
        fetchScore(selectedProbeId);
      });

      eventSource.onerror = () => {
        setSseStatus('disconnected');
        eventSource?.close();

        reconnectTimeout = setTimeout(() => {
          connect();
        }, 5000);
      };
    };

    connect();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [selectedProbeId, fetchScore]);

  if (probes.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-2">No Probes Found</h2>
          <p className="text-gray-400">Register a probe to start monitoring.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="text-white">
      <div>
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">NetPulse Dashboard</h1>
            <ProbeSelector
              probes={probes}
              selectedId={selectedProbeId}
              onChange={setSelectedProbeId}
            />
          </div>
          <LiveIndicator status={sseStatus} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">Loading...</div>
          </div>
        ) : scoreData ? (
          <>
            <div className="mb-12">
              <QualityScore
                score={scoreData.score}
                grade={scoreData.grade}
                label={scoreData.label}
                profile={scoreData.profile}
                primaryIssue={scoreData.primary_issue}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <MetricCard
                name="Latency"
                value={metrics.latency?.value ?? null}
                unit="ms"
                status={metrics.latency?.status || 'good'}
                icon={<Activity className="w-5 h-5" />}
              />
              <MetricCard
                name="Jitter"
                value={metrics.jitter?.value ?? null}
                unit="ms"
                status={metrics.jitter?.status || 'good'}
                icon={<Waves className="w-5 h-5" />}
              />
              <MetricCard
                name="Packet Loss"
                value={metrics.packet_loss?.value ?? null}
                unit="%"
                status={metrics.packet_loss?.status || 'good'}
                icon={<AlertTriangle className="w-5 h-5" />}
              />
              <MetricCard
                name="DNS"
                value={metrics.dns?.value ?? null}
                unit="ms"
                status={metrics.dns?.status || 'good'}
                icon={<Globe className="w-5 h-5" />}
              />
              <MetricCard
                name="Bufferbloat"
                value={metrics.bufferbloat?.value ?? null}
                unit="ms"
                status={metrics.bufferbloat?.status || 'good'}
                icon={<Gauge className="w-5 h-5" />}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">No data available</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardClient;
