import { NextResponse } from 'next/server';
import { pool, db } from '@/lib/db';
import { probes, measurements, alertConfigs, anomalies, users } from '@/lib/db/schema';
import { computeBaselines } from '@/lib/anomaly/baseline';
import { detectAnomalies, processAnomalies } from '@/lib/anomaly/detect';
import { detectRecurringPatterns } from '@/lib/anomaly/patterns';
import { evaluateAlerts } from '@/lib/alerts/evaluate';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

const TEST_PROBE_NAME = 'synthetic-test-probe';
const TEST_TARGET = '1.1.1.1';

// Normal baseline values
const NORMAL = {
  latency_avg: 22,
  latency_p95: 35,
  jitter: 3,
  packet_loss: 0.1,
  dns_time: 28,
  bufferbloat: 8,
};

// Degraded values (should trigger anomalies)
const DEGRADED = {
  latency_avg: 350,
  latency_p95: 500,
  jitter: 55,
  packet_loss: 6,
  dns_time: 520,
  bufferbloat: 220,
};

/**
 * POST /api/v1/test/synthetic
 *
 * Injects synthetic measurement data to test the anomaly detection and alert
 * pipeline end-to-end. Development only.
 *
 * Steps:
 * 1. Create test probe + user
 * 2. Insert 4 weeks of normal baseline data (5-min intervals)
 * 3. Insert recent degraded data (last 15 minutes)
 * 4. Refresh TimescaleDB continuous aggregates
 * 5. Compute baselines
 * 6. Run anomaly detection
 * 7. Run pattern detection
 * 8. Create alert config + evaluate
 * 9. Report results
 */
