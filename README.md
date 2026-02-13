# NetPulse

Continuous ISP quality monitoring with anomaly detection and accountability reports.

NetPulse monitors your internet connection 24/7 — measuring latency, jitter, packet loss, DNS resolution, and bufferbloat — then grades your ISP and generates PDF evidence reports.

## Why NetPulse?

Existing tools only tell you part of the story. SmokePing is latency-only. Speedtest Tracker measures throughput. No tool measures **bufferbloat** continuously. No tool generates **ISP accountability reports** with charts and evidence.

NetPulse gives you:

- **A-F quality grade** — weighted scoring across 5 metrics, not just speed
- **24/7 monitoring** — lightweight probe runs on a Pi, Mac, or any Linux box
- **Anomaly detection** — spots recurring patterns like "latency degrades every weeknight 9PM-midnight"
- **PDF report cards** — graphs and data you can send to your ISP
- **Smart alerts** — webhook, Discord, or email when quality drops

## Architecture

```
Probe (Go binary)                    Dashboard (Next.js)
┌──────────────────┐                ┌──────────────────────────┐
│  ICMP Ping       │   HTTPS POST   │  Ingestion API           │
│  DNS Resolution  │   batch/60s    │  Quality Scoring         │
│  Bufferbloat     │ ──────────────>│  Anomaly Detection       │
│                  │                │  Alert Evaluation        │
│  SQLite buffer   │                │  PDF Report Generation   │
│  (offline-safe)  │                │  Real-time SSE           │
└──────────────────┘                │                          │
                                    │  PostgreSQL + TimescaleDB│
                                    └──────────────────────────┘
```

The probe pushes measurements to the dashboard over HTTP. If the dashboard goes down, the probe buffers data locally in SQLite and backfills when connectivity returns.

## Quick Start

### Docker Compose (recommended)

```bash
git clone https://github.com/YOUR_USERNAME/netpulse.git
cd netpulse
cp .env.example .env
```

Edit `.env` with a real secret:

```env
DB_PASSWORD=pick-a-strong-password
AUTH_SECRET=run-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000
```

Start everything:

```bash
docker compose up -d
```

Open [http://localhost:3000](http://localhost:3000) and:

1. Create your admin account on the setup page
2. Go to **Settings > Probes** and register a probe — copy the API key
3. Update `.env` with the probe API key and probe ID, then restart:

```bash
docker compose restart probe
```

The probe starts collecting measurements immediately. You'll see data on the dashboard within a minute.

### Manual Setup

#### Prerequisites

- Node.js 20+
- PostgreSQL 16 with [TimescaleDB](https://docs.timescale.com/install/)
- Go 1.25+ (only if building the probe from source)

#### Dashboard

```bash
cd dashboard
npm install

# Create .env with your database URL
cat > .env <<EOF
DATABASE_URL=postgresql://user:password@localhost:5432/netpulse
AUTH_SECRET=$(openssl rand -base64 32)
NEXTAUTH_URL=http://localhost:3000
EOF

# Run migrations and start
npm run db:migrate
npm run build
npm start
```

The dashboard runs at [http://localhost:3000](http://localhost:3000).

#### Probe

Download a prebuilt binary from [Releases](https://github.com/YOUR_USERNAME/netpulse/releases), or build from source:

```bash
cd probe
go build -o netpulse-probe ./cmd/netpulse-probe
```

Initialize and configure:

```bash
./netpulse-probe init
# Edit ~/.netpulse/config.yaml — set your dashboard URL, API key, and probe ID
```

Run:

```bash
# Needs root or CAP_NET_RAW for ICMP ping
sudo ./netpulse-probe run
```

### Running as a System Service

#### Linux (systemd)

```bash
cd probe/dist
sudo ./install.sh
sudo vim /etc/netpulse/config.yaml   # set dashboard URL + API key
sudo systemctl start netpulse-probe
sudo systemctl status netpulse-probe
```

#### macOS (launchd)

```bash
sudo cp netpulse-probe /usr/local/bin/
netpulse-probe init                   # creates ~/.netpulse/config.yaml
# Edit config, then:
cp probe/dist/com.netpulse.probe.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.netpulse.probe.plist
```

## What Gets Measured

| Metric | How | Default Interval |
|--------|-----|------------------|
| Latency (avg, min, max, p95) | ICMP ping to 1.1.1.1, 8.8.8.8, 9.9.9.9 | 30s |
| Jitter | RFC 3550 interarrival calculation | 30s |
| Packet Loss % | ICMP ping statistics | 30s |
| DNS Resolution Time | Query timing against system + public resolvers | 60s |
| Bufferbloat | Latency delta: idle vs under 5MB download load | 5min |

## Quality Score

Starts at 100, subtracts weighted penalties:

| Metric | Max Penalty | What Triggers It |
|--------|-------------|------------------|
| Latency | 30 pts | >50ms avg |
| Packet Loss | 30 pts | >0.1% loss |
| Jitter | 20 pts | >10ms variation |
| DNS | 10 pts | >100ms resolution |
| Bufferbloat | 10 pts | >50ms added latency under load |

**Grades:** A (90-100) · B (80-89) · C (70-79) · D (60-69) · F (<60)

Profiles (gaming, video calls, streaming) shift the weights to match different use cases.

## Data Retention

TimescaleDB handles rollups automatically via continuous aggregates:

| Resolution | Kept For |
|------------|----------|
| Raw measurements | 7 days |
| 5-minute averages | 90 days |
| 1-hour averages | 2 years |
| 1-day averages | Forever |

