package probe

import (
	"bufio"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/miekg/dns"
)

type DNSProbe struct {
	resolvers   []string
	queryDomain string
}

func NewDNSProbe(resolvers []string, queryDomain string) *DNSProbe {
	return &DNSProbe{
		resolvers:   resolvers,
		queryDomain: queryDomain,
	}
}

func (p *DNSProbe) Type() ProbeType {
	return ProbeTypeDNS
}

func (p *DNSProbe) Run() ([]Measurement, error) {
	var wg sync.WaitGroup
	results := make(chan Measurement, len(p.resolvers))
	errors := make(chan error, len(p.resolvers))

	for _, resolver := range p.resolvers {
		wg.Add(1)
		go func(res string) {
			defer wg.Done()
			m, err := p.queryResolver(res)
			if err != nil {
				errors <- fmt.Errorf("resolver %s: %w", res, err)
				return
			}
			results <- m
		}(resolver)
	}

	wg.Wait()
	close(results)
	close(errors)

	var measurements []Measurement
	for m := range results {
		measurements = append(measurements, m)
	}

	var errs []error
	for err := range errors {
		errs = append(errs, err)
	}

	if len(measurements) == 0 && len(errs) > 0 {
		return nil, fmt.Errorf("all resolvers failed: %v", errs)
	}

	return measurements, nil
}

func (p *DNSProbe) queryResolver(resolver string) (Measurement, error) {
	var target string
	var serverAddr string

	if resolver == "system" {
		systemDNS, err := getSystemDNS()
		if err != nil {
			return Measurement{}, fmt.Errorf("failed to get system DNS: %w", err)
		}
		target = fmt.Sprintf("system-%s", systemDNS)
		serverAddr = fmt.Sprintf("%s:53", systemDNS)
	} else {
		target = resolver
		serverAddr = fmt.Sprintf("%s:53", resolver)
	}

	msg := new(dns.Msg)
	msg.SetQuestion(dns.Fqdn(p.queryDomain), dns.TypeA)
	msg.RecursionDesired = true

	client := &dns.Client{
		Net:     "udp",
		Timeout: 5 * time.Second,
	}

	start := time.Now()
	_, _, err := client.Exchange(msg, serverAddr)
	duration := time.Since(start)

	if err != nil {
		return Measurement{}, fmt.Errorf("DNS query failed: %w", err)
	}

	dnsTimeMs := float64(duration.Milliseconds())

	return Measurement{
		Timestamp: time.Now(),
		ProbeType: ProbeTypeDNS,
		Target:    target,
		DNSTime:   F64(dnsTimeMs),
	}, nil
}

func getSystemDNS() (string, error) {
	file, err := os.Open("/etc/resolv.conf")
	if err != nil {
		// /etc/resolv.conf unavailable (e.g. minimal container).
		// Fall back to Cloudflare public DNS for latency measurement.
		return "1.1.1.1", nil
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "nameserver") {
			fields := strings.Fields(line)
			if len(fields) >= 2 {
				return fields[1], nil
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return "", err
	}

	return "1.1.1.1", nil
}
