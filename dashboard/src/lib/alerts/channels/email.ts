import nodemailer from 'nodemailer';

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

function getTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

export async function sendEmail(
  channelConfig: Record<string, string>,
  payload: AlertPayload
): Promise<void> {
  const to = channelConfig.email;
  if (!to) {
    console.error('Email alert: missing email in channel config');
    return;
  }

  const transporter = getTransporter();
  const from = process.env.SMTP_FROM || 'netpulse@localhost';

  const html = `
    <div style="font-family: sans-serif; max-width: 600px;">
      <h2 style="color: #f44336;">⚠️ NetPulse Alert</h2>
      <p style="font-size: 16px;">${payload.message}</p>
      <table style="border-collapse: collapse; width: 100%; margin-top: 16px;">
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-weight: bold;">Metric</td>
          <td style="padding: 8px;">${payload.metric}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-weight: bold;">Current Value</td>
          <td style="padding: 8px;">${payload.current_value.toFixed(2)}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-weight: bold;">Threshold</td>
          <td style="padding: 8px;">${payload.comparison} ${payload.threshold}</td>
        </tr>
        <tr style="border-bottom: 1px solid #eee;">
          <td style="padding: 8px; font-weight: bold;">Duration</td>
          <td style="padding: 8px;">${payload.duration_min} minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Fired At</td>
          <td style="padding: 8px;">${new Date(payload.fired_at).toLocaleString()}</td>
        </tr>
      </table>
      <p style="margin-top: 16px; color: #666; font-size: 12px;">
        Sent by NetPulse ISP Monitor
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to,
    subject: `[NetPulse] Alert: ${payload.metric} threshold exceeded`,
    html,
  });
}
