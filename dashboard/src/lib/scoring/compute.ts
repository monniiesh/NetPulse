import { THRESHOLDS, type MetricThresholds } from './thresholds';
import { PROFILES, type ScoreProfile } from './profiles';
import type { MetricName, MetricPenalty, QualityScore } from '@/types';

interface MetricValues {
  latency: number | null;
  jitter: number | null;
  packet_loss: number | null;
  dns: number | null;
  bufferbloat: number | null;
}

const ISSUE_MESSAGES: Record<MetricName, (value: number) => string> = {
  latency: (value) => `High latency (${value.toFixed(1)}ms). Check your connection or try a wired connection.`,
  jitter: (value) => `High jitter (${value.toFixed(1)}ms). Your connection is unstable.`,
  packet_loss: (value) => `Packet loss (${value.toFixed(1)}%). Check physical connections.`,
  dns: (value) => `Slow DNS resolution (${value.toFixed(1)}ms). Consider switching to 1.1.1.1 or 8.8.8.8.`,
  bufferbloat: (value) => `Bufferbloat detected (${value.toFixed(1)}ms). Consider enabling SQM/QoS on your router.`,
};

function getMetricStatus(value: number, thresholds: MetricThresholds): 'good' | 'fair' | 'poor' | 'critical' {
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.fair) return 'fair';
  if (value <= thresholds.poor) return 'poor';
  return 'critical';
}

function calculatePenalty(value: number, thresholds: MetricThresholds): number {
  if (value <= thresholds.good) return 0;

  if (value <= thresholds.fair) {
    const range = thresholds.fair - thresholds.good;
    const position = value - thresholds.good;
    return (position / range) * 0.33 * thresholds.maxPenalty;
  }

  if (value <= thresholds.poor) {
    const range = thresholds.poor - thresholds.fair;
    const position = value - thresholds.fair;
    return (0.33 + (position / range) * 0.42) * thresholds.maxPenalty;
  }

  if (value <= thresholds.critical) {
    const range = thresholds.critical - thresholds.poor;
    const position = value - thresholds.poor;
    return (0.75 + (position / range) * 0.25) * thresholds.maxPenalty;
  }

  return thresholds.maxPenalty;
}

function scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 90) return 'A';
  if (score >= 80) return 'B';
  if (score >= 65) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

function scoreToLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Good';
  if (score >= 65) return 'Fair';
  if (score >= 45) return 'Poor';
  return 'Failing';
}

export function computeQualityScore(
  metrics: MetricValues,
  profile: ScoreProfile = 'general'
): QualityScore {
  const profileWeights = PROFILES[profile];
  let totalPenalty = 0;
  const breakdown: Record<MetricName, MetricPenalty> = {} as Record<MetricName, MetricPenalty>;
  let maxPenalty = 0;
  let primaryIssueMetric: MetricName | null = null;

  const metricKeys: MetricName[] = ['latency', 'jitter', 'packet_loss', 'dns', 'bufferbloat'];

  for (const metric of metricKeys) {
    const value = metrics[metric];

    if (value === null) {
      breakdown[metric] = {
        value: 0,
        penalty: 0,
        status: 'good',
      };
      continue;
    }

    const thresholds = THRESHOLDS[metric];
    const rawPenalty = calculatePenalty(value, thresholds);
    const weightedPenalty = rawPenalty * profileWeights[metric];
    const status = getMetricStatus(value, thresholds);

    breakdown[metric] = {
      value,
      penalty: weightedPenalty,
      status,
    };

    totalPenalty += weightedPenalty;

    if (weightedPenalty > maxPenalty) {
      maxPenalty = weightedPenalty;
      primaryIssueMetric = metric;
    }
  }

  const score = Math.max(0, Math.min(100, 100 - totalPenalty));
  const grade = scoreToGrade(score);
  const label = scoreToLabel(score);

  const primary_issue = primaryIssueMetric && maxPenalty > 0
    ? ISSUE_MESSAGES[primaryIssueMetric](breakdown[primaryIssueMetric].value)
    : null;

  return {
    score,
    grade,
    label,
    profile,
    breakdown,
    primary_issue,
  };
}
