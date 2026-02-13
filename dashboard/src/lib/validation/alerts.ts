import { z } from 'zod';

export const alertConfigSchema = z.object({
  probe_id: z.string().uuid().nullable().optional(),
  metric: z.enum(['latency', 'jitter', 'packet_loss', 'dns', 'bufferbloat']),
  threshold: z.number().positive(),
  comparison: z.enum(['gt', 'lt', 'gte', 'lte']),
  duration_min: z.number().int().min(1).max(60).default(5),
  channel: z.enum(['email', 'webhook', 'discord']),
  channel_config: z.record(z.string(), z.string()),
  is_active: z.boolean().default(true),
});

export const alertConfigUpdateSchema = alertConfigSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export type AlertConfigInput = z.infer<typeof alertConfigSchema>;
export type AlertConfigUpdate = z.infer<typeof alertConfigUpdateSchema>;
