'use client';

interface ChartContainerProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
}

export default function ChartContainer({ title, children, loading }: ChartContainerProps) {
  return (
    <div className="relative bg-gray-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-gray-200 mb-4">{title}</h3>
      {loading && (
        <div className="absolute inset-0 bg-gray-800/50 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      {children}
    </div>
  );
}
