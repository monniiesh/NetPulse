import { registerJob, startAllJobs } from './scheduler';
import { runBaselineCompute } from './baseline-compute';
import { runAnomalyDetection, runPatternDetection } from './anomaly-detect';
import { runAlertEvaluation } from './alert-evaluate';
import { runReportGeneration } from './report-generate';

let initialized = false;

/**
 * Initialize and start all background jobs.
 * Safe to call multiple times - only initializes once.
 *
 * Jobs:
 * - Baseline computation: every hour (also runs once at startup)
 * - Anomaly detection: every 5 minutes
 * - Pattern detection: every Sunday at midnight
 * - Alert evaluation: every minute
 * - Report generation: every minute (processes pending reports)
 */
export async function initializeJobs(): Promise<void> {
  if (initialized) return;
  initialized = true;

  console.log('[jobs] Initializing background jobs...');

  // Register all jobs
  registerJob('baseline-compute', '0 * * * *', runBaselineCompute);       // Every hour
  registerJob('anomaly-detect', '*/5 * * * *', runAnomalyDetection);      // Every 5 min
  registerJob('pattern-detect', '0 0 * * 0', runPatternDetection);        // Weekly (Sunday midnight)
  registerJob('alert-evaluate', '* * * * *', runAlertEvaluation);         // Every minute
  registerJob('report-generate', '* * * * *', runReportGeneration);       // Every minute

  // Start all cron schedules
  startAllJobs();

  // Run baseline computation immediately so anomaly detection has data
  try {
    await runBaselineCompute();
  } catch (err) {
    console.error('[jobs] Initial baseline computation failed:', err);
  }

  console.log('[jobs] All background jobs started');
}
