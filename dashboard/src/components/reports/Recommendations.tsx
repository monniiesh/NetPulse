'use client';

import type { QualityScore } from '@/types';
import { THRESHOLDS } from '@/lib/scoring/thresholds';

interface RecommendationsProps {
  score: QualityScore;
  anomalyCount: number;
  patternDescriptions: string[];
}

interface Recommendation {
  priority: number;
  severity: 'info' | 'warning' | 'critical';
  text: string;
}

const severityStyles = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  critical: 'bg-red-50 border-red-200 text-red-900',
};

const severityLabels = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
};

function generateRecommendations(
  score: QualityScore,
  anomalyCount: number,
  patternDescriptions: string[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let priority = 1;

  if (score.score >= 90) {
    recommendations.push({
      priority: priority++,
      severity: 'info',
      text: 'Your connection quality is excellent. No action needed.',
    });
    return recommendations;
  }

  const { breakdown } = score;

  if (breakdown.bufferbloat.value > THRESHOLDS.bufferbloat.poor) {
    recommendations.push({
      priority: priority++,
      severity: 'critical',
      text: `High bufferbloat detected (${breakdown.bufferbloat.value.toFixed(1)}ms). Enable SQM/QoS on your router to reduce bufferbloat and improve responsiveness under load.`,
    });
  } else if (breakdown.bufferbloat.value > THRESHOLDS.bufferbloat.fair) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `Moderate bufferbloat detected (${breakdown.bufferbloat.value.toFixed(1)}ms). Consider enabling SQM/QoS on your router.`,
    });
  }

  if (breakdown.packet_loss.value > THRESHOLDS.packet_loss.poor) {
    recommendations.push({
      priority: priority++,
      severity: 'critical',
      text: `High packet loss detected (${breakdown.packet_loss.value.toFixed(2)}%). Check all physical connections, cables, and ethernet ports. Consider replacing damaged cables.`,
    });
  } else if (breakdown.packet_loss.value > THRESHOLDS.packet_loss.fair) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `Moderate packet loss detected (${breakdown.packet_loss.value.toFixed(2)}%). Inspect physical connections and cables for damage or loose connections.`,
    });
  }

  if (breakdown.latency.value > THRESHOLDS.latency.poor) {
    recommendations.push({
      priority: priority++,
      severity: 'critical',
      text: `High latency detected (${breakdown.latency.value.toFixed(1)}ms). Check your physical connection quality. If using Wi-Fi, switch to a wired ethernet connection for best results.`,
    });
  } else if (breakdown.latency.value > THRESHOLDS.latency.fair) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `Moderate latency detected (${breakdown.latency.value.toFixed(1)}ms). Consider switching from Wi-Fi to a wired connection if possible.`,
    });
  }

  if (breakdown.jitter.value > THRESHOLDS.jitter.poor) {
    recommendations.push({
      priority: priority++,
      severity: 'critical',
      text: `High jitter detected (${breakdown.jitter.value.toFixed(1)}ms). Your connection is unstable. Check for network congestion, interference (if using Wi-Fi), or contact your ISP if the issue persists.`,
    });
  } else if (breakdown.jitter.value > THRESHOLDS.jitter.fair) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `Moderate jitter detected (${breakdown.jitter.value.toFixed(1)}ms). Your connection stability could be improved. Check for sources of interference or congestion.`,
    });
  }

  if (breakdown.dns.value > THRESHOLDS.dns.poor) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `Slow DNS resolution detected (${breakdown.dns.value.toFixed(1)}ms). Switch to a faster DNS resolver like Cloudflare (1.1.1.1) or Google (8.8.8.8).`,
    });
  } else if (breakdown.dns.value > THRESHOLDS.dns.fair) {
    recommendations.push({
      priority: priority++,
      severity: 'info',
      text: `DNS resolution could be faster (${breakdown.dns.value.toFixed(1)}ms). Consider switching to Cloudflare (1.1.1.1) or Google (8.8.8.8) DNS for improved performance.`,
    });
  }

  if (patternDescriptions.length > 0) {
    for (const pattern of patternDescriptions) {
      recommendations.push({
        priority: priority++,
        severity: 'warning',
        text: `Recurring pattern detected: ${pattern}. Monitor your connection during these times.`,
      });
    }
  }

  if (anomalyCount > 10) {
    recommendations.push({
      priority: priority++,
      severity: 'warning',
      text: `${anomalyCount} anomalies detected during this period. Review the Anomaly Report section for details.`,
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 1,
      severity: 'info',
      text: 'Your connection quality is good. Continue monitoring for any changes.',
    });
  }

  return recommendations;
}

export default function Recommendations({
  score,
  anomalyCount,
  patternDescriptions,
}: RecommendationsProps) {
  const recommendations = generateRecommendations(score, anomalyCount, patternDescriptions);

  return (
    <section className="mb-8">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Recommendations</h2>

      <div className="space-y-4">
        {recommendations.map((rec) => (
          <div
            key={rec.priority}
            className={`p-4 border rounded-lg ${severityStyles[rec.severity]}`}
          >
            <div className="flex items-start">
              <div className="flex-shrink-0 mr-3">
                <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center font-bold text-sm">
                  {rec.priority}
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center mb-1">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    {severityLabels[rec.severity]}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{rec.text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
