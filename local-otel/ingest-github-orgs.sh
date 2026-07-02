#!/usr/bin/env zsh
set -euo pipefail

# Ingest GitHub organization metadata and Copilot metrics availability into OTel.
# Uses only GitHub APIs visible to the authenticated gh user.
# Sends status and available records to local Collector, and to Azure when hybrid forwarding is enabled.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

gh_bin="${GH_BIN:-/opt/homebrew/bin/gh}"
logs_endpoint="${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-http://localhost:4318/v1/logs}"
metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
out_dir="$HOME/frontier-cockpit/local-otel/github-orgs"
mkdir -p "$out_dir"

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

for required_scope in read:org manage_billing:copilot; do
    if [[ "$auth_status" != *"$required_scope"* ]]; then
        print -u2 "WARN  GitHub CLI auth output does not show scope $required_scope. Some organization signals may be unavailable."
    fi
done

python3 - "$gh_bin" "$logs_endpoint" "$metrics_endpoint" "$out_dir" <<'PY'
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.request

GH, logs_endpoint, metrics_endpoint, out_dir = sys.argv[1:]
out_path = pathlib.Path(out_dir)
now_ns = str(time.time_ns())
now_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def run_gh(path):
    cmd = [GH, "api", "-H", "Accept: application/vnd.github+json", "-H", "X-GitHub-Api-Version: 2026-03-10", path]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    body = proc.stdout.strip()
    err = proc.stderr.strip()
    status = "ok" if proc.returncode == 0 else "failed"
    parsed = None
    if body:
        try:
            parsed = json.loads(body)
        except Exception:
            parsed = {"raw": body[:500]}
    if proc.returncode != 0:
        parsed = parsed or {}
        parsed["stderr"] = err
    return status, parsed


def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value) if value not in (None, "") else "unknown"}}


def post_json(url, payload):
    body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as resp:
        resp.read()

status, orgs = run_gh("/user/orgs?per_page=100")
if status != "ok" or not isinstance(orgs, list):
    orgs = []

# Resolve the authenticated user so membership checks are not tied to a fixed handle.
viewer_status, viewer = run_gh("/user")
viewer_login = viewer.get("login", "") if viewer_status == "ok" and isinstance(viewer, dict) else ""
viewer_login = os.environ.get("GITHUB_USERNAME", viewer_login)

records = []
metrics = []

for org in orgs:
    login = org.get("login", "unknown")
    org_id = org.get("id", "unknown")
    role = "unknown"
    if viewer_login:
        membership_status, membership = run_gh(f"/orgs/{login}/memberships/{viewer_login}")
        if membership_status == "ok" and isinstance(membership, dict):
            role = membership.get("role", "unknown")

    metrics_status, copilot_metrics = run_gh(f"/orgs/{login}/copilot/metrics?per_page=100")
    billing_status, copilot_billing = run_gh(f"/orgs/{login}/copilot/billing")
    metric_days = len(copilot_metrics) if metrics_status == "ok" and isinstance(copilot_metrics, list) else 0
    error_message = ""
    error_code = ""
    if metrics_status != "ok" and isinstance(copilot_metrics, dict):
        error_message = copilot_metrics.get("message", "")
        error_code = str(copilot_metrics.get("status", ""))

    record = {
        "ingested_at": now_iso,
        "org": login,
        "org_id": org_id,
        "membership_role": role,
        "copilot_metrics_status": metrics_status,
        "copilot_metric_days": metric_days,
        "copilot_billing_status": billing_status,
        "plan_type": copilot_billing.get("plan_type", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "seat_management_setting": copilot_billing.get("seat_management_setting", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "public_code_suggestions": copilot_billing.get("public_code_suggestions", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "ide_chat": copilot_billing.get("ide_chat", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "cli": copilot_billing.get("cli", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "platform_chat": copilot_billing.get("platform_chat", "unknown") if isinstance(copilot_billing, dict) else "unknown",
        "error_status": error_code,
        "error_message": error_message,
    }
    records.append(record)

    if metric_days:
        (out_path / f"{login}-copilot-metrics.json").write_text(json.dumps(copilot_metrics, indent=2), encoding="utf-8")

    base = [
        attr("source", "github-api"), attr("record_type", "org_copilot_metrics_status"),
        attr("org", login), attr("membership_role", role), attr("copilot_metrics_status", metrics_status),
        attr("copilot_billing_status", billing_status),
        attr("plan_type", record["plan_type"]),
        attr("seat_management_setting", record["seat_management_setting"]),
        attr("ide_chat", record["ide_chat"]),
        attr("cli", record["cli"]),
        attr("platform_chat", record["platform_chat"]),
        attr("error_status", error_code), attr("ingested_at", now_iso),
    ]
    metrics.extend([
        {
            "name": "github_org_copilot_metric_days",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": str(metric_days), "attributes": base}]},
        },
        {
            "name": "github_org_copilot_metrics_available",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if metrics_status == "ok" else "0", "attributes": base}]},
        },
        {
            "name": "github_org_membership_admin",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if role == "admin" else "0", "attributes": base}]},
        },
        {
            "name": "github_org_copilot_billing_available",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if billing_status == "ok" else "0", "attributes": base}]},
        },
        {
            "name": "github_org_copilot_ide_chat_enabled",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if record["ide_chat"] == "enabled" else "0", "attributes": base}]},
        },
        {
            "name": "github_org_copilot_cli_enabled",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if record["cli"] == "enabled" else "0", "attributes": base}]},
        },
        {
            "name": "github_org_copilot_platform_chat_enabled",
            "unit": "1",
            "gauge": {"dataPoints": [{"timeUnixNano": now_ns, "asInt": "1" if record["platform_chat"] == "enabled" else "0", "attributes": base}]},
        },
    ])

