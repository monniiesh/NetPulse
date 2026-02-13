'use client';

interface MetricCardProps {
  name: string;
  value: number | null;
  unit: string;
  status: 'good' | 'fair' | 'poor' | 'critical';
  icon: React.ReactNode;
}

const STATUS_COLORS = {
  good: 'bg-green-500',
  fair: 'bg-yellow-500',
  poor: 'bg-orange-500',
  critical: 'bg-red-500',
};

const STATUS_LABELS = {
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

export function MetricCard({ name, value, unit, status, icon }: MetricCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="text-gray-400">{icon}</div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[status]}`} />
          <span className="text-xs text-gray-500">{STATUS_LABELS[status]}</span>
        </div>
      </div>

      <div className="mb-2">
        <h3 className="text-sm font-medium text-gray-400 mb-1">{name}</h3>
        <div className="text-2xl font-bold text-white">
          {value !== null ? (
            <>
              {value.toFixed(1)}
              <span className="text-lg text-gray-500 ml-1">{unit}</span>
            </>
          ) : (
            <span className="text-gray-600">--</span>
          )}
        </div>
      </div>
    </div>
  );
}
