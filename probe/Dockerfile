# Build stage
FROM golang:1.25-bookworm AS builder

WORKDIR /src

# Cache dependencies
COPY go.mod go.sum ./
RUN go mod download

# Build with CGO for SQLite
COPY . .
RUN CGO_ENABLED=1 go build -ldflags "-s -w" -o /netpulse-probe ./cmd/netpulse-probe

# Runtime stage
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --system --no-create-home --shell /usr/sbin/nologin netpulse \
    && mkdir -p /var/lib/netpulse \
    && chown netpulse:netpulse /var/lib/netpulse

COPY --from=builder /netpulse-probe /usr/local/bin/netpulse-probe

USER netpulse
WORKDIR /var/lib/netpulse

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD ["/usr/local/bin/netpulse-probe", "version"]

ENTRYPOINT ["/usr/local/bin/netpulse-probe"]
CMD ["run"]
