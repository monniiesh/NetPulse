'use client';

import { THRESHOLDS } from '@/lib/scoring/thresholds';

interface ISPAccountabilityProps {
  metrics: {
    latency: number;
    jitter: number;
    packet_loss: number;
    dns: number;
    bufferbloat: number;
  };
  ispName?: string;
  advertisedDownload?: number;
  advertisedUpload?: number;
  slaUptime?: number;
  actualUptime: number;
  periodStart: string;
  periodEnd: string;
}

const statusColors = {
  good: 'text-green-700',
  fair: 'text-yellow-700',
  poor: 'text-orange-700',
  critical: 'text-red-700',
};

function getStatus(value: number, thresholds: { good: number; fair: number; poor: number; critical: number }): 'good' | 'fair' | 'poor' | 'critical' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.fair) return 'fair';
  if (value <= thresholds.poor) return 'poor';
  return 'critical';
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ISPAccountability({
  metrics,
  ispName,
  advertisedDownload,
  advertisedUpload,
  slaUptime,
  actualUptime,
  periodStart,
  periodEnd,
}: ISPAccountabilityProps) {
  const metricEntries = [
    { label: 'Average Latency', value: metrics.latency, unit: 'ms', key: 'latency' },
    { label: 'Average Jitter', value: metrics.jitter, unit: 'ms', key: 'jitter' },
    { label: 'Average Packet Loss', value: metrics.packet_loss, unit: '%', key: 'packet_loss' },
    { label: 'Average DNS Resolution', value: metrics.dns, unit: 'ms', key: 'dns' },
    { label: 'Average Bufferbloat', value: metrics.bufferbloat, unit: 'ms', key: 'bufferbloat' },
  ];

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">ISP Accountability</h2>

      <div className="mb-4 p-4 bg-blue-50 rounded-lg">
        <div className="text-lg font-semibold text-blue-900">
          {ispName || 'Your ISP'}
        </div>
        <div className="text-sm text-blue-700 mt-1">
          {formatDate(periodStart)} - {formatDate(periodEnd)}
        </div>
      </div>

      {(advertisedDownload || advertisedUpload) && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Advertised vs. Actual Speeds</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Type</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Advertised</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {advertisedDownload && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Download Speed</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {advertisedDownload} Mbps
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right italic">
                      Speed tests not included
                    </td>
                  </tr>
                )}
                {advertisedUpload && (
                  <tr>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">Upload Speed</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right">
                      {advertisedUpload} Mbps
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right italic">
                      Speed tests not included
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {slaUptime !== undefined && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">SLA Compliance</h3>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Metric</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">SLA Target</th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Actual</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">Uptime</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {slaUptime.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {actualUptime.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-center">
                    {actualUptime >= slaUptime ? (
                      <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                        PASS
                      </span>
                    ) : (
                      <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                        FAIL
                      </span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Average Metric Performance</h3>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Metric</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Value</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {metricEntries.map((entry) => {
              const thresholds = THRESHOLDS[entry.key];
              const status = getStatus(entry.value, thresholds);
              return (
                <tr key={entry.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{entry.label}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 text-right">
                    {entry.value.toFixed(entry.key === 'packet_loss' ? 2 : 1)} {entry.unit}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-sm font-semibold ${statusColors[status]}`}>
                      {status.toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="text-lg font-semibold text-gray-900 mb-3">Time in Quality Ranges</h3>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Latency Range</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Jitter Range</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Loss Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            <tr className="bg-green-50">
              <td className="px-4 py-3 text-sm font-semibold text-green-900">Good</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">≤ {THRESHOLDS.latency.good}ms</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">≤ {THRESHOLDS.jitter.good}ms</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">≤ {THRESHOLDS.packet_loss.good}%</td>
            </tr>
            <tr className="bg-yellow-50">
              <td className="px-4 py-3 text-sm font-semibold text-yellow-900">Fair</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.latency.good + 1}-{THRESHOLDS.latency.fair}ms
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.jitter.good + 1}-{THRESHOLDS.jitter.fair}ms
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.packet_loss.good + 0.1}-{THRESHOLDS.packet_loss.fair}%
              </td>
            </tr>
            <tr className="bg-orange-50">
              <td className="px-4 py-3 text-sm font-semibold text-orange-900">Poor</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.latency.fair + 1}-{THRESHOLDS.latency.poor}ms
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.jitter.fair + 1}-{THRESHOLDS.jitter.poor}ms
              </td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">
                {THRESHOLDS.packet_loss.fair + 0.1}-{THRESHOLDS.packet_loss.poor}%
              </td>
            </tr>
            <tr className="bg-red-50">
              <td className="px-4 py-3 text-sm font-semibold text-red-900">Critical</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">&gt; {THRESHOLDS.latency.poor}ms</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">&gt; {THRESHOLDS.jitter.poor}ms</td>
              <td className="px-4 py-3 text-sm text-gray-700 text-right">&gt; {THRESHOLDS.packet_loss.poor}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
