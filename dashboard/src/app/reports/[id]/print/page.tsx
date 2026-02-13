import { db, pool } from '@/lib/db';
import { reports, probes, anomalies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { computeQualityScore } from '@/lib/scoring/compute';
import ExecutiveSummary from '@/components/reports/ExecutiveSummary';
import ISPAccountability from '@/components/reports/ISPAccountability';
import Recommendations from '@/components/reports/Recommendations';
import type { MetricName } from '@/types';
import './print.css';

interface ReportMetadata {
  isp_name?: string;
  advertised_download?: number;
  advertised_upload?: number;
  sla_uptime?: number;
}

export default async function ReportPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [report] = await db.select().from(reports).where(eq(reports.id, id)).limit(1);

  if (!report) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Report Not Found</h1>
          <p className="text-gray-600 mt-2">The requested report could not be found.</p>
        </div>
      </div>
    );
  }

  const metadata = (report.metadata as ReportMetadata) || {};

  const [probe] = report.probeId
    ? await db.select().from(probes).where(eq(probes.id, report.probeId)).limit(1)
    : [null];

  const metricsQuery = `
    SELECT
      AVG(latency_avg) as latency,
      AVG(jitter) as jitter,
      AVG(packet_loss) as packet_loss,
      AVG(dns_time) as dns,
      AVG(bufferbloat) as bufferbloat,
      COUNT(*) as total_measurements
    FROM measurements
    WHERE ${report.probeId ? 'probe_id = $1 AND' : ''} time >= $${report.probeId ? 2 : 1} AND time <= $${report.probeId ? 3 : 2}
  `;

  const metricsParams = report.probeId
    ? [report.probeId, report.periodStart, report.periodEnd]
    : [report.periodStart, report.periodEnd];

  const metricsResult = await pool.query(metricsQuery, metricsParams);
  const metricsRow = metricsResult.rows[0];

  const uptimeQuery = `
    SELECT
      COUNT(DISTINCT time_bucket('5 minutes', time)) as buckets_with_data,
      EXTRACT(EPOCH FROM ($${report.probeId ? 3 : 2}::timestamp - $${report.probeId ? 2 : 1}::timestamp)) / 300 as total_buckets
    FROM measurements
    WHERE ${report.probeId ? 'probe_id = $1 AND' : ''} time >= $${report.probeId ? 2 : 1} AND time <= $${report.probeId ? 3 : 2}
  `;

  const uptimeParams = report.probeId
    ? [report.probeId, report.periodStart, report.periodEnd]
    : [report.periodStart, report.periodEnd];

  const uptimeResult = await pool.query(uptimeQuery, uptimeParams);
  const uptimeRow = uptimeResult.rows[0];
  const uptimePercent = uptimeRow.total_buckets > 0
    ? (parseFloat(uptimeRow.buckets_with_data) / parseFloat(uptimeRow.total_buckets)) * 100
    : 0;

  const score = computeQualityScore({
    latency: metricsRow.latency ? parseFloat(metricsRow.latency) : null,
    jitter: metricsRow.jitter ? parseFloat(metricsRow.jitter) : null,
    packet_loss: metricsRow.packet_loss ? parseFloat(metricsRow.packet_loss) : null,
    dns: metricsRow.dns ? parseFloat(metricsRow.dns) : null,
    bufferbloat: metricsRow.bufferbloat ? parseFloat(metricsRow.bufferbloat) : null,
  });

  const anomalyQuery = report.probeId
    ? eq(anomalies.probeId, report.probeId)
    : undefined;

  const anomalyList = anomalyQuery
    ? await db
        .select()
        .from(anomalies)
        .where(anomalyQuery)
        .orderBy(anomalies.startedAt)
    : [];

  const filteredAnomalies = anomalyList.filter(
    (a) =>
      new Date(a.startedAt) >= new Date(report.periodStart) &&
      new Date(a.startedAt) <= new Date(report.periodEnd)
  );

  const patterns = filteredAnomalies
    .filter((a) => a.dayOfWeek !== null && a.hourOfDay !== null)
    .map((a) => {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dayName = days[a.dayOfWeek!];
      const hour = a.hourOfDay! % 12 || 12;
      const ampm = a.hourOfDay! >= 12 ? 'PM' : 'AM';
      return `${a.metric} issues occur regularly on ${dayName}s at ${hour}:00 ${ampm}`;
    });

  const uniquePatterns = [...new Set(patterns)];

  const metricLabels: Record<MetricName, string> = {
    latency: 'Latency',
    jitter: 'Jitter',
    packet_loss: 'Packet Loss',
    dns: 'DNS',
    bufferbloat: 'Bufferbloat',
  };

  const severityColors = {
    mild: 'bg-yellow-100 text-yellow-800',
    moderate: 'bg-orange-100 text-orange-800',
    severe: 'bg-red-100 text-red-800',
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="max-w-5xl mx-auto p-8">
        <header className="mb-12 pb-6 border-b-2 border-gray-300">
          <h1 className="text-4xl font-bold text-gray-900">NetPulse ISP Quality Report</h1>
          <p className="text-gray-600 mt-2">Professional Network Performance Analysis</p>
        </header>

        <ExecutiveSummary
          score={score}
          periodStart={report.periodStart.toISOString()}
          periodEnd={report.periodEnd.toISOString()}
          probeName={probe?.name || 'Unknown Probe'}
          totalMeasurements={parseInt(metricsRow.total_measurements)}
          uptimePercent={uptimePercent}
        />

        <div className="page-break" />

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Metric Performance</h2>
          <div className="space-y-4">
            {Object.entries(score.breakdown).map(([metric, data]) => (
              <div key={metric} className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900">
                    {metricLabels[metric as MetricName]}
                  </span>
                  <span className="text-sm text-gray-600">
                    {metric === 'packet_loss'
                      ? `${data.value.toFixed(2)}%`
                      : `${data.value.toFixed(1)}ms`}
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full ${
                      data.status === 'good'
                        ? 'bg-green-500'
                        : data.status === 'fair'
                        ? 'bg-yellow-500'
                        : data.status === 'poor'
                        ? 'bg-orange-500'
                        : 'bg-red-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (data.value / (data.status === 'critical' ? data.value : data.value * 1.5)) * 100)}%`,
                    }}
                  />
                </div>
                <div className="mt-1 text-xs text-gray-600 text-right">
                  {data.status.toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="page-break" />

        <ISPAccountability
          metrics={{
            latency: parseFloat(metricsRow.latency || '0'),
            jitter: parseFloat(metricsRow.jitter || '0'),
            packet_loss: parseFloat(metricsRow.packet_loss || '0'),
            dns: parseFloat(metricsRow.dns || '0'),
            bufferbloat: parseFloat(metricsRow.bufferbloat || '0'),
          }}
          ispName={metadata.isp_name}
          advertisedDownload={metadata.advertised_download}
          advertisedUpload={metadata.advertised_upload}
          slaUptime={metadata.sla_uptime}
          actualUptime={uptimePercent}
          periodStart={report.periodStart.toISOString()}
          periodEnd={report.periodEnd.toISOString()}
        />

        <div className="page-break" />

        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Anomaly Report</h2>
          {filteredAnomalies.length === 0 ? (
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <p className="text-green-800">
                No anomalies detected during this period. Your connection was stable.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Time
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">
                      Metric
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Expected
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      Actual
                    </th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">
                      Severity
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredAnomalies.slice(0, 20).map((anomaly) => (
                    <tr key={anomaly.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {new Date(anomaly.startedAt).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {metricLabels[anomaly.metric as MetricName] || anomaly.metric}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {anomaly.expectedValue.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 text-right">
                        {anomaly.actualValue.toFixed(1)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-block px-3 py-1 text-xs font-semibold rounded-full ${
                            severityColors[anomaly.severity as keyof typeof severityColors]
                          }`}
                        >
                          {anomaly.severity.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAnomalies.length > 20 && (
                <div className="bg-gray-50 px-4 py-3 text-sm text-gray-600 text-center">
                  Showing 20 of {filteredAnomalies.length} anomalies
                </div>
              )}
            </div>
          )}
        </section>

        <div className="page-break" />

        <Recommendations
          score={score}
          anomalyCount={filteredAnomalies.length}
          patternDescriptions={uniquePatterns}
        />

        <footer className="mt-12 pt-6 border-t border-gray-300 text-center text-sm text-gray-600">
          <p>Generated by NetPulse on {new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}</p>
        </footer>
      </div>
    </div>
  );
}
