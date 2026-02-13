import { pool } from '@/lib/db';
import { db } from '@/lib/db';
import { anomalies } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { BaselineMap, baselineKey } from './baseline';
import type { MetricName, Severity } from '@/types';

// Minimum concern thresholds - don't flag small absolute values even if they deviate
const MINIMUM_CONCERN: Record<MetricName, number> = {
  latency: 50,
  jitter: 10,
  packet_loss: 1,
  dns: 100,
  bufferbloat: 50,
};

// Map metric names to 5min view column names
const METRIC_COLUMNS: Record<MetricName, string> = {
  latency: 'latency_avg',
  jitter: 'jitter_avg',
  packet_loss: 'packet_loss_avg',
  dns: 'dns_time_avg',
  bufferbloat: 'bufferbloat_avg',
};

function classifySeverity(value: number, mean: number, stddev: number): Severity {
  const deviation = Math.abs(value - mean);
  if (deviation > 4 * stddev) return 'severe';
  if (deviation > 3 * stddev) return 'moderate';
  return 'mild';
}

interface AnomalyCandidate {
  probeId: string;
  metric: MetricName;
  bucketTime: Date;
  expectedValue: number;
  actualValue: number;
  severity: Severity;
  hourOfWeek: number;
}

/**
 * Detect anomalies in recent 5min windows.
 * Checks the last `windowMinutes` of 5min rollups against baselines.
 * Default: check the last 10 minutes (2 windows).
 */
export async function detectAnomalies(
  baselines: BaselineMap,
  windowMinutes: number = 10
): Promise<AnomalyCandidate[]> {
  // Query recent 5min rollups
  const query = `
    SELECT
      probe_id,
      bucket,
      ((EXTRACT(ISODOW FROM bucket)::int - 1) * 24 + EXTRACT(HOUR FROM bucket)::int) AS hour_of_week,
      latency_avg,
      jitter_avg,
      packet_loss_avg,
      dns_time_avg,
      bufferbloat_avg
    FROM measurements_5min
    WHERE bucket > NOW() - INTERVAL '${windowMinutes} minutes'
    ORDER BY bucket ASC
  `;

  const result = await pool.query(query);
  const candidates: AnomalyCandidate[] = [];
  const metrics: MetricName[] = ['latency', 'jitter', 'packet_loss', 'dns', 'bufferbloat'];

  for (const row of result.rows) {
    const probeId = row.probe_id;
    const hourOfWeek = parseInt(row.hour_of_week, 10);
    const bucketTime = new Date(row.bucket);

    for (const metric of metrics) {
      const column = METRIC_COLUMNS[metric];
      const value = parseFloat(row[column]);

      if (value === null || isNaN(value)) continue;

      const key = baselineKey(probeId, metric, hourOfWeek);
      const baseline = baselines[key];

      if (!baseline || baseline.sampleCount < 4) continue; // Not enough data for baseline

      const { mean, stddev } = baseline;

      // Skip if stddev is zero (constant value) or too few samples
      if (stddev === 0) continue;

      // Check if current value exceeds 2*stddev AND minimum concern threshold
      const isAnomaly =
        Math.abs(value - mean) > 2 * stddev &&
        value > MINIMUM_CONCERN[metric];

      if (isAnomaly) {
        candidates.push({
          probeId,
          metric,
          bucketTime,
          expectedValue: mean,
          actualValue: value,
          severity: classifySeverity(value, mean, stddev),
          hourOfWeek,
        });
      }
    }
  }

  return candidates;
}

/**
 * Process anomaly candidates: group adjacent windows, create/update anomaly records.
 * - If an open anomaly exists for (probe, metric), extend it
 * - If no open anomaly, create a new one
 * - Close open anomalies that weren't seen in this detection run
 */
export async function processAnomalies(candidates: AnomalyCandidate[]): Promise<number> {
  let created = 0;

  // Group candidates by probe+metric
  const grouped = new Map<string, AnomalyCandidate[]>();
  for (const c of candidates) {
    const key = `${c.probeId}:${c.metric}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(c);
  }

  // For each group, check if there's an open anomaly to extend
  for (const [key, items] of grouped) {
    const [probeId, metric] = key.split(':');
    const latest = items[items.length - 1];

    // Find open anomaly (no ended_at) for this probe+metric
    const openAnomaly = await db
      .select()
      .from(anomalies)
      .where(
        and(
          eq(anomalies.probeId, probeId),
          eq(anomalies.metric, metric),
          isNull(anomalies.endedAt)
        )
      )
      .limit(1);

    if (openAnomaly.length > 0) {
      // Extend the existing anomaly - update actual_value to latest worst value
      const worst = items.reduce((a, b) => a.actualValue > b.actualValue ? a : b);
      await db
        .update(anomalies)
        .set({
          actualValue: worst.actualValue,
          severity: worst.severity,
        })
        .where(eq(anomalies.id, openAnomaly[0].id));
    } else {
      // Create new anomaly
      const dayOfWeek = Math.floor(latest.hourOfWeek / 24);
      const hourOfDay = latest.hourOfWeek % 24;
      const deviationRatio = (latest.actualValue / latest.expectedValue).toFixed(1);
      const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const description = `${metric} ${deviationRatio}x higher than normal for ${dayNames[dayOfWeek]} ${hourOfDay}:00`;

      await db.insert(anomalies).values({
        probeId,
        startedAt: items[0].bucketTime,
        metric,
        expectedValue: latest.expectedValue,
        actualValue: latest.actualValue,
        severity: latest.severity,
        dayOfWeek,
        hourOfDay,
        description,
      });
      created++;
    }
  }

  // Close open anomalies that have no candidates in this run
  // (the anomalous condition has ended)
  const activeProbeMetrics = new Set(grouped.keys());

  const openAnomalies = await db
    .select()
    .from(anomalies)
    .where(isNull(anomalies.endedAt));

  for (const open of openAnomalies) {
    const key = `${open.probeId}:${open.metric}`;
    if (!activeProbeMetrics.has(key)) {
      await db
        .update(anomalies)
        .set({ endedAt: new Date() })
        .where(eq(anomalies.id, open.id));
    }
  }

  return created;
}
