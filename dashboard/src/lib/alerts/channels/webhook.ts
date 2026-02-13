interface AlertPayload {
  alert_id: string;
  probe_id: string | null;
  metric: string;
  threshold: number;
  current_value: number;
  comparison: string;
  duration_min: number;
  message: string;
  fired_at: string;
}

export async function sendWebhook(
  channelConfig: Record<string, string>,
  payload: AlertPayload
): Promise<void> {
  const url = channelConfig.url;
  if (!url) {
    console.error('Webhook alert: missing URL in channel config');
    return;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(`Webhook alert failed: ${response.status} ${response.statusText}`);
  }
}
