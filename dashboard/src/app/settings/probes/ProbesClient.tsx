'use client';

import { useState, useEffect, useCallback } from 'react';
import { Cpu, Plus, Trash2, RefreshCw, Circle, Copy, X, Check } from 'lucide-react';

interface Probe {
  id: string;
  name: string;
  location: string | null;
  lastSeen: string | null;
  isActive: boolean;
  apiKeyPrefix?: string;
}

export default function ProbesClient() {
  const [probes, setProbes] = useState<Probe[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchProbes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/probes');
      const data = await res.json();
      setProbes(data.probes || []);
    } catch (err) {
      console.error('Failed to fetch probes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProbes();
  }, [fetchProbes]);

  function isOnline(lastSeen: string | null): boolean {
    if (!lastSeen) return false;
    return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
  }

  function formatLastSeen(lastSeen: string | null): string {
    if (!lastSeen) return 'Never';
    const diff = Date.now() - new Date(lastSeen).getTime();
    if (diff < 60_000) return 'Just now';
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    return `${Math.floor(diff / 86400_000)}d ago`;
  }

  async function handleRegister() {
    if (!formName.trim()) return;
    try {
      const res = await fetch('/api/v1/probes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formName, location: formLocation || undefined }),
      });
      const data = await res.json();
      if (data.api_key) {
        setNewApiKey(data.api_key);
      }
      setFormName('');
      setFormLocation('');
      setShowForm(false);
      fetchProbes();
    } catch (err) {
      console.error('Failed to register probe:', err);
    }
  }

  async function handleRotateKey(probeId: string) {
    if (!confirm('Rotate API key? The probe will need to be reconfigured with the new key.')) return;
    try {
      const res = await fetch(`/api/v1/probes/${probeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rotate_key: true }),
      });
      const data = await res.json();
      if (data.api_key) {
        setNewApiKey(data.api_key);
      }
    } catch (err) {
      console.error('Failed to rotate key:', err);
    }
  }

  async function handleDelete(probeId: string) {
    if (!confirm('Delete this probe? This action cannot be undone.')) return;
    try {
      await fetch(`/api/v1/probes/${probeId}`, { method: 'DELETE' });
      fetchProbes();
    } catch (err) {
      console.error('Failed to delete probe:', err);
    }
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Cpu size={24} />
          Probe Management
        </h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          Register Probe
        </button>
      </div>

      {/* New API Key Modal */}
      {newApiKey && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-6 space-y-3">
          <h3 className="text-green-400 font-semibold">API Key Generated</h3>
          <p className="text-gray-400 text-sm">Save this key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-gray-800 text-green-400 px-4 py-2 rounded-lg text-sm font-mono break-all">
              {newApiKey}
            </code>
            <button
              onClick={() => copyToClipboard(newApiKey)}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Copy to clipboard"
            >
              {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} />}
            </button>
          </div>
          <button
            onClick={() => { setNewApiKey(null); setCopied(false); }}
            className="text-sm text-gray-400 hover:text-gray-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Register Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Register New Probe</h2>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-200">
              <X size={20} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Home Office Pi"
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Location</label>
              <input
                type="text"
                value={formLocation}
                onChange={(e) => setFormLocation(e.target.value)}
                placeholder="New York, US"
                className="w-full bg-gray-800 text-gray-200 border border-gray-700 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-400 hover:text-gray-200 text-sm">Cancel</button>
            <button onClick={handleRegister} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">
              <Check size={16} />
              Register
            </button>
          </div>
        </div>
      )}

      {/* Probe List */}
      {loading ? (
        <div className="text-gray-400 text-center py-8">Loading probes...</div>
      ) : probes.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Cpu size={48} className="mx-auto mb-4 opacity-30" />
          <p>No probes registered yet</p>
          <p className="text-sm mt-1">Register your first probe to start monitoring</p>
        </div>
      ) : (
        <div className="space-y-2">
          {probes.map((probe) => (
            <div key={probe.id} className="bg-gray-900 rounded-lg border border-gray-800 p-4 flex items-center gap-4">
              <Circle
                size={12}
                className={isOnline(probe.lastSeen) ? 'text-green-400 fill-green-400' : 'text-red-400 fill-red-400'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-white font-medium">
                  <span>{probe.name}</span>
                  {probe.location && <span className="text-gray-500 text-sm">· {probe.location}</span>}
                </div>
                <div className="text-gray-500 text-sm mt-0.5">
                  {isOnline(probe.lastSeen) ? 'Online' : 'Offline'} · Last seen: {formatLastSeen(probe.lastSeen)} · Key: {probe.apiKeyPrefix || 'np_probe_...'}...
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => handleRotateKey(probe.id)}
                  className="p-2 text-gray-400 hover:text-yellow-400 transition-colors"
                  title="Rotate API Key"
                >
                  <RefreshCw size={16} />
                </button>
                <button
                  onClick={() => handleDelete(probe.id)}
                  className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                  title="Delete Probe"
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
