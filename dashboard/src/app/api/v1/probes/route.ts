import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { probes } from '@/lib/db/schema';
import { registerProbeSchema } from '@/lib/validation/probes';
import bcryptjs from 'bcryptjs';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = registerProbeSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { name, location } = parseResult.data;

    const rawKey = 'np_probe_' + crypto.randomBytes(16).toString('hex');
    const hashedKey = await bcryptjs.hash(rawKey, 10);
    const prefix = rawKey.substring(0, 16);

    const [newProbe] = await db
      .insert(probes)
      .values({
        apiKey: hashedKey,
        apiKeyPrefix: prefix,
        name,
        location: location || null,
      })
      .returning({
        id: probes.id,
        name: probes.name,
        location: probes.location,
      });

    return NextResponse.json(
      {
        id: newProbe.id,
        api_key: rawKey,
        name: newProbe.name,
        location: newProbe.location,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Probe registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const allProbes = await db
      .select({
        id: probes.id,
        name: probes.name,
        location: probes.location,
        lastSeen: probes.lastSeen,
        isActive: probes.isActive,
        apiKeyPrefix: probes.apiKeyPrefix,
      })
      .from(probes);

    return NextResponse.json({ probes: allProbes }, { status: 200 });
  } catch (error) {
    console.error('Probe list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
