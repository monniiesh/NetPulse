package probe

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"time"
)

type BufferbloatProbe struct {
	pingTarget  string
	downloadURL string
	pingCount   int
}

func NewBufferbloatProbe(pingTarget string, downloadURL string) *BufferbloatProbe {
	if pingTarget == "" {
		pingTarget = "1.1.1.1"
	}
	if downloadURL == "" {
		downloadURL = "https://speed.cloudflare.com/__down?bytes=5000000"
	}
	return &BufferbloatProbe{
		pingTarget:  pingTarget,
		downloadURL: downloadURL,
		pingCount:   10,
	}
}

func (b *BufferbloatProbe) Type() ProbeType {
	return ProbeTypeBufferbloat
}

func (b *BufferbloatProbe) Run() ([]Measurement, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	idleLatency, err := b.measureLatency(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to measure idle latency: %w", err)
	}

	loadedLatency, err := b.measureLatencyUnderLoad(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to measure loaded latency: %w", err)
	}

	bufferbloatMs := loadedLatency - idleLatency

	measurement := Measurement{
		Timestamp:   time.Now(),
		ProbeType:   ProbeTypeBufferbloat,
		Target:      b.pingTarget,
		LatencyAvg:  F64(idleLatency),
		Bufferbloat: F64(bufferbloatMs),
	}

	return []Measurement{measurement}, nil
}

func (b *BufferbloatProbe) measureLatency(ctx context.Context) (float64, error) {
	stats := pingWithFallback(b.pingTarget, b.pingCount, 10*time.Second)
	if stats == nil || stats.PacketsRecv == 0 {
		return 0, fmt.Errorf("no successful pings")
	}
	return stats.AvgRtt.Seconds() * 1000, nil
}

func (b *BufferbloatProbe) measureLatencyUnderLoad(ctx context.Context) (float64, error) {
	downloadCtx, downloadCancel := context.WithCancel(ctx)
	defer downloadCancel()

	errChan := make(chan error, 1)
	go func() {
		errChan <- b.runDownload(downloadCtx)
	}()

	time.Sleep(500 * time.Millisecond)

	pingCtx, pingCancel := context.WithTimeout(ctx, 10*time.Second)
	defer pingCancel()

	latency, err := b.measureLatency(pingCtx)
	if err != nil {
		return 0, fmt.Errorf("loaded ping failed: %w", err)
	}

	downloadCancel()

	select {
	case downloadErr := <-errChan:
		if downloadErr != nil && downloadErr != context.Canceled {
			return latency, nil
		}
	case <-time.After(1 * time.Second):
	}

	return latency, nil
}

func (b *BufferbloatProbe) runDownload(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "GET", b.downloadURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	client := &http.Client{
		Timeout: 25 * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("download request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed with status: %d", resp.StatusCode)
	}

	_, err = io.Copy(io.Discard, resp.Body)
	if err != nil && err != context.Canceled {
		return fmt.Errorf("failed to consume download: %w", err)
	}

	return nil
}
