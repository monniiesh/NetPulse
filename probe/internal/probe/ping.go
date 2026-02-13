package probe

import (
	"fmt"
	"math"
	"sort"
	"sync"
	"time"

	probing "github.com/prometheus-community/pro-bing"
)

type PingProbe struct {
	targets []string
	count   int
}

func NewPingProbe(targets []string, count int) *PingProbe {
	return &PingProbe{
		targets: targets,
		count:   count,
	}
}

func (p *PingProbe) Type() ProbeType {
	return ProbeTypePing
}

func (p *PingProbe) Run() ([]Measurement, error) {
	var wg sync.WaitGroup
	results := make([]Measurement, len(p.targets))
	errors := make([]error, len(p.targets))

	for i, target := range p.targets {
		wg.Add(1)
		go func(idx int, tgt string) {
			defer wg.Done()
			measurement, err := p.pingTarget(tgt)
			if err != nil {
				errors[idx] = err
				return
			}
			results[idx] = measurement
		}(i, target)
	}

	wg.Wait()

	var validResults []Measurement
	var errs []error
	for i, result := range results {
		if errors[i] != nil {
			errs = append(errs, fmt.Errorf("target %s: %w", p.targets[i], errors[i]))
		} else {
			validResults = append(validResults, result)
		}
	}

	if len(validResults) == 0 && len(errs) > 0 {
		return nil, fmt.Errorf("all targets failed: %v", errs)
	}

	return validResults, nil
}

func (p *PingProbe) pingTarget(target string) (Measurement, error) {
	stats := pingWithFallback(target, p.count, 10*time.Second)

	if stats == nil || stats.PacketsSent == 0 {
		return Measurement{}, fmt.Errorf("no packets sent")
	}

	measurement := Measurement{
		Timestamp: time.Now(),
		ProbeType: ProbeTypePing,
		Target:    target,
	}

	packetLoss := float64(stats.PacketLoss)
	measurement.PacketLoss = F64(packetLoss)

	if len(stats.Rtts) > 0 {
		minRtt := stats.MinRtt.Seconds() * 1000
		avgRtt := stats.AvgRtt.Seconds() * 1000
		maxRtt := stats.MaxRtt.Seconds() * 1000

		measurement.LatencyMin = F64(minRtt)
		measurement.LatencyAvg = F64(avgRtt)
		measurement.LatencyMax = F64(maxRtt)

		p95 := calculateP95(stats.Rtts)
		measurement.LatencyP95 = F64(p95)

		jitter := calculateJitter(stats.Rtts)
		measurement.Jitter = F64(jitter)
	}

	return measurement, nil
}

// pingWithFallback tries privileged ICMP (raw socket) first, then
// unprivileged (UDP) if no replies are received.
func pingWithFallback(target string, count int, timeout time.Duration) *probing.Statistics {
	pinger, err := probing.NewPinger(target)
	if err != nil {
		return nil
	}
	pinger.Count = count
	pinger.Timeout = timeout

	pinger.SetPrivileged(true)
	if err := pinger.Run(); err == nil {
		stats := pinger.Statistics()
		if stats.PacketsRecv > 0 {
			return stats
		}
	}

	unprivPinger, err := probing.NewPinger(target)
	if err != nil {
		return nil
	}
	unprivPinger.Count = count
	unprivPinger.Timeout = timeout
	unprivPinger.SetPrivileged(false)

	if err := unprivPinger.Run(); err == nil {
		stats := unprivPinger.Statistics()
		if stats.PacketsRecv > 0 {
			return stats
		}
	}

	return nil
}

func calculateP95(rtts []time.Duration) float64 {
	if len(rtts) == 0 {
		return 0
	}

	sorted := make([]time.Duration, len(rtts))
	copy(sorted, rtts)
	sort.Slice(sorted, func(i, j int) bool {
		return sorted[i] < sorted[j]
	})

	idx := int(math.Ceil(float64(len(sorted)) * 0.95))
	if idx >= len(sorted) {
		idx = len(sorted) - 1
	}
	if idx < 0 {
		idx = 0
	}

	return sorted[idx].Seconds() * 1000
}

func calculateJitter(rtts []time.Duration) float64 {
	if len(rtts) < 2 {
		return 0
	}

	// RFC 3550 exponential weighted moving average with gain 1/16.
	jitter := 0.0
	for i := 1; i < len(rtts); i++ {
		diff := math.Abs(rtts[i].Seconds() - rtts[i-1].Seconds())
		jitter = jitter + (diff-jitter)/16.0
	}

	return jitter * 1000
}
