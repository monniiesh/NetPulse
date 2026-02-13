'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Eye, Trash2, Plus, ChevronUp, Loader2 } from 'lucide-react';
import type { ProbeOption } from '@/types';

interface Report {
  id: string;
  probe_id: string;
  period_start: string;
  period_end: string;
  status: string;
  created_at: string;
  metadata: {
    isp_name?: string;
    advertised_download?: number;
    advertised_upload?: number;
    sla_uptime?: number;
  } | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  generating: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  ready: 'text-green-400 bg-green-400/10 border-green-400/20',
  failed: 'text-red-400 bg-red-400/10 border-red-400/20',
};

export default function ReportsClient({ probes }: { probes: ProbeOption[] }) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    probeId: probes[0]?.id || '',
    periodStart: '',
    periodEnd: '',
    ispName: '',
    advertisedDownload: '',
    advertisedUpload: '',
    slaUptime: '',
  });

  const fetchReports = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/reports');
      const data = await res.json();
      setReports(data.reports || []);
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-refresh for pending/generating reports
  useEffect(() => {
    const hasPending = reports.some(
      (r) => r.status === 'pending' || r.status === 'generating'
    );
    if (!hasPending) return;

    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, [reports, fetchReports]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload: Record<string, unknown> = {
      probe_id: formData.probeId,
      period_start: new Date(formData.periodStart).toISOString(),
      period_end: new Date(formData.periodEnd).toISOString(),
    };

    const metadata: Record<string, number | string> = {};
    if (formData.ispName) metadata.isp_name = formData.ispName;
    if (formData.advertisedDownload) metadata.advertised_download = Number(formData.advertisedDownload);
    if (formData.advertisedUpload) metadata.advertised_upload = Number(formData.advertisedUpload);
    if (formData.slaUptime) metadata.sla_uptime = Number(formData.slaUptime);

    if (Object.keys(metadata).length > 0) {
      payload.metadata = metadata;
    }

    try {
      const res = await fetch('/api/v1/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setFormData({
          probeId: probes[0]?.id || '',
          periodStart: '',
          periodEnd: '',
          ispName: '',
          advertisedDownload: '',
          advertisedUpload: '',
          slaUptime: '',
        });
        setShowCreateForm(false);
        fetchReports();
      } else {
        const error = await res.json();
        alert(`Failed to create report: ${error.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to create report:', err);
      alert('Failed to create report');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this report?')) return;

    try {
      const res = await fetch(`/api/v1/reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchReports();
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
    }
  };

  const getProbeNameById = (id: string) =>
    probes.find((p) => p.id === id)?.name || 'Unknown Probe';

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Reports</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {showCreateForm ? <ChevronUp size={16} /> : <Plus size={16} />}
          New Report
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Generate ISP Quality Report</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Probe <span className="text-red-400">*</span>
                </label>
                <select
                  value={formData.probeId}
                  onChange={(e) => setFormData({ ...formData, probeId: e.target.value })}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  required
                >
                  {probes.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">ISP Name</label>
                <input
                  type="text"
                  value={formData.ispName}
                  onChange={(e) => setFormData({ ...formData, ispName: e.target.value })}
                  placeholder="e.g., Comcast"
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Period Start <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.periodStart}
                  onChange={(e) => setFormData({ ...formData, periodStart: e.target.value })}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Period End <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  value={formData.periodEnd}
                  onChange={(e) => setFormData({ ...formData, periodEnd: e.target.value })}
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Advertised Download (Mbps)
                </label>
                <input
                  type="number"
                  value={formData.advertisedDownload}
                  onChange={(e) => setFormData({ ...formData, advertisedDownload: e.target.value })}
                  placeholder="e.g., 1000"
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Advertised Upload (Mbps)
                </label>
                <input
                  type="number"
                  value={formData.advertisedUpload}
                  onChange={(e) => setFormData({ ...formData, advertisedUpload: e.target.value })}
                  placeholder="e.g., 50"
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  SLA Uptime (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.slaUptime}
                  onChange={(e) => setFormData({ ...formData, slaUptime: e.target.value })}
                  placeholder="e.g., 99.9"
                  className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {submitting && <Loader2 size={16} className="animate-spin" />}
                {submitting ? 'Creating...' : 'Generate Report'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText size={20} className="text-gray-400" />
          Generated Reports ({reports.length})
        </h2>

        {loading ? (
          <div className="text-gray-400 text-center py-8">Loading reports...</div>
        ) : reports.length === 0 ? (
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8 text-center">
            <FileText size={48} className="text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No reports yet. Generate your first ISP quality report.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                probeName={getProbeNameById(report.probe_id)}
                formatDate={formatDate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  report,
  probeName,
  formatDate,
  onDelete,
}: {
  report: Report;
  probeName: string;
  formatDate: (iso: string) => string;
  onDelete: (id: string) => void;
}) {
  const statusClass = STATUS_COLORS[report.status] || STATUS_COLORS.pending;
  const isReady = report.status === 'ready';
  const isGenerating = report.status === 'generating';

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-5 flex items-center gap-4">
      <FileText size={24} className="text-gray-400 flex-shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-white font-medium">{probeName}</span>
          <div className={`px-3 py-1 rounded-full border text-xs font-medium flex items-center gap-1.5 ${statusClass}`}>
            {isGenerating && <Loader2 size={12} className="animate-spin" />}
            {report.status}
          </div>
        </div>
        <div className="text-gray-400 text-sm">
          Period: {formatDate(report.period_start)} - {formatDate(report.period_end)}
        </div>
        {report.metadata?.isp_name && (
          <div className="text-gray-500 text-xs mt-1">ISP: {report.metadata.isp_name}</div>
        )}
        <div className="text-gray-500 text-xs">Created: {formatDate(report.created_at)}</div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {isReady && (
          <>
            <a
              href={`/api/v1/reports/${report.id}`}
              download
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Download size={16} />
              PDF
            </a>
            <a
              href={`/reports/${report.id}/print`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Eye size={16} />
            </a>
          </>
        )}
        <button
          onClick={() => onDelete(report.id)}
          className="flex items-center bg-gray-800 hover:bg-red-900/30 text-gray-400 hover:text-red-400 px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
