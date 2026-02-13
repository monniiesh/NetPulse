VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
BINARY := netpulse-probe
MODULE := github.com/netpulse/probe
LDFLAGS := -s -w -X main.version=$(VERSION)
DIST := dist

# Native build (current platform)
.PHONY: build
build:
	CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o $(BINARY) ./cmd/netpulse-probe

# All platforms
.PHONY: build-all
build-all: build-linux-amd64 build-linux-arm64 build-linux-armv7 build-darwin-amd64 build-darwin-arm64 build-windows-amd64

# Darwin builds (native CGO, no Docker needed)
.PHONY: build-darwin-amd64
build-darwin-amd64:
	@mkdir -p $(DIST)
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-darwin-amd64 ./cmd/netpulse-probe

.PHONY: build-darwin-arm64
build-darwin-arm64:
	@mkdir -p $(DIST)
	GOOS=darwin GOARCH=arm64 CGO_ENABLED=1 go build -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-darwin-arm64 ./cmd/netpulse-probe

# Linux builds via Docker (CGO cross-compilation)
.PHONY: build-linux-amd64
build-linux-amd64:
	@mkdir -p $(DIST)
	docker run --rm -v "$(CURDIR)":/src -w /src \
		-e CGO_ENABLED=1 -e GOOS=linux -e GOARCH=amd64 \
		golang:1.25-bookworm \
		go build -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-amd64 ./cmd/netpulse-probe

.PHONY: build-linux-arm64
build-linux-arm64:
	@mkdir -p $(DIST)
	docker run --rm -v "$(CURDIR)":/src -w /src \
		--platform linux/arm64 \
		-e CGO_ENABLED=1 -e GOOS=linux -e GOARCH=arm64 \
		golang:1.25-bookworm \
		go build -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-arm64 ./cmd/netpulse-probe

.PHONY: build-linux-armv7
build-linux-armv7:
	@mkdir -p $(DIST)
	docker run --rm -v "$(CURDIR)":/src -w /src \
		--platform linux/arm/v7 \
		-e CGO_ENABLED=1 -e GOOS=linux -e GOARCH=arm -e GOARM=7 \
		golang:1.25-bookworm \
		go build -ldflags "$(LDFLAGS)" -o $(DIST)/$(BINARY)-linux-armv7 ./cmd/netpulse-probe

# Windows build via Docker
.PHONY: build-windows-amd64
build-windows-amd64:
	@mkdir -p $(DIST)
	docker run --rm -v "$(CURDIR)":/src -w /src \
		-e CGO_ENABLED=1 -e GOOS=windows -e GOARCH=amd64 -e CC=x86_64-w64-mingw32-gcc \
		dockcross/windows-static-x64:latest \
		bash -c "go build -ldflags '$(LDFLAGS)' -o $(DIST)/$(BINARY)-windows-amd64.exe ./cmd/netpulse-probe"

# Checksums
.PHONY: checksums
checksums:
	cd $(DIST) && sha256sum * > checksums.txt

# Clean
.PHONY: clean
clean:
	rm -rf $(DIST)
	rm -f $(BINARY)

# Test
.PHONY: test
test:
	CGO_ENABLED=1 go test ./...
