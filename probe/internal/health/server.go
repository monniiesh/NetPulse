package health

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"
)

// Status holds the current health status of the probe.
type Status struct {
	Healthy       bool      `json:"healthy"`
	Uptime        string    `json:"uptime"`
	LastPing      time.Time `json:"last_ping,omitempty"`
	LastDNS       time.Time `json:"last_dns,omitempty"`
	LastBufferbloat time.Time `json:"last_bufferbloat,omitempty"`
	MeasurementCount int64  `json:"measurement_count"`
}

// Server provides a local HTTP health endpoint.
type Server struct {
	startTime        time.Time
	measurementCount atomic.Int64
	lastPing         atomic.Value
	lastDNS          atomic.Value
	lastBufferbloat  atomic.Value
	logger           *slog.Logger
}

// NewServer creates a health check server.
func NewServer(logger *slog.Logger) *Server {
	s := &Server{
		startTime: time.Now(),
		logger:    logger,
	}
	s.lastPing.Store(time.Time{})
	s.lastDNS.Store(time.Time{})
	s.lastBufferbloat.Store(time.Time{})
	return s
}

// RecordMeasurement updates the health status with a new measurement.
func (s *Server) RecordMeasurement(probeType string) {
	s.measurementCount.Add(1)
	now := time.Now()
	switch probeType {
	case "ping":
		s.lastPing.Store(now)
	case "dns":
		s.lastDNS.Store(now)
	case "bufferbloat":
		s.lastBufferbloat.Store(now)
	}
}

// Run starts the health HTTP server. Blocks until ctx is cancelled.
func (s *Server) Run(ctx context.Context, addr string) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)

	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(shutdownCtx)
	}()

	s.logger.Info("health server listening", "addr", addr)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	status := Status{
		Healthy:          true,
		Uptime:           time.Since(s.startTime).Round(time.Second).String(),
		LastPing:         s.lastPing.Load().(time.Time),
		LastDNS:          s.lastDNS.Load().(time.Time),
		LastBufferbloat:  s.lastBufferbloat.Load().(time.Time),
		MeasurementCount: s.measurementCount.Load(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
