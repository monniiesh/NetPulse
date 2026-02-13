'use client';

interface LiveIndicatorProps {
  status: 'connected' | 'reconnecting' | 'disconnected';
}

const STATUS_CONFIG = {
  connected: {
    color: 'bg-green-500',
    label: 'Live',
    animate: true,
  },
  reconnecting: {
    color: 'bg-yellow-500',
    label: 'Reconnecting',
    animate: false,
  },
  disconnected: {
    color: 'bg-red-500',
    label: 'Offline',
    animate: false,
  },
};

export function LiveIndicator({ status }: LiveIndicatorProps) {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800 rounded-lg border border-gray-700">
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${config.color}`} />
        {config.animate && (
          <div className={`absolute inset-0 w-2 h-2 rounded-full ${config.color} animate-ping opacity-75`} />
        )}
      </div>
      <span className="text-sm text-gray-300">{config.label}</span>
    </div>
  );
}
