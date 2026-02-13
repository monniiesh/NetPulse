import { z } from 'zod';

export const createReportSchema = z.object({
  probe_id: z.string().uuid(),
  period_start: z.string().datetime(),
  period_end: z.string().datetime(),
  metadata: z.object({
    isp_name: z.string().optional(),
    advertised_download: z.number().optional(),
    advertised_upload: z.number().optional(),
    sla_uptime: z.number().optional(),
  }).optional(),
}).refine((data) => new Date(data.period_end) > new Date(data.period_start), {
  message: 'period_end must be after period_start',
  path: ['period_end'],
});

export const reportQuerySchema = z.object({
  probe_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(50).default(20),
  offset: z.number().int().min(0).default(0),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
