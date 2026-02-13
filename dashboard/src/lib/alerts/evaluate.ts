import { pool } from '@/lib/db';
import { db } from '@/lib/db';
import { alertConfigs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { eventBus } from '@/lib/events/emitter';
import { sendAlert } from './send';
import type { AlertConfig } from '@/lib/db/schema';

// Metric columns in the raw measurements table
const METRIC_COLUMN_MAP: Record<string, string> = {
  latency: 'latency_avg',
  jitter: 'jitter',
  packet_loss: 'packet_loss',
  dns: 'dns_time',
  bufferbloat: 'bufferbloat',
};

// Aggregation function per metric
const METRIC_AGG: Record<string, string> = {
  latency: 'AVG',
  jitter: 'AVG',
  packet_loss: 'MAX',
  dns: 'AVG',
  bufferbloat: 'AVG',
};

// In-memory cooldown tracker: alertConfigId -> last fired timestamp
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

function isInCooldown(alertId: string): boolean {
  const lastFired = cooldowns.get(alertId);
  if (!lastFired) return false;
  return Date.now() - lastFired < COOLDOWN_MS;
}

function compareValues(actual: number, threshold: number, comparison: string): boolean {
  switch (comparison) {
    case 'gt': return actual > threshold;
    case 'lt': return actual < threshold;
    case 'gte': return actual >= threshold;
    case 'lte': return actual <= threshold;
    default: return false;
  }
}

/**
 * Evaluate all active alert configs against recent measurements.
 * Called every minute by the background job scheduler.
 */
export async function evaluateAlerts(): Promise<number> {
  // Get all active alert configs
  const configs = await db
    .select()
    .from(alertConfigs)
    .where(eq(alertConfigs.isActive, true));

  let fired = 0;

  for (const config of configs) {
    try {
      if (isInCooldown(config.id)) continue;

      const column = METRIC_COLUMN_MAP[config.metric];
      const agg = METRIC_AGG[config.metric];
      if (!column || !agg) continue;

      // Build query - check last N minutes of measurements
      const probeFilter = config.probeId
        ? 'AND probe_id = $2'
        : '';
      const params: (string | number)[] = [config.durationMin];
      if (config.probeId) params.push(config.probeId);

      const query = `
        SELECT ${agg}(${column}) AS metric_value, COUNT(*) AS sample_count
        FROM measurements
        WHERE time > NOW() - INTERVAL '1 minute' * $1
        ${probeFilter}
        AND ${column} IS NOT NULL
      `;

      const result = await pool.query(query, params);

      if (result.rows.length === 0 || result.rows[0].sample_count === 0) continue;

      const metricValue = parseFloat(result.rows[0].metric_value);
      if (isNaN(metricValue)) continue;

      const exceeded = compareValues(metricValue, config.threshold, config.comparison);

      if (exceeded) {
        cooldowns.set(config.id, Date.now());

        const message = `${config.metric} ${config.comparison} ${config.threshold} for ${config.durationMin} minutes (current: ${metricValue.toFixed(2)})`;

        // Send alert via configured channel
        await sendAlert(config, metricValue, message);

        // Emit SSE event
        if (config.probeId) {
          eventBus.emit(config.probeId, {
            type: 'alert',
            data: {
              alert_id: config.id,
              probe_id: config.probeId,
              metric: config.metric,
              threshold: config.threshold,
              current_value: metricValue,
              message,
              fired_at: new Date().toISOString(),
            },
          });
        }

        fired++;
      }
    } catch (err) {
      console.error(`Alert evaluation failed for config ${config.id}:`, err);
    }
  }

  return fired;
}
