-- TimescaleDB Setup Migration
-- Run this AFTER Drizzle creates the base measurements table

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Convert measurements to hypertable
SELECT create_hypertable('measurements', 'time', if_not_exists => TRUE);

-- Create index for common query pattern (probe + time range queries)
CREATE INDEX IF NOT EXISTS idx_measurements_probe_time ON measurements (probe_id, time DESC);

-- Create 5-minute continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_5min
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    probe_id,
    target,
    AVG(latency_avg) AS latency_avg,
    MAX(latency_p95) AS latency_p95,
    AVG(jitter) AS jitter_avg,
    MAX(jitter) AS jitter_max,
    AVG(packet_loss) AS packet_loss_avg,
    MAX(packet_loss) AS packet_loss_max,
    AVG(dns_time) AS dns_time_avg,
    AVG(bufferbloat) AS bufferbloat_avg,
    COUNT(*) AS sample_count
FROM measurements
GROUP BY bucket, probe_id, target;

-- Create 1-hour continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_1hr
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    probe_id,
    target,
    AVG(latency_avg) AS latency_avg,
    MAX(latency_p95) AS latency_p95,
    AVG(jitter) AS jitter_avg,
    MAX(jitter) AS jitter_max,
    AVG(packet_loss) AS packet_loss_avg,
    MAX(packet_loss) AS packet_loss_max,
    AVG(dns_time) AS dns_time_avg,
    AVG(bufferbloat) AS bufferbloat_avg,
    COUNT(*) AS sample_count
FROM measurements
GROUP BY bucket, probe_id, target;

-- Create 1-day continuous aggregate
CREATE MATERIALIZED VIEW IF NOT EXISTS measurements_1day
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 day', time) AS bucket,
    probe_id,
    target,
    AVG(latency_avg) AS latency_avg,
    MAX(latency_p95) AS latency_p95,
    AVG(jitter) AS jitter_avg,
    MAX(jitter) AS jitter_max,
    AVG(packet_loss) AS packet_loss_avg,
    MAX(packet_loss) AS packet_loss_max,
    AVG(dns_time) AS dns_time_avg,
    AVG(bufferbloat) AS bufferbloat_avg,
    COUNT(*) AS sample_count
FROM measurements
GROUP BY bucket, probe_id, target;

-- Add retention policies
SELECT add_retention_policy('measurements', INTERVAL '7 days', if_not_exists => TRUE);
SELECT add_retention_policy('measurements_5min', INTERVAL '90 days', if_not_exists => TRUE);
SELECT add_retention_policy('measurements_1hr', INTERVAL '2 years', if_not_exists => TRUE);
-- measurements_1day: keep forever, no retention policy

-- Add continuous aggregate refresh policies
SELECT add_continuous_aggregate_policy('measurements_5min',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('measurements_1hr',
    start_offset => INTERVAL '3 hours',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE);

SELECT add_continuous_aggregate_policy('measurements_1day',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day',
    if_not_exists => TRUE);
