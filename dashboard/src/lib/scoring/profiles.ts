export type ScoreProfile = 'general' | 'gaming' | 'video_calls' | 'streaming';

export const PROFILES: Record<ScoreProfile, Record<string, number>> = {
  general:     { latency: 1.0, jitter: 1.0, packet_loss: 1.0, dns: 1.0, bufferbloat: 1.0 },
  gaming:      { latency: 1.5, jitter: 1.5, packet_loss: 1.2, dns: 0.5, bufferbloat: 1.3 },
  video_calls: { latency: 1.3, jitter: 1.3, packet_loss: 1.5, dns: 0.5, bufferbloat: 1.0 },
  streaming:   { latency: 0.5, jitter: 0.5, packet_loss: 1.0, dns: 0.5, bufferbloat: 1.5 },
};
