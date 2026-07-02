#!/usr/bin/env zsh
set -euo pipefail

refresh_seconds="${REGISTRY_REFRESH_SECONDS:-300}"
if [[ "$refresh_seconds" != <-> ]]; then
  print -u2 "REGISTRY_REFRESH_SECONDS must be a positive integer, got: $refresh_seconds"
  exit 2
fi

if (( refresh_seconds < 30 )); then
  print -u2 "REGISTRY_REFRESH_SECONDS must be at least 30 seconds to avoid excessive local telemetry writes."
  exit 2
fi

print "Starting Frontier Cockpit Local model and price registry sidecar."
print "OTLP metrics endpoint: ${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-unset}"
print "Refresh interval: ${refresh_seconds}s"

while true; do
  cycle_status=0

  if ./seed-model-multipliers.sh --quiet; then
    print "$(date -u +%Y-%m-%dT%H:%M:%SZ) seeded GitHub Copilot premium-request multipliers."
  else
    print -u2 "$(date -u +%Y-%m-%dT%H:%M:%SZ) failed to seed GitHub Copilot premium-request multipliers."
    cycle_status=1
  fi

  if ./seed-model-prices.sh --quiet; then
    print "$(date -u +%Y-%m-%dT%H:%M:%SZ) seeded local planning prices."
  else
    print -u2 "$(date -u +%Y-%m-%dT%H:%M:%SZ) failed to seed local planning prices."
    cycle_status=1
  fi

  if (( cycle_status == 0 )); then
    date +%s > /tmp/frontier-registry.last-ok
  else
    print -u2 "Registry cycle failed. The sidecar will retry after ${refresh_seconds}s."
  fi

  sleep "$refresh_seconds"
done
