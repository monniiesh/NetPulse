# NetPulse Chart Components

Recharts-based metric visualization components for the NetPulse dashboard.

## Components

### Chart Components

- **LatencyChart** - Line chart showing average and P95 latency
- **JitterChart** - Area chart for jitter measurements
- **PacketLossChart** - Bar chart highlighting packet loss events
- **DnsChart** - Line chart for DNS resolution times
- **BufferbloatChart** - Area chart with severity threshold reference lines

### Utility Components

- **ChartContainer** - Wrapper with consistent styling and loading state
- **TimeRangeSelector** - Button group for time range selection (6h, 24h, 7d, 30d, 90d, 1yr)

## Usage Example

```tsx
'use client';

import { useState, useEffect } from 'react';
import {
  LatencyChart,
  JitterChart,
  PacketLossChart,
  DnsChart,
  BufferbloatChart,
  ChartContainer,
  TimeRangeSelector,
} from '@/components/charts';
import { timeRangeToParams } from '@/lib/chart-utils';
import type { TimeRange } from '@/lib/chart-utils';

export default function MetricsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      const params = timeRangeToParams(timeRange);
      const query = new URLSearchParams({
        from: params.from,
        to: params.to,
        resolution: params.resolution,
      });

      const response = await fetch(`/api/v1/metrics?${query}`);
      const result = await response.json();
      setData(result.data);
      setLoading(false);
    };

    fetchMetrics();
  }, [timeRange]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Network Metrics</h1>
        <TimeRangeSelector selected={timeRange} onChange={setTimeRange} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer title="Latency" loading={loading}>
          <LatencyChart data={data} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Jitter" loading={loading}>
          <JitterChart data={data} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Packet Loss" loading={loading}>
          <PacketLossChart data={data} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="DNS Resolution" loading={loading}>
          <DnsChart data={data} timeRange={timeRange} />
        </ChartContainer>

        <ChartContainer title="Bufferbloat" loading={loading}>
          <BufferbloatChart data={data} timeRange={timeRange} />
        </ChartContainer>
      </div>
    </div>
  );
}
```

## Data Format

All chart components expect data from the metrics API endpoint:

```typescript
interface MetricDataPoint {
  time: string;                  // ISO 8601 timestamp
  latency_avg: number | null;    // Average latency in ms
  latency_p95: number | null;    // P95 latency in ms
  jitter_avg: number | null;     // Average jitter in ms
  packet_loss_avg: number | null; // Packet loss percentage (0-100)
  dns_time_avg: number | null;   // DNS resolution time in ms
  bufferbloat_avg: number | null; // Bufferbloat in ms
  sample_count: number;           // Number of measurements
}
```

## Customization

All chart components accept these props:

```typescript
interface ChartProps {
  data: DataPoint[];           // Metric data array
  height?: number;             // Chart height in pixels (default: 300)
  timeRange?: string;          // Time range for X-axis formatting (default: '24h')
}
```

## Color Palette

- **Latency**: Blue (#3b82f6) and Light Blue (#60a5fa)
- **Jitter**: Violet (#8b5cf6)
- **Packet Loss**: Red (#ef4444)
- **DNS**: Green (#22c55e)
- **Bufferbloat**: Orange (#f97316)

## Dark Theme

All components use a consistent dark theme:
- Background: Transparent (inherits from ChartContainer)
- Grid lines: Gray (#374151)
- Axis text: Gray (#9ca3af)
- Tooltip background: Dark gray (#1f2937) with gray border (#374151)
