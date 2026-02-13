'use client';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { formatTime } from '@/lib/chart-utils';

interface DataPoint {
  time: string;
  packet_loss_avg: number | null;
}

interface PacketLossChartProps {
  data: DataPoint[];
  height?: number;
  timeRange?: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
      <p className="text-gray-400 text-sm mb-2">{new Date(label).toLocaleString()}</p>
      <p className="text-sm text-red-500">
        Packet Loss: {payload[0].value?.toFixed(2)}%
      </p>
    </div>
  );
};

export default function PacketLossChart({ data, height = 300, timeRange = '24h' }: PacketLossChartProps) {
  const chartData = data.map(d => ({
    ...d,
    formattedTime: formatTime(d.time, timeRange),
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="formattedTime"
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
        />
        <YAxis
          stroke="#9ca3af"
          style={{ fontSize: '12px' }}
          domain={[0, 100]}
          label={{ value: '%', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="packet_loss_avg">
          {chartData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={(entry.packet_loss_avg ?? 0) > 0 ? '#ef4444' : '#374151'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
