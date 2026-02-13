package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/netpulse/probe/internal/probe"
)

type Store struct {
	db *sql.DB
}

type StoredMeasurement struct {
	ID     int64
	Synced bool
	probe.Measurement
}

func NewStore(dbPath string) (*Store, error) {
	// Ensure parent directory exists.
	if dir := filepath.Dir(dbPath); dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create database directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return nil, fmt.Errorf("enable WAL mode: %w", err)
	}

	if err := runMigrations(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("run migrations: %w", err)
	}

	return &Store{db: db}, nil
}

func (s *Store) SaveMeasurement(m probe.Measurement) error {
	query := `INSERT INTO measurements (
		timestamp, probe_type, target, latency_min, latency_avg, latency_max,
		latency_p95, jitter, packet_loss, dns_time, bufferbloat
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := s.db.Exec(
		query,
		m.Timestamp.UTC().Format(time.RFC3339Nano),
		string(m.ProbeType),
		m.Target,
		m.LatencyMin,
		m.LatencyAvg,
		m.LatencyMax,
		m.LatencyP95,
		m.Jitter,
		m.PacketLoss,
		m.DNSTime,
		m.Bufferbloat,
	)
	if err != nil {
		return fmt.Errorf("insert measurement: %w", err)
	}

	return nil
}

func (s *Store) SaveMeasurements(ms []probe.Measurement) error {
	if len(ms) == 0 {
		return nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`INSERT INTO measurements (
		timestamp, probe_type, target, latency_min, latency_avg, latency_max,
		latency_p95, jitter, packet_loss, dns_time, bufferbloat
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, m := range ms {
		_, err := stmt.Exec(
			m.Timestamp.UTC().Format(time.RFC3339Nano),
			string(m.ProbeType),
			m.Target,
			m.LatencyMin,
			m.LatencyAvg,
			m.LatencyMax,
			m.LatencyP95,
			m.Jitter,
			m.PacketLoss,
			m.DNSTime,
			m.Bufferbloat,
		)
		if err != nil {
			return fmt.Errorf("insert measurement: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

func (s *Store) GetUnsynced(limit int) ([]StoredMeasurement, error) {
	query := `SELECT id, timestamp, probe_type, target, latency_min, latency_avg,
		latency_max, latency_p95, jitter, packet_loss, dns_time, bufferbloat, synced
		FROM measurements
		WHERE synced = 0
		ORDER BY timestamp ASC
		LIMIT ?`

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, fmt.Errorf("query unsynced measurements: %w", err)
	}
	defer rows.Close()

	var results []StoredMeasurement
	for rows.Next() {
		var sm StoredMeasurement
		var timestampStr string
		var probeTypeStr string
		var syncedInt int

		err := rows.Scan(
			&sm.ID,
			&timestampStr,
			&probeTypeStr,
			&sm.Target,
			&sm.LatencyMin,
			&sm.LatencyAvg,
			&sm.LatencyMax,
			&sm.LatencyP95,
			&sm.Jitter,
			&sm.PacketLoss,
			&sm.DNSTime,
			&sm.Bufferbloat,
			&syncedInt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan row: %w", err)
		}

		sm.Timestamp, err = time.Parse(time.RFC3339Nano, timestampStr)
		if err != nil {
			return nil, fmt.Errorf("parse timestamp: %w", err)
		}

		sm.ProbeType = probe.ProbeType(probeTypeStr)
		sm.Synced = syncedInt != 0

		results = append(results, sm)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows iteration: %w", err)
	}

	return results, nil
}

func (s *Store) MarkSynced(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}

	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE measurements SET synced = 1 WHERE id = ?")
	if err != nil {
		return fmt.Errorf("prepare statement: %w", err)
	}
	defer stmt.Close()

	for _, id := range ids {
		if _, err := stmt.Exec(id); err != nil {
			return fmt.Errorf("mark measurement %d as synced: %w", id, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit transaction: %w", err)
	}

	return nil
}

func (s *Store) Cleanup(retentionDays int) error {
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	cutoffStr := cutoff.Format(time.RFC3339Nano)

	query := "DELETE FROM measurements WHERE synced = 1 AND timestamp < ?"
	result, err := s.db.Exec(query, cutoffStr)
	if err != nil {
		return fmt.Errorf("delete old measurements: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("get rows affected: %w", err)
	}

	if rowsAffected > 0 {
		if _, err := s.db.Exec("VACUUM"); err != nil {
			return fmt.Errorf("vacuum database: %w", err)
		}
	}

	return nil
}

func (s *Store) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
