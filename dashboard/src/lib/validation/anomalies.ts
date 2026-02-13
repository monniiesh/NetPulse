import { z } from 'zod';

export const anomalyQuerySchema = z.object({
  probe_id: z.string().uuid(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  metric: z.enum(['latency', 'jitter', 'packet_loss', 'dns', 'bufferbloat']).optional(),
  severity: z.enum(['mild', 'moderate', 'severe']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export type AnomalyQuery = z.infer<typeof anomalyQuerySchema>;
