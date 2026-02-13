import { computeBaselines, type BaselineMap } from '@/lib/anomaly/baseline';

// In-memory baseline cache (shared with anomaly detection job)
let currentBaselines: BaselineMap = {};

export function getBaselines(): BaselineMap {
  return currentBaselines;
}

export async function runBaselineCompute(): Promise<void> {
  console.log('[baseline] Computing baselines from last 4 weeks...');
  const baselines = await computeBaselines();
  const bucketCount = Object.keys(baselines).length;
  currentBaselines = baselines;
  console.log(`[baseline] Computed ${bucketCount} baseline buckets`);
}
