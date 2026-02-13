'use client';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import { formatTime } from '@/lib/chart-utils';

interface DataPoint {
  time: string;
  bufferbloat_avg: number | null;
}

interface BufferbloatChartProps {
  data: DataPoint[];
  height?: number;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  const value = payload[0].value;
  let severity = 'Good';
  if (value > 300) severity = 'Severe';
  else if (value > 100) severity = 'Moderate';
  else if (value > 30) severity = 'Mild';

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-2">{new Date(label).toLocaleString()}</p>
      <p className="text-sm text-orange-500">
        Bufferbloat: {value?.toFixed(2)} ms
      </p>
      <p className="text-xs text-gray-400 mt-1">({severity})</p>
    </div>
  );
};

export default function BufferbloatChart({ data, height = 300, timeRange = '24h' }: BufferbloatChartProps) {
  const chartData = data.map(d => ({
    ...d,
    formattedTime: formatTime(d.time, timeRange),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="bufferbloatGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
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
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }}
          iconType="line"
        />
        <ReferenceLine
          y={30}
          stroke="#fbbf24"
          strokeDasharray="3 3"
          label={{ value: 'Mild (30ms)', fill: '#fbbf24', fontSize: 10 }}
        />
        <ReferenceLine
          y={100}
          stroke="#fb923c"
          strokeDasharray="3 3"
          label={{ value: 'Moderate (100ms)', fill: '#fb923c', fontSize: 10 }}
        />
        <ReferenceLine
          y={300}
          stroke="#ef4444"
          strokeDasharray="3 3"
          label={{ value: 'Severe (300ms)', fill: '#ef4444', fontSize: 10 }}
        />
        <Area
          type="monotone"
          dataKey="bufferbloat_avg"
          stroke="#f97316"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#bufferbloatGradient)"
          connectNulls
          name="Bufferbloat"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
