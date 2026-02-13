import type { AlertConfig } from '@/lib/db/schema';
import { sendWebhook } from './channels/webhook';
import { sendDiscord } from './channels/discord';
import { sendEmail } from './channels/email';

export async function sendAlert(
  config: AlertConfig,
  currentValue: number,
  message: string
): Promise<void> {
  const payload = {
    alert_id: config.id,
    probe_id: config.probeId,
    metric: config.metric,
    threshold: config.threshold,
    current_value: currentValue,
    comparison: config.comparison,
    duration_min: config.durationMin,
    message,
    fired_at: new Date().toISOString(),
  };

  switch (config.channel) {
    case 'webhook':
      await sendWebhook(config.channelConfig as Record<string, string>, payload);
      break;
    case 'discord':
      await sendDiscord(config.channelConfig as Record<string, string>, payload);
      break;
    case 'email':
      await sendEmail(config.channelConfig as Record<string, string>, payload);
      break;
    default:
      console.warn(`Unknown alert channel: ${config.channel}`);
  }
}
