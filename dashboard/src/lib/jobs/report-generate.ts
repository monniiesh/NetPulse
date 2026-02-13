import { db } from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

/**
 * Process pending report generation requests.
 * Checks for reports with status='pending' and generates PDFs.
 * Runs every minute.
 */
export async function runReportGeneration(): Promise<void> {
  const pending = await db
    .select()
    .from(reports)
    .where(eq(reports.status, 'pending'))
    .limit(1);

  if (pending.length === 0) return;

  const report = pending[0];

  try {
    const { generateReportPdf } = await import('@/lib/reports/generate');
    await generateReportPdf(report.id);
    console.log(`[jobs] Report ${report.id} generated successfully`);
  } catch (err) {
    console.error(`[jobs] Report generation failed for ${report.id}:`, err);
    await db
      .update(reports)
      .set({
        status: 'failed',
        metadata: { error: err instanceof Error ? err.message : String(err) },
      })
      .where(eq(reports.id, report.id));
  }
}
