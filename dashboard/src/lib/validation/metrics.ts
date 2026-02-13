import { z } from 'zod';

export const metricsQuerySchema = z.object({
  probe_id: z.string().uuid(),
  from: z.string().datetime(),
  to: z.string().datetime(),
  resolution: z.enum(['raw', '5min', '1hr', '1day', 'auto']).default('auto'),
  target: z.string().optional(),
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;
