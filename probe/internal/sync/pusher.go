package sync

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"time"
)

// StoredMeasurement mirrors the storage layer's stored measurement type.
type StoredMeasurement struct {
	ID         int64    `json:"id"`
	Timestamp  string   `json:"timestamp"`
	ProbeType  string   `json:"probe_type"`
	Target     string   `json:"target"`
	LatencyMin *float64 `json:"latency_min,omitempty"`
	LatencyAvg *float64 `json:"latency_avg,omitempty"`
	LatencyMax *float64 `json:"latency_max,omitempty"`
	LatencyP95 *float64 `json:"latency_p95,omitempty"`
	Jitter     *float64 `json:"jitter,omitempty"`
	PacketLoss *float64 `json:"packet_loss,omitempty"`
	DNSTime    *float64 `json:"dns_time,omitempty"`
	Bufferbloat *float64 `json:"bufferbloat,omitempty"`
}

// IngestPayload is the JSON body sent to the dashboard ingest endpoint.
type IngestPayload struct {
	ProbeID      string              `json:"probe_id"`
	Measurements []IngestMeasurement `json:"measurements"`
}

// IngestMeasurement is a single measurement in the ingest payload.
type IngestMeasurement struct {
	Timestamp   string   `json:"timestamp"`
	Target      string   `json:"target"`
	LatencyAvg  *float64 `json:"latency_avg,omitempty"`
	LatencyP95  *float64 `json:"latency_p95,omitempty"`
	Jitter      *float64 `json:"jitter,omitempty"`
	PacketLoss  *float64 `json:"packet_loss,omitempty"`
	DNSTime     *float64 `json:"dns_time,omitempty"`
	Bufferbloat *float64 `json:"bufferbloat,omitempty"`
}

// UnsyncedFetcher retrieves unsynced measurements from storage.
type UnsyncedFetcher interface {
	GetUnsynced(limit int) ([]StoredMeasurement, error)
	MarkSynced(ids []int64) error
}

// Pusher batches and pushes measurements to the dashboard server.
type Pusher struct {
	serverURL string
	apiKey    string
	probeID   string
	fetcher   UnsyncedFetcher
	client    *http.Client
	logger    *slog.Logger
	batchSize int
}

// NewPusher creates a new Pusher.
func NewPusher(serverURL, apiKey, probeID string, fetcher UnsyncedFetcher, logger *slog.Logger) *Pusher {
	return &Pusher{
		serverURL: serverURL,
		apiKey:    apiKey,
		probeID:   probeID,
		fetcher:   fetcher,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		logger:    logger,
		batchSize: 500,
	}
}

// Run starts the push loop, sending unsynced measurements every interval.
// It blocks until ctx is cancelled.
func (p *Pusher) Run(ctx context.Context, interval time.Duration) {
	p.logger.Info("pusher started", "server", p.serverURL, "interval", interval)

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			// Final push attempt before shutting down.
			p.pushAll()
			p.logger.Info("pusher stopped")
			return
		case <-ticker.C:
			p.pushAll()
		}
	}
}

// pushAll sends all unsynced measurements in batches.
func (p *Pusher) pushAll() {
	for {
		measurements, err := p.fetcher.GetUnsynced(p.batchSize)
		if err != nil {
			p.logger.Error("failed to fetch unsynced measurements", "error", err)
			return
		}

		if len(measurements) == 0 {
			return
		}

		if err := p.pushBatch(measurements); err != nil {
			p.logger.Warn("push failed, will retry next cycle",
				"batch_size", len(measurements),
				"error", err,
			)
			return
		}

		ids := make([]int64, len(measurements))
		for i, m := range measurements {
			ids[i] = m.ID
		}

		if err := p.fetcher.MarkSynced(ids); err != nil {
			p.logger.Error("failed to mark measurements as synced", "error", err)
			return
		}

		p.logger.Info("pushed measurements",
			"count", len(measurements),
		)

		// If we got a full batch, there may be more.
		if len(measurements) < p.batchSize {
			return
		}
	}
}

func (p *Pusher) pushBatch(measurements []StoredMeasurement) error {
	payload := IngestPayload{
		ProbeID:      p.probeID,
		Measurements: make([]IngestMeasurement, len(measurements)),
	}

	for i, m := range measurements {
		payload.Measurements[i] = IngestMeasurement{
			Timestamp:   m.Timestamp,
			Target:      m.Target,
			LatencyAvg:  m.LatencyAvg,
			LatencyP95:  m.LatencyP95,
			Jitter:      m.Jitter,
			PacketLoss:  m.PacketLoss,
			DNSTime:     m.DNSTime,
			Bufferbloat: m.Bufferbloat,
		}
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("marshaling payload: %w", err)
	}

	// Gzip compress the payload.
	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	if _, err := gz.Write(jsonData); err != nil {
		return fmt.Errorf("compressing payload: %w", err)
	}
	if err := gz.Close(); err != nil {
		return fmt.Errorf("closing gzip writer: %w", err)
	}

	url := fmt.Sprintf("%s/api/v1/ingest", p.serverURL)
	req, err := http.NewRequest("POST", url, &buf)
	if err != nil {
		return fmt.Errorf("creating request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("X-API-Key", p.apiKey)

	resp, err := p.client.Do(req)
	if err != nil {
		return fmt.Errorf("sending request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode == http.StatusTooManyRequests {
		return fmt.Errorf("rate limited by server")
	}

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusMultiStatus {
		return fmt.Errorf("server returned %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
