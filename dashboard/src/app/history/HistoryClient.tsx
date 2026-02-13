'use client';

import { useState, useEffect, useCallback } from 'react';
import TimeRangeSelector from '@/components/charts/TimeRangeSelector';
import ChartContainer from '@/components/charts/ChartContainer';
import LatencyChart from '@/components/charts/LatencyChart';
import JitterChart from '@/components/charts/JitterChart';
import PacketLossChart from '@/components/charts/PacketLossChart';
import DnsChart from '@/components/charts/DnsChart';
import BufferbloatChart from '@/components/charts/BufferbloatChart';
import { TimeRange, timeRangeToParams } from '@/lib/chart-utils';

interface Probe {
  id: string;
  name: string;
  location: string | null;
}

interface MetricDataPoint {
  time: string;
  latency_avg: number | null;
  latency_p95: number | null;
  jitter_avg: number | null;
  packet_loss_avg: number | null;
  dns_time_avg: number | null;
  bufferbloat_avg: number | null;
}

interface HistoryClientProps {
  probes: Probe[];
}

export function HistoryClient({ probes }: HistoryClientProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedProbeId, setSelectedProbeId] = useState<string>('');
  const [data, setData] = useState<MetricDataPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (probes.length > 0 && !selectedProbeId) {
      setSelectedProbeId(probes[0].id);
    }
  }, [probes, selectedProbeId]);

  const fetchMetrics = useCallback(async () => {
    if (!selectedProbeId) return;
    setLoading(true);

    const { from, to, resolution } = timeRangeToParams(timeRange);

    try {
      const res = await fetch(
        `/api/v1/metrics?probe_id=${selectedProbeId}&from=${from}&to=${to}&resolution=${resolution}`
      );
      const json = await res.json();
      setData(json.data || []);
    } catch (err) {
      console.error('Failed to fetch metrics:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProbeId, timeRange]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  const selectedProbe = probes.find(p => p.id === selectedProbeId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">History</h1>
          {selectedProbe && (
            <p className="text-gray-400 mt-1">
              {selectedProbe.name} {selectedProbe.location && `• ${selectedProbe.location}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-4">
          <select
            value={selectedProbeId}
            onChange={(e) => setSelectedProbeId(e.target.value)}
            className="px-4 py-2 bg-gray-800 text-gray-200 rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {probes.map((probe) => (
              <option key={probe.id} value={probe.id}>
                {probe.name} {probe.location && `(${probe.location})`}
              </option>
            ))}
          </select>
          <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
        </div>
      </div>

      <div className="space-y-6">
        <ChartContainer title="Latency" loading={loading}>
          <LatencyChart data={data} height={300} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Jitter" loading={loading}>
          <JitterChart data={data} height={300} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Packet Loss" loading={loading}>
          <PacketLossChart data={data} height={300} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="DNS Resolution Time" loading={loading}>
          <DnsChart data={data} height={300} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Bufferbloat" loading={loading}>
          <BufferbloatChart data={data} height={300} timeRange={timeRange} />
        </ChartContainer>
      </div>
    </div>
  );
}
