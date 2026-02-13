import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  real,
  integer,
  jsonb,
  doublePrecision,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export const probes = pgTable('probes', {
  id: uuid('id').primaryKey().defaultRandom(),
  apiKey: text('api_key').notNull().unique(),
  apiKeyPrefix: text('api_key_prefix').notNull(),
  name: text('name').notNull(),
  location: text('location'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  lastSeen: timestamp('last_seen', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const alertConfigs = pgTable('alert_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  probeId: uuid('probe_id').references(() => probes.id),
  metric: text('metric').notNull(),
  threshold: real('threshold').notNull(),
  comparison: text('comparison').notNull(),
  durationMin: integer('duration_min').notNull().default(5),
  channel: text('channel').notNull(),
  channelConfig: jsonb('channel_config').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const anomalies = pgTable('anomalies', {
  id: uuid('id').primaryKey().defaultRandom(),
  probeId: uuid('probe_id')
    .notNull()
    .references(() => probes.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  metric: text('metric').notNull(),
  expectedValue: real('expected_value').notNull(),
  actualValue: real('actual_value').notNull(),
  severity: text('severity').notNull(),
  dayOfWeek: integer('day_of_week'),
  hourOfDay: integer('hour_of_day'),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const reports = pgTable('reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  probeId: uuid('probe_id').references(() => probes.id),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  pdfPath: text('pdf_path'),
  status: text('status').notNull().default('pending'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const measurements = pgTable(
  'measurements',
  {
    time: timestamp('time', { withTimezone: true }).notNull(),
    probeId: uuid('probe_id').notNull(),
    target: text('target').notNull(),
    latencyAvg: doublePrecision('latency_avg'),
    latencyP95: doublePrecision('latency_p95'),
    jitter: doublePrecision('jitter'),
    packetLoss: doublePrecision('packet_loss'),
    dnsTime: doublePrecision('dns_time'),
    bufferbloat: doublePrecision('bufferbloat'),
  },
  (table) => ({
    probeTimeIdx: index('measurements_probe_time_idx').on(
      table.probeId,
      table.time.desc()
    ),
    probeTimeTargetUniq: uniqueIndex('measurements_probe_time_target_uniq')
      .on(table.probeId, table.time, table.target),
  })
);

export type Probe = InferSelectModel<typeof probes>;
export type InsertProbe = InferInsertModel<typeof probes>;

export type User = InferSelectModel<typeof users>;
export type InsertUser = InferInsertModel<typeof users>;

export type AlertConfig = InferSelectModel<typeof alertConfigs>;
export type InsertAlertConfig = InferInsertModel<typeof alertConfigs>;

export type Anomaly = InferSelectModel<typeof anomalies>;
export type InsertAnomaly = InferInsertModel<typeof anomalies>;

export type Report = InferSelectModel<typeof reports>;
export type InsertReport = InferInsertModel<typeof reports>;

export type Measurement = InferSelectModel<typeof measurements>;
export type InsertMeasurement = InferInsertModel<typeof measurements>;
