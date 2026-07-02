#!/usr/bin/env zsh
set -euo pipefail

# Daily rollup for real GitHub Copilot workspace telemetry.
# Computes 24h summaries from Prometheus using only materialized real workspace traces.
# Sends the rollup back through OTLP as metrics and logs. If the hybrid Azure stack is enabled,
# the local Collector forwards these rollups to Azure too.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

script_dir="${0:A:h}"
prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
logs_endpoint="${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-http://localhost:4318/v1/logs}"
period="${COPILOT_DAILY_ROLLUP_RANGE:-24h}"

# Make sure the latest real traces are summarized before calculating the daily rollup.
if [[ -x "$script_dir/materialize-copilot-sessions.sh" ]]; then
  "$script_dir/materialize-copilot-sessions.sh" >/dev/null || true
fi

# Persist a lightweight local analytical history for the local cockpit.
# This complements Prometheus/Grafana. It does not replace the mandatory dashboard stack.
if [[ -x "$script_dir/frontier-local-insights.sh" ]]; then
    FRONTIER_INSIGHTS_RANGE="$period" "$script_dir/frontier-local-insights.sh" >/dev/null || true
fi

# Snapshot recent local OTel backend data into DuckDB for offline analysis and export.
# This keeps raw content local and complements Tempo, Prometheus, Loki, and Grafana.
if [[ -x "$script_dir/export-otel-duckdb.sh" ]]; then
    FRONTIER_OTEL_EXPORT_RANGE="${FRONTIER_OTEL_EXPORT_RANGE:-1h}" "$script_dir/export-otel-duckdb.sh" >/dev/null || true
fi

python3 - "$prometheus_url" "$metrics_endpoint" "$logs_endpoint" "$period" <<'PY'
import json
import sys
import time
import urllib.parse
import urllib.request

prometheus_url, metrics_endpoint, logs_endpoint, period = sys.argv[1:]

def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))

def post_json(url, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=15) as response:
        response.read()

def prom(query):
    url = f"{prometheus_url}/api/v1/query?" + urllib.parse.urlencode({"query": query})
    return fetch_json(url).get("data", {}).get("result", [])

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value) if value not in (None, "") else "unknown"}}

def metric_point(value, attrs):
    return {"timeUnixNano": now, "asDouble": float(value or 0), "attributes": attrs}

now = str(time.time_ns())
base_selector = 'usage_scope="workspace_real"'
queries = {
    "sessions": f"count by (repo, branch) (max_over_time(copilot_real_session_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "input_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "output_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_output_tokens_ratio{{{base_selector}}}[{period}]))",
    "cache_read_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cache_read_tokens_ratio{{{base_selector}}}[{period}]))",
    "cache_creation_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cache_creation_tokens_ratio{{{base_selector}}}[{period}]))",
    "cold_input_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cold_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "aiu": f"sum by (repo, branch) (max_over_time(copilot_real_session_nano_aiu_ratio{{{base_selector}}}[{period}])) / 1e9",
    "max_context_pct": f"max by (repo, branch) (max_over_time(copilot_real_session_context_utilization_pct_ratio{{{base_selector}}}[{period}]))",
    "tool_calls": f"sum by (repo, branch) (max_over_time(copilot_real_session_tool_calls_ratio{{{base_selector}}}[{period}]))",
    "errors": f"sum by (repo, branch) (max_over_time(copilot_real_session_error_count_ratio{{{base_selector}}}[{period}]))",
    "content_chars": f"sum by (repo, branch) (max_over_time(copilot_real_session_content_capture_chars_ratio{{{base_selector}}}[{period}]))",
}

rows = {}
for field, query in queries.items():
    for item in prom(query):
        labels = item.get("metric", {})
        key = (labels.get("repo", "unknown"), labels.get("branch", "unknown"))
        rows.setdefault(key, {"repo": key[0], "branch": key[1]})[field] = float(item.get("value", [0, 0])[1])

metrics = []
logs = []
for row in rows.values():
    attrs = [
        attr("repo", row.get("repo", "unknown")),
        attr("branch", row.get("branch", "unknown")),
        attr("period", period),
        attr("real_usage", "true"),
        attr("rollup_type", "daily_workspace"),
    ]
    for name in ["sessions", "input_tokens", "output_tokens", "cache_read_tokens", "cache_creation_tokens", "cold_input_tokens", "aiu", "max_context_pct", "tool_calls", "errors", "content_chars"]:
        metrics.append({
            "name": f"copilot_daily_workspace_{name}",
            "unit": "1",
            "gauge": {"dataPoints": [metric_point(row.get(name, 0), attrs)]},
        })
    logs.append({
        "timeUnixNano": now,
        "body": {"stringValue": json.dumps(row, ensure_ascii=False, sort_keys=True)},
        "attributes": attrs,
    })

if metrics:
    post_json(metrics_endpoint, {
        "resourceMetrics": [{
            "resource": {"attributes": [attr("service.name", "copilot-daily-rollup"), attr("service.version", "1.0.0")]},
            "scopeMetrics": [{"scope": {"name": "copilot-daily-rollup"}, "metrics": metrics}],
        }]
    })
if logs:
    post_json(logs_endpoint, {
        "resourceLogs": [{
            "resource": {"attributes": [attr("service.name", "copilot-daily-rollup"), attr("service.version", "1.0.0")]},
            "scopeLogs": [{"scope": {"name": "copilot-daily-rollup"}, "logRecords": logs}],
        }]
    })

print(json.dumps({"period": period, "repositories": len(rows), "rows": list(rows.values())}, indent=2, ensure_ascii=False))
PY
