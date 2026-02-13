import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { createReportSchema, reportQuerySchema } from '@/lib/validation/reports';
import { eq, and, desc } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = createReportSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const [created] = await db
      .insert(reports)
      .values({
        userId: session.user.id,
        probeId: data.probe_id,
        periodStart: new Date(data.period_start),
        periodEnd: new Date(data.period_end),
        metadata: data.metadata || null,
        status: 'pending',
      })
      .returning({ id: reports.id });

    setTimeout(async () => {
      const { generateReportPdf } = await import('@/lib/reports/generate');
      await generateReportPdf(created.id);
    }, 0);

    return NextResponse.json({ id: created.id, status: 'pending' }, { status: 201 });
  } catch (error) {
    console.error('Report creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const probeId = request.nextUrl.searchParams.get('probe_id');
    const limit = Number(request.nextUrl.searchParams.get('limit') || 20);
    const offset = Number(request.nextUrl.searchParams.get('offset') || 0);

    const queryData = { probe_id: probeId || undefined, limit, offset };
    const parseResult = reportQuerySchema.safeParse(queryData);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const conditions = [eq(reports.userId, session.user.id)];
    if (parseResult.data.probe_id) {
      conditions.push(eq(reports.probeId, parseResult.data.probe_id));
    }

    const allReports = await db
      .select({
        id: reports.id,
        probe_id: reports.probeId,
        period_start: reports.periodStart,
        period_end: reports.periodEnd,
        status: reports.status,
        metadata: reports.metadata,
        created_at: reports.createdAt,
      })
      .from(reports)
      .where(and(...conditions))
      .orderBy(desc(reports.createdAt))
      .limit(parseResult.data.limit)
      .offset(parseResult.data.offset);

    return NextResponse.json({
      reports: allReports.map((r) => ({
        id: r.id,
        probe_id: r.probe_id,
        period_start: r.period_start?.toISOString(),
        period_end: r.period_end?.toISOString(),
        status: r.status,
        metadata: r.metadata,
        created_at: r.created_at?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Report list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
