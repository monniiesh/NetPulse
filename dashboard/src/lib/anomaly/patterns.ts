import { pool } from '@/lib/db';

export interface RecurringPattern {
  probeId: string;
  metric: string;
  dayOfWeek: number;
  hourOfDay: number;
  occurrences: number;
  avgExpected: number;
  avgActual: number;
  description: string;
}

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/**
 * Detect recurring anomaly patterns.
 * Scans completed anomalies from last 4 weeks.
 * Flags (probe, metric, day_of_week, hour) combos with 3+ occurrences.
 */
export async function detectRecurringPatterns(): Promise<RecurringPattern[]> {
  const query = `
    SELECT
      probe_id,
      metric,
      day_of_week,
      hour_of_day,
      COUNT(*) AS occurrences,
      AVG(expected_value) AS avg_expected,
      AVG(actual_value) AS avg_actual
    FROM anomalies
    WHERE
      created_at > NOW() - INTERVAL '4 weeks'
      AND ended_at IS NOT NULL
      AND day_of_week IS NOT NULL
      AND hour_of_day IS NOT NULL
    GROUP BY probe_id, metric, day_of_week, hour_of_day
    HAVING COUNT(*) >= 3
    ORDER BY occurrences DESC
  `;

  const result = await pool.query(query);
  const patterns: RecurringPattern[] = [];

  for (const row of result.rows) {
    const dayOfWeek = parseInt(row.day_of_week, 10);
    const hourOfDay = parseInt(row.hour_of_day, 10);
    const hourStr = `${hourOfDay}:00`;
    const endHourStr = `${(hourOfDay + 1) % 24}:00`;

    patterns.push({
      probeId: row.probe_id,
      metric: row.metric,
      dayOfWeek,
      hourOfDay,
      occurrences: parseInt(row.occurrences, 10),
      avgExpected: parseFloat(row.avg_expected),
      avgActual: parseFloat(row.avg_actual),
      description: `${row.metric} degrades every ${DAY_NAMES[dayOfWeek]} ${hourStr}-${endHourStr}`,
    });
  }

  // Merge adjacent hours into ranges for cleaner descriptions
  return mergeAdjacentPatterns(patterns);
}

/**
 * Merge adjacent hour patterns for the same (probe, metric, day) into ranges.
 * e.g., "latency degrades every Tuesday 21:00-22:00" + "...22:00-23:00"
 *   => "latency degrades every Tuesday 21:00-23:00"
 */
function mergeAdjacentPatterns(patterns: RecurringPattern[]): RecurringPattern[] {
  // Group by probe+metric+day
  const groups = new Map<string, RecurringPattern[]>();
  for (const p of patterns) {
    const key = `${p.probeId}:${p.metric}:${p.dayOfWeek}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const merged: RecurringPattern[] = [];

  for (const [, group] of groups) {
    // Sort by hour
    group.sort((a, b) => a.hourOfDay - b.hourOfDay);

    let start = group[0];
    let end = group[0];

    for (let i = 1; i < group.length; i++) {
      if (group[i].hourOfDay === end.hourOfDay + 1) {
        // Adjacent - extend
        end = group[i];
      } else {
        // Gap - emit merged pattern
        merged.push(createMergedPattern(start, end));
        start = group[i];
        end = group[i];
      }
    }

    // Emit last group
    merged.push(createMergedPattern(start, end));
  }

  return merged;
}

function createMergedPattern(start: RecurringPattern, end: RecurringPattern): RecurringPattern {
  const startHour = `${start.hourOfDay}:00`;
  const endHour = `${(end.hourOfDay + 1) % 24}:00`;
  const dayName = DAY_NAMES[start.dayOfWeek];

  return {
    ...start,
    occurrences: Math.max(start.occurrences, end.occurrences),
    avgExpected: (start.avgExpected + end.avgExpected) / 2,
    avgActual: (start.avgActual + end.avgActual) / 2,
    description: start.hourOfDay === end.hourOfDay
      ? `${start.metric} degrades every ${dayName} ${startHour}-${endHour}`
      : `${start.metric} degrades every ${dayName} ${startHour}-${endHour}`,
  };
}
