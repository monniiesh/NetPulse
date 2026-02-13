'use client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatTime } from '@/lib/chart-utils';

interface DataPoint {
  time: string;
  dns_time_avg: number | null;
}

interface DnsChartProps {
  data: DataPoint[];
  height?: number;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-2">{new Date(label).toLocaleString()}</p>
      <p className="text-sm text-green-500">
        DNS Time: {payload[0].value?.toFixed(2)} ms
      </p>
    </div>
  );
};

export default function DnsChart({ data, height = 300, timeRange = '24h' }: DnsChartProps) {
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
        <Line
          type="monotone"
          dataKey="dns_time_avg"
          stroke="#22c55e"
          strokeWidth={2}
          name="DNS Resolution Time"
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
