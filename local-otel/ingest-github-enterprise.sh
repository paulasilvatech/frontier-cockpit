#!/usr/bin/env zsh
set -euo pipefail

# Ingest GitHub Enterprise data into the local OTel pipeline.
# Currently collects enterprise audit log when permitted and attempts Copilot metrics.
# If Copilot metrics are not available, emits an availability/status metric and log.
# Data flows local -> Collector -> local stores and, in hybrid mode, Azure.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

enterprise="${GITHUB_ENTERPRISE_SLUG:-your-enterprise-slug}"
gh_bin="${GH_BIN:-/opt/homebrew/bin/gh}"
logs_endpoint="${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-http://localhost:4318/v1/logs}"
metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
out_dir="$HOME/frontier-cockpit/local-otel/github-enterprise"
mkdir -p "$out_dir"

audit_file="$out_dir/${enterprise}-audit-log.json"
metrics_file="$out_dir/${enterprise}-copilot-metrics.json"
status_file="$out_dir/${enterprise}-status.json"

if ! command -v "$gh_bin" >/dev/null 2>&1; then
  print -u2 "GitHub CLI not found at $gh_bin"
  exit 1
fi

auth_status="$($gh_bin auth status -h github.com 2>&1 || true)"
if [[ "$auth_status" != *"Logged in"* ]]; then
    print -u2 "GitHub CLI is not authenticated for github.com. Run gh auth login or gh auth status -h github.com."
    print -u2 "$auth_status"
    exit 1
fi

for required_scope in admin:enterprise read:enterprise manage_billing:copilot read:org; do
    if [[ "$auth_status" != *"$required_scope"* ]]; then
        print -u2 "WARN  GitHub CLI auth output does not show scope $required_scope. Some enterprise signals may be unavailable."
    fi
done

now_iso="$(date -u '+%Y-%m-%dT%H:%M:%SZ')"

# Audit log is enterprise-admin protected. Keep a bounded page for local control tower ingestion.
audit_status="unavailable"
if "$gh_bin" api \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  "/enterprises/${enterprise}/audit-log?per_page=100" > "$audit_file" 2> "$out_dir/audit.err"; then
  audit_status="available"
else
  audit_status="failed"
fi

metrics_status="unavailable"
if "$gh_bin" api \
  -H 'Accept: application/vnd.github+json' \
  -H 'X-GitHub-Api-Version: 2026-03-10' \
  "/enterprises/${enterprise}/copilot/metrics?per_page=100" > "$metrics_file" 2> "$out_dir/copilot-metrics.err"; then
  metrics_status="available"
else
  metrics_status="failed"
fi

python3 - "$enterprise" "$now_iso" "$audit_status" "$metrics_status" "$audit_file" "$metrics_file" "$logs_endpoint" "$metrics_endpoint" <<'PY'
import json
import pathlib
import sys
import time
import urllib.request

enterprise, now_iso, audit_status, metrics_status, audit_file, metrics_file, logs_endpoint, metrics_endpoint = sys.argv[1:]
now_ns = str(time.time_ns())

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value) if value not in (None, "") else "unknown"}}

def int_attr(key, value):
    try:
        return {"key": key, "value": {"intValue": int(value)}}
    except Exception:
        return {"key": key, "value": {"intValue": 0}}

def post(url, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()

def load_json(path, fallback):
    try:
        return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    except Exception:
        return fallback

audit_data = load_json(audit_file, []) if audit_status == "available" else []
metrics_data = load_json(metrics_file, []) if metrics_status == "available" else []
if not isinstance(audit_data, list):
    audit_data = []
if not isinstance(metrics_data, list):
    metrics_data = []

log_records = []
base_attrs = [attr("enterprise", enterprise), attr("source", "github-api"), attr("ingested_at", now_iso)]

status_body = {
    "enterprise": enterprise,
    "audit_log_status": audit_status,
    "audit_log_records": len(audit_data),
    "copilot_metrics_status": metrics_status,
    "copilot_metric_days": len(metrics_data),
    "ingested_at": now_iso,
}
log_records.append({
    "timeUnixNano": now_ns,
    "body": {"stringValue": json.dumps(status_body, separators=(",", ":"), sort_keys=True)},
    "attributes": base_attrs + [attr("record_type", "ingestion_status")],
})

for event in audit_data[:100]:
    selected = {k: event.get(k) for k in ["@timestamp", "action", "actor", "org", "repo", "user", "business", "operation_type", "visibility"] if k in event}
    log_records.append({
        "timeUnixNano": now_ns,
        "body": {"stringValue": json.dumps(selected, separators=(",", ":"), sort_keys=True)},
        "attributes": base_attrs + [
            attr("record_type", "audit_log"),
            attr("action", event.get("action", "unknown")),
            attr("org", event.get("org", "unknown")),
            attr("repo", event.get("repo", "unknown")),
        ],
    })

for day in metrics_data:
    selected = {k: day.get(k) for k in ["date", "total_active_users", "total_engaged_users"] if k in day}
    log_records.append({
        "timeUnixNano": now_ns,
        "body": {"stringValue": json.dumps(selected, separators=(",", ":"), sort_keys=True)},
        "attributes": base_attrs + [attr("record_type", "copilot_metrics"), attr("date", day.get("date", "unknown"))],
    })

post(logs_endpoint, {
    "resourceLogs": [{
        "resource": {"attributes": [attr("service.name", "github-enterprise-ingestion"), attr("service.version", "1.0.0")]},
        "scopeLogs": [{"scope": {"name": "github-enterprise-ingestion"}, "logRecords": log_records}],
    }]
})

metric_points = []
for name, value, status in [
    ("github_enterprise_audit_log_records", len(audit_data), audit_status),
    ("github_enterprise_copilot_metric_days", len(metrics_data), metrics_status),
    ("github_enterprise_api_available", 1 if audit_status == "available" else 0, audit_status),
    ("github_enterprise_copilot_metrics_available", 1 if metrics_status == "available" else 0, metrics_status),
]:
    metric_points.append({
        "name": name,
        "unit": "1",
        "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": str(int(value)), "attributes": base_attrs + [attr("status", status)]}]},
    })

post(metrics_endpoint, {
    "resourceMetrics": [{
        "resource": {"attributes": [attr("service.name", "github-enterprise-ingestion"), attr("service.version", "1.0.0")]},
        "scopeMetrics": [{"scope": {"name": "github-enterprise-ingestion"}, "metrics": metric_points}],
    }]
})

print(json.dumps(status_body, indent=2, sort_keys=True))
PY
