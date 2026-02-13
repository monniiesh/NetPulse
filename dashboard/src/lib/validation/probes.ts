import { z } from 'zod';

export const registerProbeSchema = z.object({
  name: z.string().min(1).max(100),
  location: z.string().max(200).optional(),
});

export type RegisterProbeInput = z.infer<typeof registerProbeSchema>;
