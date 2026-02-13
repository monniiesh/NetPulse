import { NextRequest, NextResponse } from 'next/server';
import { db, pool } from '@/lib/db';
import { measurements } from '@/lib/db/schema';
import { metricsQuerySchema } from '@/lib/validation/metrics';
import { and, eq, gte, lte, asc } from 'drizzle-orm';

const MS_PER_HOUR = 3600_000;
const MS_PER_DAY = 86400_000;

function resolveResolution(from: string, to: string): string {
  const rangeMs = new Date(to).getTime() - new Date(from).getTime();
  if (rangeMs <= 24 * MS_PER_HOUR) return 'raw';
  if (rangeMs <= 7 * MS_PER_DAY) return '5min';
  if (rangeMs <= 180 * MS_PER_DAY) return '1hr';
  return '1day';
}

const VIEW_MAP: Record<string, string> = {
  '5min': 'measurements_5min',
  '1hr': 'measurements_1hr',
  '1day': 'measurements_1day',
};

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = metricsQuerySchema.safeParse(params);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { probe_id, from, to, target } = parseResult.data;
    const resolution =
      parseResult.data.resolution === 'auto'
        ? resolveResolution(from, to)
        : parseResult.data.resolution;

    let data;

    if (resolution === 'raw') {
      const conditions = [
        eq(measurements.probeId, probe_id),
        gte(measurements.time, new Date(from)),
        lte(measurements.time, new Date(to)),
        ...(target ? [eq(measurements.target, target)] : []),
      ];

      data = await db
        .select()
        .from(measurements)
        .where(and(...conditions))
        .orderBy(asc(measurements.time));
    } else {
      const viewName = VIEW_MAP[resolution];
      const queryParams: (string | Date)[] = [probe_id, new Date(from), new Date(to)];
      let whereClause = 'WHERE probe_id = $1 AND bucket >= $2 AND bucket <= $3';

      if (target) {
        whereClause += ' AND target = $4';
        queryParams.push(target);
      }

      const result = await pool.query(
        `SELECT bucket AS time, probe_id, target, latency_avg, latency_p95,
                jitter_avg, jitter_max, packet_loss_avg, packet_loss_max,
                dns_time_avg, bufferbloat_avg, sample_count
         FROM ${viewName}
         ${whereClause}
         ORDER BY bucket ASC`,
        queryParams
      );

      data = result.rows;
    }

    return NextResponse.json({
      probe_id,
      resolution,
      from,
      to,
      data,
    });
  } catch (error) {
    console.error('Metrics query error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
