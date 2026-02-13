'use client';

import { useEffect, useState } from 'react';

interface QualityScoreProps {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  profile: string;
  primaryIssue: string | null;
}

const GRADE_COLORS = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

export function QualityScore({
  score,
  grade,
  label,
  profile,
  primaryIssue,
}: QualityScoreProps) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = score / steps;
    let current = 0;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      current = Math.min(score, current + increment);
      setAnimatedScore(Math.round(current));

      if (step >= steps || current >= score) {
        setAnimatedScore(score);
        clearInterval(timer);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const color = GRADE_COLORS[grade];

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <div className="relative">
        <div
          className="w-40 h-40 rounded-full flex items-center justify-center"
          style={{
            border: `8px solid ${color}`,
            boxShadow: `0 0 30px ${color}40`,
          }}
        >
          <span
            className="text-7xl font-bold"
            style={{ color }}
          >
            {grade}
          </span>
        </div>
      </div>

      <div className="text-center">
        <div className="text-4xl font-semibold text-white mb-1">
          {animatedScore} <span className="text-gray-500">/ 100</span>
        </div>
        <div className="text-xl text-gray-400 mb-2">{label}</div>
        <div className="text-sm text-gray-500 uppercase tracking-wider">
          {profile} Profile
        </div>
      </div>

      {primaryIssue && (
        <div className="mt-4 max-w-md px-4 py-3 bg-red-950/30 border border-red-900/50 rounded-lg">
          <div className="text-sm text-red-300">{primaryIssue}</div>
        </div>
      )}
    </div>
  );
}
