import { evaluateAlerts } from '@/lib/alerts/evaluate';

export async function runAlertEvaluation(): Promise<void> {
  const fired = await evaluateAlerts();
  if (fired > 0) {
    console.log(`[alerts] Fired ${fired} alerts`);
  }
}
