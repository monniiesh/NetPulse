import { z } from 'zod';

export const scoreQuerySchema = z.object({
  probe_id: z.string().uuid(),
  profile: z.enum(['general', 'gaming', 'video_calls', 'streaming']).default('general'),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

export type ScoreQuery = z.infer<typeof scoreQuerySchema>;
