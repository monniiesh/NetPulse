import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/config';
import { db } from '@/lib/db';
import { probes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (body.rotate_key) {
      const rawKey = 'np_probe_' + crypto.randomBytes(16).toString('hex');
      const hashedKey = await bcryptjs.hash(rawKey, 10);
      const prefix = rawKey.substring(0, 16);

      await db
        .update(probes)
        .set({ apiKey: hashedKey, apiKeyPrefix: prefix })
        .where(eq(probes.id, id));

      return NextResponse.json({ api_key: rawKey, message: 'API key rotated' });
    }

    // Update name/location
    const updates: Record<string, string> = {};
    if (body.name) updates.name = body.name;
    if (body.location !== undefined) updates.location = body.location;

    if (Object.keys(updates).length > 0) {
      await db.update(probes).set(updates).where(eq(probes.id, id));
    }

    return NextResponse.json({ message: 'Probe updated' });
  } catch (error) {
    console.error('Probe update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await db
      .update(probes)
      .set({ isActive: false })
      .where(eq(probes.id, id));

    return NextResponse.json({ message: 'Probe deactivated' });
  } catch (error) {
    console.error('Probe delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
