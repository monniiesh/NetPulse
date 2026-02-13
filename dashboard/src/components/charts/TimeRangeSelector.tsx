'use client';

type TimeRange = '6h' | '24h' | '7d' | '30d' | '90d' | '1yr';

interface TimeRangeSelectorProps {
  selected: TimeRange;
  onChange: (range: TimeRange) => void;
}

const ranges: { value: TimeRange; label: string }[] = [
  { value: '6h', label: '6H' },
  { value: '24h', label: '24H' },
  { value: '7d', label: '7D' },
  { value: '30d', label: '30D' },
  { value: '90d', label: '90D' },
  { value: '1yr', label: '1Y' },
];

export default function TimeRangeSelector({ selected, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="inline-flex rounded-lg bg-gray-800 p-1 gap-1">
      {ranges.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            selected === value
              ? 'bg-blue-500 text-white'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
