export type MetricName = 'latency' | 'jitter' | 'packet_loss' | 'dns' | 'bufferbloat';
export type ScoreProfile = 'general' | 'gaming' | 'video_calls' | 'streaming';
export type AlertChannel = 'email' | 'webhook' | 'discord';
export type ReportStatus = 'pending' | 'generating' | 'ready' | 'failed';
export type Severity = 'mild' | 'moderate' | 'severe';
export type Comparison = 'gt' | 'lt' | 'gte' | 'lte';

export interface RawMeasurement {
  timestamp: string;
  target: string;
  latency_avg: number | null;
  latency_p95: number | null;
  jitter: number | null;
  packet_loss: number | null;
  dns_time: number | null;
  bufferbloat: number | null;
}

export interface ProbePayload {
  probe_id: string;
  measurements: RawMeasurement[];
}

export interface AggregatedMeasurement {
  time: string;
  probe_id: string;
  target: string;
  latency_avg: number;
  latency_p95: number;
  jitter_avg: number;
  jitter_max: number;
  packet_loss_avg: number;
  packet_loss_max: number;
  dns_time_avg: number;
  bufferbloat_avg: number;
  sample_count: number;
}

export interface MetricPenalty {
  value: number;
  penalty: number;
  status: 'good' | 'fair' | 'poor' | 'critical';
}

export interface QualityScore {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  label: string;
  profile: ScoreProfile;
  breakdown: Record<MetricName, MetricPenalty>;
  primary_issue: string | null;
}

export interface Probe {
  id: string;
  name: string;
  location: string | null;
  last_seen: string | null;
  is_active: boolean;
}

export interface IngestResponse {
  accepted: number;
  rejected: number;
  errors?: string[];
}