export async function POST() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  const results: Record<string, unknown> = {};
  const startTime = Date.now();

  try {
    // Step 1: Create test probe + user
    const [probe] = await db
      .insert(probes)
      .values({
        name: TEST_PROBE_NAME,
        apiKey: await bcrypt.hash('test-synthetic-key', 10),
        apiKeyPrefix: 'test-sy',
        location: 'Synthetic Test',
        isActive: true,
      })
      .onConflictDoNothing()
      .returning();

    let probeId: string;

    if (probe) {
      probeId = probe.id;
      results.probe = { created: true, id: probeId };
    } else {
      // Probe already exists, find it
      const existing = await db
        .select()
        .from(probes)
        .where(eq(probes.name, TEST_PROBE_NAME))
        .limit(1);

      if (existing.length === 0) {
        return NextResponse.json({ error: 'Failed to create or find test probe' }, { status: 500 });
      }

      probeId = existing[0].id;
      results.probe = { created: false, id: probeId, reused: true };
    }

    // Create test user for alert config
    const hashedPassword = await bcrypt.hash('test-password', 10);
    const [user] = await db
      .insert(users)
      .values({
        email: 'synthetic-test@netpulse.local',
        password: hashedPassword,
      })
      .onConflictDoNothing()
      .returning();

    let userId: string;
    if (user) {
      userId = user.id;
    } else {
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, 'synthetic-test@netpulse.local'))
        .limit(1);
      userId = existingUser[0].id;
    }

    // Step 2: Clean old test data for this probe
    await db.delete(anomalies).where(eq(anomalies.probeId, probeId));
    await db.delete(alertConfigs).where(eq(alertConfigs.userId, userId));
    await pool.query(`DELETE FROM measurements WHERE probe_id = $1`, [probeId]);

    // Step 3: Insert 4 weeks of normal baseline data at 5-min intervals
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);

    // Use batch inserts for performance (chunks of 500)
    const BATCH_SIZE = 500;
    let normalValues: string[] = [];
    let normalParams: (string | number | null)[] = [];
    let paramIndex = 1;
    let totalInserted = 0;

    // Generate data from 4 weeks ago until 20 minutes ago (leave gap for degraded data)
    const endNormal = new Date(now.getTime() - 20 * 60 * 1000);
    let cursor = new Date(fourWeeksAgo);

    while (cursor < endNormal) {
      // Add slight randomness to normal values
      const jitterFactor = () => 0.85 + Math.random() * 0.3; // 0.85 - 1.15

      normalValues.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
      );

      normalParams.push(
        cursor.toISOString(),
        probeId,
        TEST_TARGET,
        +(NORMAL.latency_avg * jitterFactor()).toFixed(2),
        +(NORMAL.latency_p95 * jitterFactor()).toFixed(2),
        +(NORMAL.jitter * jitterFactor()).toFixed(2),
        +(NORMAL.packet_loss * jitterFactor()).toFixed(3),
        +(NORMAL.dns_time * jitterFactor()).toFixed(2),
        +(NORMAL.bufferbloat * jitterFactor()).toFixed(2),
      );

      paramIndex += 9;

      if (normalValues.length >= BATCH_SIZE) {
        await pool.query(
          `INSERT INTO measurements (time, probe_id, target, latency_avg, latency_p95, jitter, packet_loss, dns_time, bufferbloat)
           VALUES ${normalValues.join(', ')}
           ON CONFLICT DO NOTHING`,
          normalParams
        );
        totalInserted += normalValues.length;
        normalValues = [];
        normalParams = [];
        paramIndex = 1;
      }

      cursor = new Date(cursor.getTime() + 5 * 60 * 1000); // 5-minute intervals
    }

    // Flush remaining
    if (normalValues.length > 0) {
      await pool.query(
        `INSERT INTO measurements (time, probe_id, target, latency_avg, latency_p95, jitter, packet_loss, dns_time, bufferbloat)
         VALUES ${normalValues.join(', ')}
         ON CONFLICT DO NOTHING`,
        normalParams
      );
      totalInserted += normalValues.length;
    }

    results.normalData = { inserted: totalInserted, from: fourWeeksAgo.toISOString(), to: endNormal.toISOString() };

    // Step 4: Insert degraded data for the last 15 minutes
    let degradedCount = 0;
    const degradedStart = new Date(now.getTime() - 15 * 60 * 1000);
    cursor = new Date(degradedStart);
    const degradedValues: string[] = [];
    const degradedParams: (string | number | null)[] = [];
    paramIndex = 1;

    while (cursor <= now) {
      degradedValues.push(
        `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7}, $${paramIndex + 8})`
      );
      degradedParams.push(
        cursor.toISOString(),
        probeId,
        TEST_TARGET,
        +(DEGRADED.latency_avg * (0.9 + Math.random() * 0.2)).toFixed(2),
        +(DEGRADED.latency_p95 * (0.9 + Math.random() * 0.2)).toFixed(2),
        +(DEGRADED.jitter * (0.9 + Math.random() * 0.2)).toFixed(2),
        +(DEGRADED.packet_loss * (0.9 + Math.random() * 0.2)).toFixed(3),
        +(DEGRADED.dns_time * (0.9 + Math.random() * 0.2)).toFixed(2),
        +(DEGRADED.bufferbloat * (0.9 + Math.random() * 0.2)).toFixed(2),
      );
      paramIndex += 9;
      degradedCount++;
      cursor = new Date(cursor.getTime() + 30 * 1000); // 30-second intervals
    }

    if (degradedValues.length > 0) {
      await pool.query(
        `INSERT INTO measurements (time, probe_id, target, latency_avg, latency_p95, jitter, packet_loss, dns_time, bufferbloat)
         VALUES ${degradedValues.join(', ')}
         ON CONFLICT DO NOTHING`,
        degradedParams
      );
    }

    results.degradedData = { inserted: degradedCount, from: degradedStart.toISOString(), to: now.toISOString() };

    // Step 5: Refresh continuous aggregates
    await pool.query(`CALL refresh_continuous_aggregate('measurements_5min', NULL, NULL)`);
    await pool.query(`CALL refresh_continuous_aggregate('measurements_1hr', NULL, NULL)`);
    results.aggregatesRefreshed = true;

    // Step 6: Compute baselines
    const baselines = await computeBaselines();
    const baselineCount = Object.keys(baselines).length;
    results.baselines = { buckets: baselineCount };

    // Step 7: Run anomaly detection
    const candidates = await detectAnomalies(baselines, 15);
    const created = await processAnomalies(candidates);
    results.anomalyDetection = {
      candidates: candidates.length,
      created,
      details: candidates.map((c) => ({
        metric: c.metric,
        expected: +c.expectedValue.toFixed(2),
        actual: +c.actualValue.toFixed(2),
        severity: c.severity,
      })),
    };

    // Step 8: Run pattern detection (may not find patterns with just 1 run, but tests the code path)
    const patterns = await detectRecurringPatterns();
    results.patternDetection = {
      patterns: patterns.length,
      details: patterns.map((p) => ({
        metric: p.metric,
        description: p.description,
        occurrences: p.occurrences,
      })),
    };

    // Step 9: Create alert config and evaluate
    const [alertConfig] = await db
      .insert(alertConfigs)
      .values({
        userId,
        probeId,
        metric: 'latency',
        threshold: 100,
        comparison: 'gt',
        durationMin: 1,
        channel: 'webhook',
        channelConfig: { url: 'http://localhost:9999/test-webhook' },
        isActive: true,
      })
      .returning();

    results.alertConfig = { id: alertConfig.id, metric: 'latency', threshold: 100, comparison: 'gt' };

    // Evaluate alerts
    const alertsFired = await evaluateAlerts();
    results.alertEvaluation = { fired: alertsFired };

    // Step 10: Verify anomalies were persisted
    const persistedAnomalies = await db
      .select()
      .from(anomalies)
      .where(eq(anomalies.probeId, probeId));

    results.persistedAnomalies = {
      count: persistedAnomalies.length,
      details: persistedAnomalies.map((a) => ({
        metric: a.metric,
        severity: a.severity,
        description: a.description,
        expected: a.expectedValue,
        actual: a.actualValue,
        ongoing: a.endedAt === null,
      })),
    };

    // Summary
    const success =
      candidates.length > 0 &&
      created > 0 &&
      persistedAnomalies.length > 0 &&
      alertsFired > 0;

    results.summary = {
      success,
      duration_ms: Date.now() - startTime,
      checks: {
        anomalies_detected: candidates.length > 0,
        anomalies_persisted: persistedAnomalies.length > 0,
        alerts_fired: alertsFired > 0,
        baseline_computed: baselineCount > 0,
      },
    };

    return NextResponse.json(results, { status: success ? 200 : 500 });
  } catch (error) {
    console.error('Synthetic test error:', error);
    return NextResponse.json(
      {
        error: 'Synthetic test failed',
        message: error instanceof Error ? error.message : String(error),
        results,
        duration_ms: Date.now() - startTime,
      },
      { status: 500 }
    );
  }
}
