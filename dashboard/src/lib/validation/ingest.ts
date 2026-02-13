import { z } from 'zod';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_FUTURE_MS = 5 * 60 * 1000; // 5 minutes

export const rawMeasurementSchema = z.object({
  timestamp: z.string().datetime().refine((ts) => {
    const t = new Date(ts).getTime();
    const now = Date.now();
    return t >= now - MAX_AGE_MS && t <= now + MAX_FUTURE_MS;
  }, { message: 'Timestamp must be within last 7 days and not more than 5 minutes in the future' }),
  target: z.string().min(1).max(255),
  latency_avg: z.number().nonnegative().nullable(),
  latency_p95: z.number().nonnegative().nullable(),
  jitter: z.number().nonnegative().nullable(),
  packet_loss: z.number().min(0).max(100).nullable(),
  dns_time: z.number().nonnegative().nullable(),
  bufferbloat: z.number().nullable(),
});

export const ingestPayloadSchema = z.object({
  probe_id: z.string().uuid(),
  measurements: z.array(rawMeasurementSchema).min(1).max(1000),
});

export type IngestPayload = z.infer<typeof ingestPayloadSchema>;
