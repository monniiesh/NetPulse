import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { alertConfigs } from '@/lib/db/schema';
import { alertConfigSchema, alertConfigUpdateSchema } from '@/lib/validation/alerts';
import { eq, and } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const probeId = request.nextUrl.searchParams.get('probe_id');

    const conditions = [eq(alertConfigs.userId, session.user.id)];
    if (probeId) {
      conditions.push(eq(alertConfigs.probeId, probeId));
    }

    const configs = await db
      .select()
      .from(alertConfigs)
      .where(and(...conditions));

    return NextResponse.json({
      alerts: configs.map((c) => ({
        id: c.id,
        probe_id: c.probeId,
        metric: c.metric,
        threshold: c.threshold,
        comparison: c.comparison,
        duration_min: c.durationMin,
        channel: c.channel,
        channel_config: c.channelConfig,
        is_active: c.isActive,
        created_at: c.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Alert configs list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = alertConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const [created] = await db
      .insert(alertConfigs)
      .values({
        userId: session.user.id,
        probeId: data.probe_id || null,
        metric: data.metric,
        threshold: data.threshold,
        comparison: data.comparison,
        durationMin: data.duration_min,
        channel: data.channel,
        channelConfig: data.channel_config,
        isActive: data.is_active,
      })
      .returning({ id: alertConfigs.id });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error('Alert config create error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Alert config ID required' }, { status: 400 });
    }

    const parseResult = alertConfigUpdateSchema.safeParse(updates);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    const updateFields: Record<string, unknown> = {};
    if (data.probe_id !== undefined) updateFields.probeId = data.probe_id;
    if (data.metric !== undefined) updateFields.metric = data.metric;
    if (data.threshold !== undefined) updateFields.threshold = data.threshold;
    if (data.comparison !== undefined) updateFields.comparison = data.comparison;
    if (data.duration_min !== undefined) updateFields.durationMin = data.duration_min;
    if (data.channel !== undefined) updateFields.channel = data.channel;
    if (data.channel_config !== undefined) updateFields.channelConfig = data.channel_config;
    if (data.is_active !== undefined) updateFields.isActive = data.is_active;

    if (Object.keys(updateFields).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    await db
      .update(alertConfigs)
      .set(updateFields)
      .where(
        and(
          eq(alertConfigs.id, id),
          eq(alertConfigs.userId, session.user.id)
        )
      );

    return NextResponse.json({ id, updated: true });
  } catch (error) {
    console.error('Alert config update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Alert config ID required' }, { status: 400 });
    }

    await db
      .delete(alertConfigs)
      .where(
        and(
          eq(alertConfigs.id, id),
          eq(alertConfigs.userId, session.user.id)
        )
      );

    return NextResponse.json({ id, deleted: true });
  } catch (error) {
    console.error('Alert config delete error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
