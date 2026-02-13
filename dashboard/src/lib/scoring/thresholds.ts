export interface MetricThresholds {
  good: number;
  fair: number;
  poor: number;
  critical: number;
  maxPenalty: number;
}

export const THRESHOLDS: Record<string, MetricThresholds> = {
  latency:     { good: 30,  fair: 80,  poor: 200, critical: 500, maxPenalty: 30 },
  jitter:      { good: 5,   fair: 20,  poor: 50,  critical: 100, maxPenalty: 20 },
  packet_loss: { good: 0.5, fair: 2,   poor: 5,   critical: 10,  maxPenalty: 30 },
  dns:         { good: 50,  fair: 150, poor: 500, critical: 1000, maxPenalty: 10 },
  bufferbloat: { good: 30,  fair: 100, poor: 300, critical: 600,  maxPenalty: 10 },
};
