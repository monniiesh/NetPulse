'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Plus, Trash2, Edit2, X, Check, ToggleLeft, ToggleRight } from 'lucide-react';

interface Probe {
  id: string;
  name: string;
  location: string | null;
}

interface AlertConfig {
  id: string;
  probe_id: string | null;
  metric: string;
  threshold: number;
  comparison: string;
  duration_min: number;
  channel: string;
  channel_config: Record<string, string>;
  is_active: boolean;
  created_at: string;
}

const METRICS = [
  { value: 'latency', label: 'Latency (ms)' },
  { value: 'jitter', label: 'Jitter (ms)' },
  { value: 'packet_loss', label: 'Packet Loss (%)' },
  { value: 'dns', label: 'DNS Resolution (ms)' },
  { value: 'bufferbloat', label: 'Bufferbloat (ms)' },
];

const COMPARISONS = [
  { value: 'gt', label: '>' },
  { value: 'gte', label: '>=' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '<=' },
];

const CHANNELS = [
  { value: 'webhook', label: 'Webhook' },
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email' },
];

const DEFAULT_PRESETS: Omit<AlertConfig, 'id' | 'created_at'>[] = [
  { probe_id: null, metric: 'packet_loss', threshold: 5, comparison: 'gt', duration_min: 5, channel: 'webhook', channel_config: { url: '' }, is_active: true },
  { probe_id: null, metric: 'latency', threshold: 200, comparison: 'gt', duration_min: 10, channel: 'webhook', channel_config: { url: '' }, is_active: true },
  { probe_id: null, metric: 'dns', threshold: 500, comparison: 'gt', duration_min: 5, channel: 'webhook', channel_config: { url: '' }, is_active: true },
  { probe_id: null, metric: 'bufferbloat', threshold: 300, comparison: 'gt', duration_min: 10, channel: 'webhook', channel_config: { url: '' }, is_active: true },
];

export default function AlertsClient({ probes }: { probes: Probe[] }) {
  const [alerts, setAlerts] = useState<AlertConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formProbeId, setFormProbeId] = useState<string>('');
  const [formMetric, setFormMetric] = useState('latency');
  const [formThreshold, setFormThreshold] = useState(100);
  const [formComparison, setFormComparison] = useState('gt');
  const [formDuration, setFormDuration] = useState(5);
  const [formChannel, setFormChannel] = useState('webhook');
  const [formChannelConfig, setFormChannelConfig] = useState('');

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/alerts');
      const data = await res.json();
      setAlerts(data.alerts || []);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  function resetForm() {
    setFormProbeId('');
    setFormMetric('latency');
    setFormThreshold(100);
    setFormComparison('gt');
    setFormDuration(5);
    setFormChannel('webhook');
    setFormChannelConfig('');
    setEditingId(null);
    setShowForm(false);
  }

  function startEdit(alert: AlertConfig) {
    setFormProbeId(alert.probe_id || '');
    setFormMetric(alert.metric);
    setFormThreshold(alert.threshold);
    setFormComparison(alert.comparison);
    setFormDuration(alert.duration_min);
    setFormChannel(alert.channel);
    setFormChannelConfig(
      alert.channel === 'email'
        ? alert.channel_config.email || ''
        : alert.channel_config.url || ''
    );
    setEditingId(alert.id);
    setShowForm(true);
  }

  async function handleSave() {
    const channelConfig =
      formChannel === 'email'
        ? { email: formChannelConfig }
        : { url: formChannelConfig };

    const body = {
      probe_id: formProbeId || null,
      metric: formMetric,
      threshold: formThreshold,
      comparison: formComparison,
      duration_min: formDuration,
      channel: formChannel,
      channel_config: channelConfig,
      is_active: true,
    };

    try {
      if (editingId) {
        await fetch('/api/v1/alerts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...body }),
        });
      } else {
        await fetch('/api/v1/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      resetForm();
      fetchAlerts();
    } catch (err) {
      console.error('Failed to save alert:', err);
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/v1/alerts?id=${id}`, { method: 'DELETE' });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to delete alert:', err);
    }
  }

  async function handleToggle(alert: AlertConfig) {
    try {
      await fetch('/api/v1/alerts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: alert.id, is_active: !alert.is_active }),
      });
      fetchAlerts();
    } catch (err) {
      console.error('Failed to toggle alert:', err);
    }
  }

  const channelPlaceholder =
    formChannel === 'email' ? 'alert@example.com' : 'https://hooks.example.com/...';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Bell size={24} />
          Alert Configuration
        </h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Alert
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {editingId ? 'Edit Alert' : 'New Alert'}
            </h2>
            <button onClick={resetForm} className="text-gray-400 hover:text-gray-200">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Probe</label>
              <select
                value={formProbeId}
                onChange={(e) => setFormProbeId(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Probes</option>
                {probes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Metric</label>
              <select
                value={formMetric}
                onChange={(e) => setFormMetric(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                {METRICS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Condition</label>
              <div className="flex gap-2">
                <select
                  value={formComparison}
                  onChange={(e) => setFormComparison(e.target.value)}
                  className="bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                >
                  {COMPARISONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(Number(e.target.value))}
                  className="flex-1 bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                  min={0}
                  step="any"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Duration (minutes)</label>
              <input
                type="number"
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value))}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                min={1}
                max={60}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">Channel</label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value)}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              >
                {CHANNELS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {formChannel === 'email' ? 'Email Address' : 'Webhook URL'}
              </label>
              <input
                type={formChannel === 'email' ? 'email' : 'url'}
                value={formChannelConfig}
                onChange={(e) => setFormChannelConfig(e.target.value)}
                placeholder={channelPlaceholder}
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={resetForm}
              className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              <Check size={16} />
              {editingId ? 'Update' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* Alert List */}
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading alerts...</div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p>No alert rules configured yet</p>
          <p className="text-sm mt-1">Create your first alert to get notified of issues</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-gray-900 rounded-lg border p-4 flex items-center gap-4 ${
                alert.is_active ? 'border-gray-800' : 'border-gray-800/50 opacity-60'
              }`}
            >
              <button
                onClick={() => handleToggle(alert)}
                className="text-gray-400 hover:text-white transition-colors"
                title={alert.is_active ? 'Disable' : 'Enable'}
              >
                {alert.is_active ? (
                  <ToggleRight size={24} className="text-green-400" />
                ) : (
                  <ToggleLeft size={24} />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-white font-medium">
                  <span>{METRICS.find((m) => m.value === alert.metric)?.label || alert.metric}</span>
                  <span className="text-gray-400">
                    {COMPARISONS.find((c) => c.value === alert.comparison)?.label} {alert.threshold}
                  </span>
                  <span className="text-gray-500 text-sm">for {alert.duration_min}min</span>
                </div>
                <div className="text-gray-500 text-sm mt-0.5">
                  {alert.channel} · {alert.probe_id
                    ? probes.find((p) => p.id === alert.probe_id)?.name || 'Unknown probe'
                    : 'All probes'}
                </div>
              </div>

              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(alert)}
                  className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
