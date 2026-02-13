'use client';

interface Anomaly {
  id: string;
  metric: string;
  severity: string;
  day_of_week: number | null;
  hour_of_day: number | null;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const SEVERITY_WEIGHT: Record<string, number> = {
  mild: 1,
  moderate: 2,
  severe: 3,
};

function getColor(intensity: number): string {
  if (intensity === 0) return 'bg-gray-800/50';
  if (intensity <= 1) return 'bg-yellow-500/30';
  if (intensity <= 2) return 'bg-orange-500/40';
  if (intensity <= 4) return 'bg-orange-500/70';
  return 'bg-red-500/80';
}

export default function AnomalyHeatmap({ anomalies }: { anomalies: Anomaly[] }) {
  // Build heatmap grid: day × hour → total severity weight
  const grid: number[][] = DAYS.map(() => HOURS.map(() => 0));

  for (const a of anomalies) {
    if (a.day_of_week !== null && a.hour_of_day !== null) {
      const weight = SEVERITY_WEIGHT[a.severity] || 1;
      grid[a.day_of_week][a.hour_of_day] += weight;
    }
  }

  if (anomalies.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        No anomaly data available for heatmap
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Hour labels */}
        <div className="flex ml-12 mb-1">
          {HOURS.map((h) => (
            <div key={h} className="flex-1 text-center text-xs text-gray-500">
              {h % 3 === 0 ? `${h}` : ''}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {DAYS.map((day, dayIdx) => (
          <div key={day} className="flex items-center gap-1 mb-1">
            <div className="w-10 text-right text-xs text-gray-400 pr-2">{day}</div>
            <div className="flex flex-1 gap-[2px]">
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className={`flex-1 h-6 rounded-sm ${getColor(grid[dayIdx][hour])} transition-colors`}
                  title={`${day} ${hour}:00 - Severity: ${grid[dayIdx][hour]}`}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 ml-12 text-xs text-gray-400">
          <span>Less</span>
          <div className="flex gap-1">
            <div className="w-4 h-4 rounded-sm bg-gray-800/50" />
            <div className="w-4 h-4 rounded-sm bg-yellow-500/30" />
            <div className="w-4 h-4 rounded-sm bg-orange-500/40" />
            <div className="w-4 h-4 rounded-sm bg-orange-500/70" />
            <div className="w-4 h-4 rounded-sm bg-red-500/80" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
