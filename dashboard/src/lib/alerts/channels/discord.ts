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

const SEVERITY_COLORS: Record<string, number> = {
  latency: 0xff9800,     // orange
  jitter: 0xff9800,      // orange
  packet_loss: 0xf44336, // red
  dns: 0x2196f3,         // blue
  bufferbloat: 0x9c27b0, // purple
};

export async function sendDiscord(
  channelConfig: Record<string, string>,
  payload: AlertPayload
): Promise<void> {
  const webhookUrl = channelConfig.url;
  if (!webhookUrl) {
    console.error('Discord alert: missing webhook URL');
    return;
  }

  const color = SEVERITY_COLORS[payload.metric] || 0xff0000;

  const embed = {
    title: `⚠️ NetPulse Alert: ${payload.metric}`,
    description: payload.message,
    color,
    fields: [
      { name: 'Metric', value: payload.metric, inline: true },
      { name: 'Current Value', value: payload.current_value.toFixed(2), inline: true },
      { name: 'Threshold', value: `${payload.comparison} ${payload.threshold}`, inline: true },
      { name: 'Duration', value: `${payload.duration_min} min`, inline: true },
    ],
    timestamp: payload.fired_at,
    footer: { text: 'NetPulse ISP Monitor' },
  };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    console.error(`Discord alert failed: ${response.status} ${response.statusText}`);
  }
}
