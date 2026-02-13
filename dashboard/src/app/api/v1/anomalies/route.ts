import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { anomalies } from '@/lib/db/schema';
import { anomalyQuerySchema } from '@/lib/validation/anomalies';
import { and, eq, gte, lte, desc, SQL } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const params = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = anomalyQuerySchema.safeParse(params);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { probe_id, from, to, metric, severity, limit } = parseResult.data;

    const conditions: SQL[] = [eq(anomalies.probeId, probe_id)];

    if (from) {
      conditions.push(gte(anomalies.startedAt, new Date(from)));
    }
    if (to) {
      conditions.push(lte(anomalies.startedAt, new Date(to)));
    }
    if (metric) {
      conditions.push(eq(anomalies.metric, metric));
    }
    if (severity) {
      conditions.push(eq(anomalies.severity, severity));
    }

    const results = await db
      .select()
      .from(anomalies)
      .where(and(...conditions))
      .orderBy(desc(anomalies.startedAt))
      .limit(limit);

    return NextResponse.json({
      anomalies: results.map((a) => ({
        id: a.id,
        probe_id: a.probeId,
        started_at: a.startedAt?.toISOString(),
        ended_at: a.endedAt?.toISOString() || null,
        metric: a.metric,
        expected_value: a.expectedValue,
        actual_value: a.actualValue,
        severity: a.severity,
        day_of_week: a.dayOfWeek,
        hour_of_day: a.hourOfDay,
        description: a.description,
      })),
    });
  } catch (error) {
    console.error('Anomalies query error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
