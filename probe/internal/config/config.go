package config

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"gopkg.in/yaml.v3"
)

// Config holds the probe agent configuration.
type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Schedule ScheduleConfig `yaml:"schedule"`
	Targets  TargetsConfig  `yaml:"targets"`
	Probe    ProbeConfig    `yaml:"probe"`
	Storage  StorageConfig  `yaml:"storage"`
}

type ServerConfig struct {
	URL     string `yaml:"url"`
	APIKey  string `yaml:"api_key"`
	ProbeID string `yaml:"probe_id"`
}

type ScheduleConfig struct {
	PingInterval       time.Duration `yaml:"ping_interval"`
	DNSInterval        time.Duration `yaml:"dns_interval"`
	BufferbloatInterval time.Duration `yaml:"bufferbloat_interval"`
}

type TargetsConfig struct {
	Ping                []string `yaml:"ping"`
	DNS                 []string `yaml:"dns"`
	BufferbloatDownloadURL string `yaml:"bufferbloat_download_url"`
}

type ProbeConfig struct {
	Name     string `yaml:"name"`
	Location string `yaml:"location"`
}

type StorageConfig struct {
	LocalRetentionDays int    `yaml:"local_retention_days"`
	DBPath             string `yaml:"db_path"`
}

// DefaultConfig returns a configuration with sensible defaults.
func DefaultConfig() *Config {
	homeDir, _ := os.UserHomeDir()
	return &Config{
		Server: ServerConfig{
			URL:    "http://localhost:3000",
			APIKey: "",
		},
		Schedule: ScheduleConfig{
			PingInterval:        30 * time.Second,
			DNSInterval:         60 * time.Second,
			BufferbloatInterval: 5 * time.Minute,
		},
		Targets: TargetsConfig{
			Ping: []string{"1.1.1.1", "8.8.8.8", "9.9.9.9"},
			DNS:  []string{"1.1.1.1", "8.8.8.8", "system"},
			BufferbloatDownloadURL: "https://speed.cloudflare.com/__down?bytes=5000000",
		},
		Probe: ProbeConfig{
			Name:     "default",
			Location: "",
		},
		Storage: StorageConfig{
			LocalRetentionDays: 30,
			DBPath:             filepath.Join(homeDir, ".netpulse", "measurements.db"),
		},
	}
}

// DefaultConfigPath returns the default config file path.
func DefaultConfigPath() string {
	homeDir, _ := os.UserHomeDir()
	return filepath.Join(homeDir, ".netpulse", "config.yaml")
}

// Load reads and parses a YAML config file.
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("reading config file: %w", err)
	}

	cfg := DefaultConfig()
	if err := yaml.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("parsing config file: %w", err)
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("invalid config: %w", err)
	}

	return cfg, nil
}

// Validate checks the configuration for obvious problems.
func (c *Config) Validate() error {
	if len(c.Targets.Ping) == 0 {
		return fmt.Errorf("at least one ping target is required")
	}
	if len(c.Targets.DNS) == 0 {
		return fmt.Errorf("at least one DNS target is required")
	}
	if c.Schedule.PingInterval < 5*time.Second {
		return fmt.Errorf("ping interval must be at least 5s")
	}
	if c.Schedule.DNSInterval < 10*time.Second {
		return fmt.Errorf("DNS interval must be at least 10s")
	}
	if c.Schedule.BufferbloatInterval < 60*time.Second {
		return fmt.Errorf("bufferbloat interval must be at least 60s")
	}
	if c.Targets.BufferbloatDownloadURL == "" {
		return fmt.Errorf("bufferbloat download URL is required")
	}
	return nil
}

// WriteTemplate writes a default config file to the given path.
func WriteTemplate(path string) error {
	cfg := DefaultConfig()
	cfg.Server.APIKey = "np_probe_YOUR_API_KEY_HERE"
	cfg.Server.ProbeID = "YOUR_PROBE_UUID_HERE"
	cfg.Probe.Name = "my-probe"
	cfg.Probe.Location = "Home Office"

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("marshaling default config: %w", err)
	}

	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	header := "# NetPulse Probe Configuration\n# See https://github.com/netpulse/netpulse for documentation\n\n"
	return os.WriteFile(path, []byte(header+string(data)), 0644)
}
