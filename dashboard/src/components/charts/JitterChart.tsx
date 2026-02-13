'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { formatTime } from '@/lib/chart-utils';

interface DataPoint {
  time: string;
  jitter_avg: number | null;
}

interface JitterChartProps {
  data: DataPoint[];
  height?: number;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-2">{new Date(label).toLocaleString()}</p>
      <p className="text-sm" style={{ color: payload[0].color }}>
        Jitter: {payload[0].value?.toFixed(2)} ms
      </p>
    </div>
  );
};

export default function JitterChart({ data, height = 300, timeRange = '24h' }: JitterChartProps) {
  const chartData = data.map(d => ({
    ...d,
    formattedTime: formatTime(d.time, timeRange),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="jitterGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
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
        <Area
          type="monotone"
          dataKey="jitter_avg"
          stroke="#8b5cf6"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#jitterGradient)"
          connectNulls
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
