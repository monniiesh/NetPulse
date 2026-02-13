import { pool } from '@/lib/db';

export interface BaselineBucket {
  probeId: string;
  hourOfWeek: number; // 0-167 (day_of_week * 24 + hour)
  metric: string;
  mean: number;
  stddev: number;
  sampleCount: number;
}

export interface BaselineMap {
  // Key: `${probeId}:${metric}:${hourOfWeek}`
  [key: string]: BaselineBucket;
}

export function baselineKey(probeId: string, metric: string, hourOfWeek: number): string {
  return `${probeId}:${metric}:${hourOfWeek}`;
}

/**
 * Compute baselines for all probes from the last 4 weeks of 5min rollup data.
 * Returns a map keyed by probeId:metric:hourOfWeek.
 *
 * Uses ISODOW (1=Mon, 7=Sun) mapped to 0-6, times 24 + hour = 0..167
 */
export async function computeBaselines(): Promise<BaselineMap> {
  const query = `
    SELECT
      probe_id,
      ((EXTRACT(ISODOW FROM bucket)::int - 1) * 24 + EXTRACT(HOUR FROM bucket)::int) AS hour_of_week,
      AVG(latency_avg) AS mean_latency,
      STDDEV_POP(latency_avg) AS stddev_latency,
      AVG(jitter_avg) AS mean_jitter,
      STDDEV_POP(jitter_avg) AS stddev_jitter,
      AVG(packet_loss_avg) AS mean_packet_loss,
      STDDEV_POP(packet_loss_avg) AS stddev_packet_loss,
      AVG(dns_time_avg) AS mean_dns,
      STDDEV_POP(dns_time_avg) AS stddev_dns,
      AVG(bufferbloat_avg) AS mean_bufferbloat,
      STDDEV_POP(bufferbloat_avg) AS stddev_bufferbloat,
      COUNT(*) AS sample_count
    FROM measurements_5min
    WHERE bucket > NOW() - INTERVAL '4 weeks'
    GROUP BY probe_id, hour_of_week
  `;

  const result = await pool.query(query);
  const baselines: BaselineMap = {};

  const metrics = ['latency', 'jitter', 'packet_loss', 'dns', 'bufferbloat'] as const;

  for (const row of result.rows) {
    for (const metric of metrics) {
      const mean = parseFloat(row[`mean_${metric}`]) || 0;
      const stddev = parseFloat(row[`stddev_${metric}`]) || 0;
      const hourOfWeek = parseInt(row.hour_of_week, 10);

      const bucket: BaselineBucket = {
        probeId: row.probe_id,
        hourOfWeek,
        metric,
        mean,
        stddev,
        sampleCount: parseInt(row.sample_count, 10),
      };

      baselines[baselineKey(row.probe_id, metric, hourOfWeek)] = bucket;
    }
  }

  return baselines;
}
