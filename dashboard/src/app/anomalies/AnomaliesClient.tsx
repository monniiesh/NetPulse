'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, TrendingUp, Filter } from 'lucide-react';
import AnomalyHeatmap from '@/components/charts/AnomalyHeatmap';
import type { ProbeOption } from '@/types';

interface Anomaly {
  id: string;
  probe_id: string;
  started_at: string;
  ended_at: string | null;
  metric: string;
  expected_value: number;
  actual_value: number;
  severity: string;
  day_of_week: number | null;
  hour_of_day: number | null;
  description: string | null;
}

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  moderate: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  severe: 'text-red-400 bg-red-400/10 border-red-400/20',
};

const METRIC_LABELS: Record<string, string> = {
  latency: 'Latency',
  jitter: 'Jitter',
  packet_loss: 'Packet Loss',
  dns: 'DNS',
  bufferbloat: 'Bufferbloat',
};

const METRIC_UNITS: Record<string, string> = {
  latency: 'ms',
  jitter: 'ms',
  packet_loss: '%',
  dns: 'ms',
  bufferbloat: 'ms',
};

export default function AnomaliesClient({ probes }: { probes: ProbeOption[] }) {
  const [selectedProbe, setSelectedProbe] = useState(probes[0]?.id || '');
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [metricFilter, setMetricFilter] = useState<string>('');
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const fetchAnomalies = useCallback(async () => {
    if (!selectedProbe) return;
    setLoading(true);

    const params = new URLSearchParams({ probe_id: selectedProbe, limit: '200' });
    if (metricFilter) params.set('metric', metricFilter);
    if (severityFilter) params.set('severity', severityFilter);

    try {
      const res = await fetch(`/api/v1/anomalies?${params}`);
      const data = await res.json();
      setAnomalies(data.anomalies || []);
    } catch (err) {
      console.error('Failed to fetch anomalies:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProbe, metricFilter, severityFilter]);

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  const activeAnomalies = anomalies.filter((a) => !a.ended_at);
  const closedAnomalies = anomalies.filter((a) => a.ended_at);

  function formatDuration(start: string, end: string | null): string {
    if (!end) return 'Ongoing';
    const ms = new Date(end).getTime() - new Date(start).getTime();
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }

  function formatTime(iso: string): string {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Anomalies</h1>
        <div className="flex gap-3">
          <select
            value={selectedProbe}
            onChange={(e) => setSelectedProbe(e.target.value)}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            {probes.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={metricFilter}
            onChange={(e) => setMetricFilter(e.target.value)}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Metrics</option>
            {Object.entries(METRIC_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All Severities</option>
            <option value="mild">Mild</option>
            <option value="moderate">Moderate</option>
            <option value="severe">Severe</option>
          </select>
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Anomaly Heatmap</h2>
        <AnomalyHeatmap anomalies={anomalies} />
      </div>

      {/* Active Anomalies */}
      {activeAnomalies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
            Active Anomalies ({activeAnomalies.length})
          </h2>
          <div className="space-y-2">
            {activeAnomalies.map((a) => (
              <AnomalyCard key={a.id} anomaly={a} formatTime={formatTime} formatDuration={formatDuration} />
            ))}
          </div>
        </div>
      )}

      {/* Historical Anomalies */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock size={20} className="text-gray-400" />
          History ({closedAnomalies.length})
        </h2>
        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading anomalies...</div>
        ) : closedAnomalies.length === 0 ? (
          <div className="text-gray-400 text-center py-8">No anomalies detected yet</div>
        ) : (
          <div className="space-y-2">
            {closedAnomalies.map((a) => (
              <AnomalyCard key={a.id} anomaly={a} formatTime={formatTime} formatDuration={formatDuration} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AnomalyCard({
  anomaly,
  formatTime,
  formatDuration,
}: {
  anomaly: Anomaly;
  formatTime: (iso: string) => string;
  formatDuration: (start: string, end: string | null) => string;
}) {
  const severityClass = SEVERITY_COLORS[anomaly.severity] || SEVERITY_COLORS.mild;
  const unit = METRIC_UNITS[anomaly.metric] || '';
  const ratio = (anomaly.actual_value / anomaly.expected_value).toFixed(1);

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex items-center gap-4">
      <div className={`px-3 py-1 rounded-full border text-xs font-medium ${severityClass}`}>
        {anomaly.severity}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">
            {METRIC_LABELS[anomaly.metric] || anomaly.metric}
          </span>
          <span className="text-gray-500 text-sm">
            {anomaly.description}
          </span>
        </div>
        <div className="text-gray-400 text-sm mt-1">
          Expected: {anomaly.expected_value.toFixed(1)}{unit} ·
          Actual: {anomaly.actual_value.toFixed(1)}{unit} ·
          {ratio}x normal
        </div>
      </div>
      <div className="text-right text-sm">
        <div className="text-gray-300">{formatTime(anomaly.started_at)}</div>
        <div className="text-gray-500">{formatDuration(anomaly.started_at, anomaly.ended_at)}</div>
      </div>
    </div>
  );
}
