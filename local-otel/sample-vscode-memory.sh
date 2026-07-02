#!/usr/bin/env zsh
set -euo pipefail

# Sample real OS-level memory (RSS) of VS Code / Electron processes and push it to the local
# OTel Collector as OTLP metrics. This is operating system memory, not GitHub Copilot model
# context. The containerized collector cannot see macOS host processes, so this host-side
# sampler fills that gap.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"

# Collect RSS (KB) and process count grouped by a coarse component name.
tmp_ps="$(mktemp)"
trap 'rm -f "$tmp_ps"' EXIT
ps -axo rss=,comm= > "$tmp_ps" 2>/dev/null || true

python3 - "$metrics_endpoint" "$tmp_ps" <<'PY'
import json
import sys
import time

metrics_endpoint = sys.argv[1]
with open(sys.argv[2], "r", encoding="utf-8", errors="replace") as handle:
    data = handle.read().splitlines()

groups = {
    "code_insiders_main": ["Code - Insiders.app/Contents/MacOS/Electron", "Code - Insiders"],
    "code_main": ["Visual Studio Code.app/Contents/MacOS/Electron", "Code Helper.app"],
    "code_helpers": ["Code Helper", "Code - Insiders Helper", "Code Helper (Renderer)", "Code Helper (GPU)", "Code Helper (Plugin)"],
    "node_processes": ["node"],
}

# Aggregate by group using substring match on the command path.
totals = {key: {"rss_kb": 0, "count": 0} for key in groups}
totals["all_vscode"] = {"rss_kb": 0, "count": 0}

for line in data:
    line = line.strip()
    if not line:
        continue
    parts = line.split(None, 1)
    if len(parts) != 2:
        continue
    rss_str, comm = parts
    try:
        rss_kb = int(rss_str)
    except ValueError:
        continue
    matched_vscode = False
    for key, needles in groups.items():
        if any(needle in comm for needle in needles):
            totals[key]["rss_kb"] += rss_kb
            totals[key]["count"] += 1
            if key != "node_processes":
                matched_vscode = True
    if matched_vscode:
        totals["all_vscode"]["rss_kb"] += rss_kb
        totals["all_vscode"]["count"] += 1

now = str(time.time_ns())

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}

rss_points = []
count_points = []
for component, values in totals.items():
    labels = [attr("component", component), attr("host_metric", "true")]
    rss_points.append({
        "timeUnixNano": now,
        "asDouble": values["rss_kb"] * 1024.0,
        "attributes": labels,
    })
    count_points.append({
        "timeUnixNano": now,
        "asInt": str(values["count"]),
        "attributes": labels,
    })

payload = {
    "resourceMetrics": [
        {
            "resource": {
                "attributes": [
                    attr("service.name", "vscode-host-memory"),
                    attr("service.version", "1.0.0"),
                    attr("environment", "local"),
                ]
            },
            "scopeMetrics": [
                {
                    "scope": {"name": "vscode-host-memory-sampler"},
                    "metrics": [
                        {
                            "name": "vscode_process_memory_rss_bytes",
                            "description": "Resident set size of VS Code/Electron processes, OS level, not model context.",
                            "unit": "By",
                            "gauge": {"dataPoints": rss_points},
                        },
                        {
                            "name": "vscode_process_count",
                            "description": "Number of VS Code/Electron processes by component.",
                            "unit": "1",
                            "gauge": {"dataPoints": count_points},
                        },
                    ],
                }
            ],
        }
    ]
}

import urllib.request

body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
request = urllib.request.Request(metrics_endpoint, data=body, headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request, timeout=10) as response:
    response.read()

print(json.dumps({k: {"rss_mb": round(v["rss_kb"] / 1024, 1), "count": v["count"]} for k, v in totals.items()}, indent=2))
PY
