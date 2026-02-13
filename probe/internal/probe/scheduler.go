package probe

import (
	"context"
	"log/slog"
	"sync"
	"time"
)

// MeasurementHandler is called when new measurements are collected.
type MeasurementHandler func([]Measurement)

// ScheduledProbe pairs a Prober with its run interval.
type ScheduledProbe struct {
	Prober   Prober
	Interval time.Duration
}

// Scheduler runs probes on their configured intervals and delivers
// measurements through a handler callback.
type Scheduler struct {
	probes  []ScheduledProbe
	handler MeasurementHandler
	logger  *slog.Logger
	wg      sync.WaitGroup
}

// NewScheduler creates a scheduler that delivers measurements to handler.
func NewScheduler(handler MeasurementHandler, logger *slog.Logger) *Scheduler {
	return &Scheduler{
		handler: handler,
		logger:  logger,
	}
}

// Add registers a probe with its execution interval.
func (s *Scheduler) Add(p Prober, interval time.Duration) {
	s.probes = append(s.probes, ScheduledProbe{
		Prober:   p,
		Interval: interval,
	})
}

// Run starts all scheduled probes and blocks until ctx is cancelled.
// Each probe runs in its own goroutine on a fixed ticker.
func (s *Scheduler) Run(ctx context.Context) {
	for _, sp := range s.probes {
		s.wg.Add(1)
		go s.runProbe(ctx, sp)
	}

	s.logger.Info("scheduler started", "probe_count", len(s.probes))
	s.wg.Wait()
	s.logger.Info("scheduler stopped")
}

func (s *Scheduler) runProbe(ctx context.Context, sp ScheduledProbe) {
	defer s.wg.Done()

	probeType := sp.Prober.Type()
	s.logger.Info("starting probe", "type", probeType, "interval", sp.Interval)

	// Run immediately on start, then on ticker.
	s.executeProbe(probeType, sp.Prober)

	ticker := time.NewTicker(sp.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("stopping probe", "type", probeType)
			return
		case <-ticker.C:
			s.executeProbe(probeType, sp.Prober)
		}
	}
}

func (s *Scheduler) executeProbe(probeType ProbeType, p Prober) {
	start := time.Now()
	measurements, err := p.Run()
	elapsed := time.Since(start)

	if err != nil {
		s.logger.Error("probe failed",
			"type", probeType,
			"elapsed", elapsed,
			"error", err,
		)
		return
	}

	s.logger.Debug("probe completed",
		"type", probeType,
		"measurements", len(measurements),
		"elapsed", elapsed,
	)

	if len(measurements) > 0 && s.handler != nil {
		s.handler(measurements)
	}
}
