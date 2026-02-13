'use client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { formatTime } from '@/lib/chart-utils';

interface DataPoint {
  time: string;
  latency_avg: number | null;
  latency_p95: number | null;
}

interface LatencyChartProps {
  data: DataPoint[];
  height?: number;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-2">{new Date(label).toLocaleString()}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {entry.value?.toFixed(2)} ms
        </p>
      ))}
    </div>
  );
};

export default function LatencyChart({ data, height = 300, timeRange = '24h' }: LatencyChartProps) {
  const chartData = data.map(d => ({
    ...d,
    formattedTime: formatTime(d.time, timeRange),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="formattedTime"
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          label={{ value: 'ms', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: '14px', color: '#9ca3af' }}
        />
        <Line
          type="monotone"
          dataKey="latency_avg"
          stroke="#3b82f6"
          strokeWidth={2}
          name="Avg Latency"
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="latency_p95"
          stroke="#60a5fa"
          strokeWidth={2}
          strokeDasharray="5 5"
          name="P95 Latency"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
