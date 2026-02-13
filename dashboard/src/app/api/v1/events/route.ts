import { NextRequest } from 'next/server';
import { eventBus } from '@/lib/events/emitter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const probeIds = request.nextUrl.searchParams.get('probe_ids');

  if (!probeIds) {
    return new Response(JSON.stringify({ error: 'probe_ids required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ids = probeIds.split(',').filter(Boolean);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ probe_ids: ids })}\n\n`)
      );

      // Subscribe to events for each probe
      const unsubscribes = ids.map((probeId) =>
        eventBus.subscribe(probeId, (event) => {
          const data = JSON.stringify({ probe_id: probeId, ...event.data as object });
          controller.enqueue(
            encoder.encode(`event: ${event.type}\ndata: ${data}\n\n`)
          );
        })
      );

      // Keep-alive ping every 30s
      const keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          clearInterval(keepAlive);
        }
      }, 30000);

      // Clean up on close
      request.signal.addEventListener('abort', () => {
        unsubscribes.forEach((unsub) => unsub());
        clearInterval(keepAlive);
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
