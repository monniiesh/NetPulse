import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { probes, measurements } from '@/lib/db/schema';
import { ingestPayloadSchema } from '@/lib/validation/ingest';
import { eq } from 'drizzle-orm';
import { authenticateProbe } from '@/lib/auth/api-key';
import { eventBus } from '@/lib/events/emitter';
import { checkRateLimit } from '@/lib/rate-limit';

async function parseBody(request: NextRequest) {
  const encoding = request.headers.get('Content-Encoding');
  if (encoding === 'gzip') {
    const compressed = await request.arrayBuffer();
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(compressed));
    writer.close();
    const reader = ds.readable.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    const text = new TextDecoder().decode(
      Buffer.concat(chunks)
    );
    return JSON.parse(text);
  }
  return request.json();
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key required' },
        { status: 401 }
      );
    }

    const probe = await authenticateProbe(apiKey);

    if (!probe) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 }
      );
    }

    const rateCheck = checkRateLimit(apiKey.substring(0, 16));
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
      );
    }

    const body = await parseBody(request);
    const parseResult = ingestPayloadSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const payload = parseResult.data;

    if (payload.probe_id !== probe.id) {
      return NextResponse.json(
        { error: 'Probe ID mismatch' },
        { status: 403 }
      );
    }

    const rows = payload.measurements.map((m) => ({
      time: new Date(m.timestamp),
      probeId: probe.id,
      target: m.target,
      latencyAvg: m.latency_avg,
      latencyP95: m.latency_p95,
      jitter: m.jitter,
      packetLoss: m.packet_loss,
      dnsTime: m.dns_time,
      bufferbloat: m.bufferbloat,
    }));

    await db.insert(measurements).values(rows).onConflictDoNothing();

    // Emit events to SSE clients
    for (const m of payload.measurements) {
      eventBus.emit(probe.id, {
        type: 'measurement',
        data: m,
      });
    }

    await db
      .update(probes)
      .set({ lastSeen: new Date() })
      .where(eq(probes.id, probe.id));

    return NextResponse.json(
      { accepted: rows.length, rejected: 0 },
      { status: 200 }
    );
  } catch (error) {
    console.error('Ingest error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
