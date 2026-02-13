package probe

import "time"

// ProbeType identifies the kind of measurement.
type ProbeType string

const (
	ProbeTypePing       ProbeType = "ping"
	ProbeTypeDNS        ProbeType = "dns"
	ProbeTypeBufferbloat ProbeType = "bufferbloat"
)

// Measurement holds the result of a single probe run.
type Measurement struct {
	Timestamp  time.Time `json:"timestamp"`
	ProbeType  ProbeType `json:"probe_type"`
	Target     string    `json:"target"`
	LatencyMin *float64  `json:"latency_min,omitempty"`
	LatencyAvg *float64  `json:"latency_avg,omitempty"`
	LatencyMax *float64  `json:"latency_max,omitempty"`
	LatencyP95 *float64  `json:"latency_p95,omitempty"`
	Jitter     *float64  `json:"jitter,omitempty"`
	PacketLoss *float64  `json:"packet_loss,omitempty"`
	DNSTime    *float64  `json:"dns_time,omitempty"`
	Bufferbloat *float64 `json:"bufferbloat,omitempty"`
}

// Prober is the interface all probe implementations must satisfy.
type Prober interface {
	// Run executes the probe and returns measurements.
	Run() ([]Measurement, error)
	// Type returns the probe type identifier.
	Type() ProbeType
}

// f64 is a helper to create a *float64 from a float64 value.
func F64(v float64) *float64 {
	return &v
}
