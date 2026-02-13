package storage

import (
	"database/sql"
	"fmt"
)

const currentSchemaVersion = 1

var migrations = []string{
	`CREATE TABLE IF NOT EXISTS schema_version (
		version INTEGER PRIMARY KEY,
		applied_at TEXT NOT NULL DEFAULT (datetime('now'))
	);`,
	`CREATE TABLE IF NOT EXISTS measurements (
		id          INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp   TEXT NOT NULL,
		probe_type  TEXT NOT NULL,
		target      TEXT NOT NULL,
		latency_min REAL,
		latency_avg REAL,
		latency_max REAL,
		latency_p95 REAL,
		jitter      REAL,
		packet_loss REAL,
		dns_time    REAL,
		bufferbloat REAL,
		synced      INTEGER NOT NULL DEFAULT 0,
		created_at  TEXT NOT NULL DEFAULT (datetime('now'))
	);`,
	`CREATE INDEX IF NOT EXISTS idx_measurements_synced ON measurements(synced, timestamp);`,
	`CREATE INDEX IF NOT EXISTS idx_measurements_timestamp ON measurements(timestamp);`,
}

func runMigrations(db *sql.DB) error {
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin migration transaction: %w", err)
	}
	defer tx.Rollback()

	for _, migration := range migrations {
		if _, err := tx.Exec(migration); err != nil {
			return fmt.Errorf("execute migration: %w", err)
		}
	}

	var currentVersion int
	err = tx.QueryRow("SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&currentVersion)
	if err != nil {
		return fmt.Errorf("query schema version: %w", err)
	}

	if currentVersion < currentSchemaVersion {
		_, err = tx.Exec("INSERT INTO schema_version (version) VALUES (?)", currentSchemaVersion)
		if err != nil {
			return fmt.Errorf("update schema version: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit migration transaction: %w", err)
	}

	return nil
}
