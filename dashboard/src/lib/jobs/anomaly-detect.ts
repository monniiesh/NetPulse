import { detectAnomalies, processAnomalies } from '@/lib/anomaly/detect';
import { detectRecurringPatterns } from '@/lib/anomaly/patterns';
import { getBaselines } from './baseline-compute';

export async function runAnomalyDetection(): Promise<void> {
  const baselines = getBaselines();

  if (Object.keys(baselines).length === 0) {
    console.log('[anomaly] No baselines available, skipping detection');
    return;
  }

  const candidates = await detectAnomalies(baselines, 10);
  const created = await processAnomalies(candidates);

  if (created > 0) {
    console.log(`[anomaly] Created ${created} new anomalies from ${candidates.length} candidates`);
  }
}

export async function runPatternDetection(): Promise<void> {
  const patterns = await detectRecurringPatterns();
  if (patterns.length > 0) {
    console.log(`[patterns] Found ${patterns.length} recurring patterns`);
    for (const p of patterns) {
      console.log(`[patterns]   ${p.description} (${p.occurrences} occurrences)`);
    }
  }
}
