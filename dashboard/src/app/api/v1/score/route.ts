import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { computeQualityScore } from '@/lib/scoring/compute';
import { scoreQuerySchema } from '@/lib/validation/score';
import type { ScoreProfile } from '@/types';

export async function GET(request: NextRequest) {
  try {
    const searchParams = Object.fromEntries(request.nextUrl.searchParams);

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const params = {
      ...searchParams,
      from: searchParams.from || oneHourAgo.toISOString(),
      to: searchParams.to || now.toISOString(),
    };

    const validated = scoreQuerySchema.parse(params);

    const query = `
      SELECT
        AVG(latency_avg) as latency,
        AVG(jitter) as jitter,
        AVG(packet_loss) as packet_loss,
        AVG(dns_time) as dns,
        AVG(bufferbloat) as bufferbloat
      FROM measurements
      WHERE probe_id = $1 AND time >= $2 AND time <= $3
    `;

    const result = await pool.query(query, [
      validated.probe_id,
      validated.from,
      validated.to,
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'No measurements found for the specified probe and time range' },
        { status: 404 }
      );
    }

    const row = result.rows[0];
    const metrics = {
      latency: row.latency,
      jitter: row.jitter,
      packet_loss: row.packet_loss,
      dns: row.dns,
      bufferbloat: row.bufferbloat,
    };

    const score = computeQualityScore(metrics, validated.profile as ScoreProfile);

    return NextResponse.json(score);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error },
        { status: 400 }
      );
    }

    console.error('Score API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
