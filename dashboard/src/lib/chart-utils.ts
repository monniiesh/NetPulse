export type TimeRange = '6h' | '24h' | '7d' | '30d' | '90d' | '1yr';

export function formatTime(isoString: string, range: string): string {
  const date = new Date(isoString);
  if (range === '6h' || range === '24h') {
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  }
  if (range === '7d') {
    return date.toLocaleDateString('en-US', { weekday: 'short', hour: '2-digit' });
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function timeRangeToParams(range: TimeRange): { from: string; to: string; resolution: string } {
  const now = new Date();
  const from = new Date(now);

  switch (range) {
    case '6h':
      from.setHours(from.getHours() - 6);
      return { from: from.toISOString(), to: now.toISOString(), resolution: 'raw' };
    case '24h':
      from.setHours(from.getHours() - 24);
      return { from: from.toISOString(), to: now.toISOString(), resolution: '5min' };
    case '7d':
      from.setDate(from.getDate() - 7);
      return { from: from.toISOString(), to: now.toISOString(), resolution: '5min' };
    case '30d':
      from.setDate(from.getDate() - 30);
      return { from: from.toISOString(), to: now.toISOString(), resolution: '1hr' };
    case '90d':
      from.setDate(from.getDate() - 90);
      return { from: from.toISOString(), to: now.toISOString(), resolution: '1hr' };
    case '1yr':
      from.setFullYear(from.getFullYear() - 1);
      return { from: from.toISOString(), to: now.toISOString(), resolution: '1day' };
  }
}
