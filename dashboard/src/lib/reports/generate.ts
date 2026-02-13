import { db } from '@/lib/db';
import { reports } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import puppeteer from 'puppeteer';
import fs from 'fs/promises';
import path from 'path';

export async function generateReportPdf(reportId: string): Promise<void> {
  let browser;

  try {
    await db
      .update(reports)
      .set({ status: 'generating' })
      .where(eq(reports.id, reportId));

    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const printUrl = `${baseUrl}/reports/${reportId}/print`;

    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();

    await page.goto(printUrl, {
      waitUntil: 'networkidle0',
      timeout: 60000,
    });

    const reportsDir = path.join(process.cwd(), 'data', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    const pdfPath = path.join(reportsDir, `${reportId}.pdf`);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
    });

    await db
      .update(reports)
      .set({
        status: 'ready',
        pdfPath: `data/reports/${reportId}.pdf`,
      })
      .where(eq(reports.id, reportId));
  } catch (error) {
    console.error(`Report generation error for ${reportId}:`, error);

    await db
      .update(reports)
      .set({
        status: 'failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      })
      .where(eq(reports.id, reportId));
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
