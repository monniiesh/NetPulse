'use client';

interface Probe {
  id: string;
  name: string;
  location: string | null;
}

interface ProbeSelectorProps {
  probes: Probe[];
  selectedId: string;
  onChange: (id: string) => void;
}

export function ProbeSelector({ probes, selectedId, onChange }: ProbeSelectorProps) {
  return (
    <div className="relative">
      <select
        value={selectedId}
        onChange={(e) => onChange(e.target.value)}
        className="appearance-none bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer hover:border-gray-600 transition-colors"
      >
        {probes.map((probe) => (
          <option key={probe.id} value={probe.id}>
            {probe.name}
            {probe.location ? ` (${probe.location})` : ''}
          </option>
        ))}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </div>
  );
}
