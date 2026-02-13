'use client';

import type { QualityScore } from '@/types';

interface ExecutiveSummaryProps {
  score: QualityScore;
  periodStart: string;
  periodEnd: string;
  probeName: string;
  totalMeasurements: number;
  uptimePercent: number;
}

const gradeColors = {
  A: 'text-green-700',
  B: 'text-blue-700',
  C: 'text-yellow-700',
  D: 'text-orange-700',
  F: 'text-red-700',
};

const gradeBgColors = {
  A: 'bg-green-50',
  B: 'bg-blue-50',
  C: 'bg-yellow-50',
  D: 'bg-orange-50',
  F: 'bg-red-50',
};

const statusColors = {
  good: 'bg-green-100 text-green-800',
  fair: 'bg-yellow-100 text-yellow-800',
  poor: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const metricLabels = {
  latency: 'Latency',
  jitter: 'Jitter',
  packet_loss: 'Packet Loss',
  dns: 'DNS Resolution',
  bufferbloat: 'Bufferbloat',
};

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function ExecutiveSummary({
  score,
  periodStart,
  periodEnd,
  probeName,
  totalMeasurements,
  uptimePercent,
}: ExecutiveSummaryProps) {
  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Executive Summary</h2>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className={`p-6 rounded-lg ${gradeBgColors[score.grade]} flex items-center justify-center`}>
          <div className="text-center">
            <div className={`text-8xl font-bold ${gradeColors[score.grade]}`}>
              {score.grade}
            </div>
            <div className="mt-2 text-xl font-semibold text-gray-700">
              Score: {score.score.toFixed(1)}/100
            </div>
            <div className="mt-1 text-lg text-gray-600">
              {score.label}
            </div>
          </div>
        </div>

        <div className="p-6 bg-gray-50 rounded-lg">
          <div className="space-y-3">
            <div>
              <div className="text-sm font-medium text-gray-600">Probe</div>
              <div className="text-lg font-semibold text-gray-900">{probeName}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-600">Period</div>
              <div className="text-lg text-gray-900">
                {formatDate(periodStart)} - {formatDate(periodEnd)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <div className="text-sm font-medium text-gray-600">Measurements</div>
                <div className="text-lg font-semibold text-gray-900">
                  {totalMeasurements.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">Uptime</div>
                <div className="text-lg font-semibold text-gray-900">
                  {uptimePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {score.primary_issue && (
        <div className="mb-6 p-4 bg-orange-50 border-l-4 border-orange-400 rounded">
          <div className="text-sm font-semibold text-orange-900">Primary Issue</div>
          <div className="text-gray-800 mt-1">{score.primary_issue}</div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">Metric</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Value</th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">Penalty</th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Object.entries(score.breakdown).map(([metric, data]) => (
              <tr key={metric} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                  {metricLabels[metric as keyof typeof metricLabels]}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-right">
                  {metric === 'packet_loss'
                    ? `${data.value.toFixed(2)}%`
                    : `${data.value.toFixed(1)}ms`}
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 text-right">
                  {data.penalty.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${statusColors[data.status]}`}>
                    {data.status.toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