log_records = []
for record in records:
    log_records.append({
        "timeUnixNano": now_ns,
        "body": {"stringValue": json.dumps(record, ensure_ascii=False, sort_keys=True)},
        "attributes": [
            attr("source", "github-api"), attr("record_type", "org_copilot_metrics_status"),
            attr("org", record["org"]), attr("membership_role", record["membership_role"]),
            attr("copilot_metrics_status", record["copilot_metrics_status"]), attr("error_status", record["error_status"]),
            attr("copilot_billing_status", record["copilot_billing_status"]),
            attr("plan_type", record["plan_type"]),
            attr("ide_chat", record["ide_chat"]),
            attr("cli", record["cli"]),
            attr("platform_chat", record["platform_chat"]),
            attr("ingested_at", now_iso),
        ],
    })

post_json(logs_endpoint, {
    "resourceLogs": [{
        "resource": {"attributes": [attr("service.name", "github-org-ingestion"), attr("service.version", "1.0.0")]},
        "scopeLogs": [{"scope": {"name": "github-org-ingestion"}, "logRecords": log_records}],
    }]
})

post_json(metrics_endpoint, {
    "resourceMetrics": [{
        "resource": {"attributes": [attr("service.name", "github-org-ingestion"), attr("service.version", "1.0.0")]},
        "scopeMetrics": [{"scope": {"name": "github-org-ingestion"}, "metrics": metrics}],
    }]
})

summary = {
    "ingested_at": now_iso,
    "org_count": len(records),
    "admin_orgs": sum(1 for r in records if r["membership_role"] == "admin"),
    "copilot_billing_available_orgs": sum(1 for r in records if r["copilot_billing_status"] == "ok"),
    "copilot_business_orgs": sum(1 for r in records if r["plan_type"] == "business"),
    "copilot_cli_enabled_orgs": sum(1 for r in records if r["cli"] == "enabled"),
    "copilot_ide_chat_enabled_orgs": sum(1 for r in records if r["ide_chat"] == "enabled"),
    "copilot_metrics_available_orgs": sum(1 for r in records if r["copilot_metrics_status"] == "ok"),
    "copilot_metrics_unavailable_orgs": sum(1 for r in records if r["copilot_metrics_status"] != "ok"),
}
(out_path / "org-ingestion-summary.json").write_text(json.dumps({"summary": summary, "records": records}, indent=2), encoding="utf-8")
print(json.dumps(summary, indent=2))
PY
