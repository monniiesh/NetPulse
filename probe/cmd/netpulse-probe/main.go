package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/netpulse/probe/internal/config"
	"github.com/netpulse/probe/internal/health"
	"github.com/netpulse/probe/internal/probe"
	"github.com/netpulse/probe/internal/storage"
	pushsync "github.com/netpulse/probe/internal/sync"
	"github.com/spf13/cobra"
)

var version = "dev"

func main() {
	rootCmd := &cobra.Command{
		Use:   "netpulse-probe",
		Short: "NetPulse probe agent — continuous ISP quality monitoring",
	}

	var configPath string
	rootCmd.PersistentFlags().StringVarP(&configPath, "config", "c", config.DefaultConfigPath(), "path to config file")

	rootCmd.AddCommand(
		initCmd(),
		runCmd(&configPath),
		versionCmd(),
	)

	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func initCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "init",
		Short: "Generate a template configuration file",
		RunE: func(cmd *cobra.Command, args []string) error {
			path := config.DefaultConfigPath()
			if _, err := os.Stat(path); err == nil {
				return fmt.Errorf("config file already exists at %s", path)
			}

			if err := config.WriteTemplate(path); err != nil {
				return fmt.Errorf("writing config template: %w", err)
			}

			fmt.Printf("Config template written to %s\n", path)
			fmt.Println("Edit the file and set your server URL and API key, then run: netpulse-probe run")
			return nil
		},
	}
}

func runCmd(configPath *string) *cobra.Command {
	var healthAddr string

	cmd := &cobra.Command{
		Use:   "run",
		Short: "Start the probe agent",
		RunE: func(cmd *cobra.Command, args []string) error {
			return runProbe(*configPath, healthAddr)
		},
	}

	cmd.Flags().StringVar(&healthAddr, "health-addr", ":9100", "address for the health check HTTP server")
	return cmd
}

func versionCmd() *cobra.Command {
	return &cobra.Command{
		Use:   "version",
		Short: "Print the probe version",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("netpulse-probe %s (%s/%s)\n", version, runtime.GOOS, runtime.GOARCH)
		},
	}
}

// storeAdapter bridges storage.Store to sync.UnsyncedFetcher interface.
type storeAdapter struct {
	store *storage.Store
}

func (a *storeAdapter) GetUnsynced(limit int) ([]pushsync.StoredMeasurement, error) {
	rows, err := a.store.GetUnsynced(limit)
	if err != nil {
		return nil, err
	}

	result := make([]pushsync.StoredMeasurement, len(rows))
	for i, r := range rows {
		result[i] = pushsync.StoredMeasurement{
			ID:         r.ID,
			Timestamp:  r.Timestamp.UTC().Format("2006-01-02T15:04:05Z07:00"),
			Target:     r.Target,
			LatencyAvg: r.LatencyAvg,
			LatencyP95: r.LatencyP95,
			Jitter:     r.Jitter,
			PacketLoss: r.PacketLoss,
			DNSTime:    r.DNSTime,
			Bufferbloat: r.Bufferbloat,
		}
	}
	return result, nil
}

func (a *storeAdapter) MarkSynced(ids []int64) error {
	return a.store.MarkSynced(ids)
}

func runProbe(configPath, healthAddr string) error {
	// Set up structured logging.
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))

	// Load configuration.
	cfg, err := config.Load(configPath)
	if err != nil {
		return fmt.Errorf("loading config: %w", err)
	}

	logger.Info("configuration loaded",
		"config_path", configPath,
		"probe_name", cfg.Probe.Name,
		"ping_targets", cfg.Targets.Ping,
		"dns_resolvers", cfg.Targets.DNS,
	)

	// Open local SQLite storage.
	store, err := storage.NewStore(cfg.Storage.DBPath)
	if err != nil {
		return fmt.Errorf("opening storage: %w", err)
	}
	defer store.Close()

	logger.Info("storage initialized", "db_path", cfg.Storage.DBPath)

	// Set up health server.
	healthServer := health.NewServer(logger)

	// Create measurement handler that saves to SQLite and updates health.
	handler := func(measurements []probe.Measurement) {
		if err := store.SaveMeasurements(measurements); err != nil {
			logger.Error("failed to save measurements", "error", err)
			return
		}

		for _, m := range measurements {
			healthServer.RecordMeasurement(string(m.ProbeType))
		}

		logger.Debug("measurements saved", "count", len(measurements))
	}

	// Create scheduler and register probes.
	scheduler := probe.NewScheduler(handler, logger)

	// Ping probe.
	pingProbe := probe.NewPingProbe(cfg.Targets.Ping, 10)
	scheduler.Add(pingProbe, cfg.Schedule.PingInterval)

	// DNS probe.
	dnsProbe := probe.NewDNSProbe(cfg.Targets.DNS, "example.com")
	scheduler.Add(dnsProbe, cfg.Schedule.DNSInterval)

	// Bufferbloat probe.
	bbProbe := probe.NewBufferbloatProbe(cfg.Targets.Ping[0], cfg.Targets.BufferbloatDownloadURL)
	scheduler.Add(bbProbe, cfg.Schedule.BufferbloatInterval)

	// Create context that cancels on SIGINT/SIGTERM.
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		logger.Info("received signal, shutting down", "signal", sig)
		cancel()
	}()

	// Start health server.
	go func() {
		if err := healthServer.Run(ctx, healthAddr); err != nil {
			logger.Error("health server error", "error", err)
		}
	}()

	// Start pusher (syncs to dashboard server).
	if cfg.Server.APIKey != "" && cfg.Server.URL != "" {
		pusher := pushsync.NewPusher(
			cfg.Server.URL,
			cfg.Server.APIKey,
			cfg.Server.ProbeID,
			&storeAdapter{store: store},
			logger,
		)
		go pusher.Run(ctx, 60*time.Second)
		logger.Info("pusher started", "server", cfg.Server.URL)
	} else {
		logger.Warn("no server URL or API key configured, running in local-only mode")
	}

	// Start daily cleanup job.
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := store.Cleanup(cfg.Storage.LocalRetentionDays); err != nil {
					logger.Error("cleanup failed", "error", err)
				} else {
					logger.Info("cleanup completed", "retention_days", cfg.Storage.LocalRetentionDays)
				}
			}
		}
	}()

	logger.Info("netpulse probe starting",
		"version", version,
		"probe_name", cfg.Probe.Name,
	)

	// Run scheduler (blocks until ctx cancelled).
	scheduler.Run(ctx)

	return nil
}
