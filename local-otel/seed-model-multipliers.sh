#!/usr/bin/env zsh
set -euo pipefail

# Seed the OFFICIAL GitHub Copilot premium-request multipliers into local telemetry.
#
# Source (retrieved 2026-06-25), values verbatim from GitHub docs:
#   https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans
#
# IMPORTANT, read before trusting these numbers:
#   - These are the LEGACY annual request-based billing multipliers.
#   - On 2026-06-01 GitHub moved to usage-based billing. Multipliers apply only to
#     Copilot Pro / Pro+ subscribers who stayed on a legacy annual plan.
#   - Multipliers are subject to change. Re-check the page and update the table below.
#   - Auto model selection qualifies for a 10 percent discount (a 1x model bills 0.9x).
#   - This is a LOCAL planning aid only. It is NOT official billing. The real
#     premium-request count and invoice come from GitHub billing exports or the
#     Copilot usage metrics API.
#
# The metric is copilot_model_premium_request_multiplier (unit 1, so Prometheus
# exposes copilot_model_premium_request_multiplier_ratio), keyed by gen_ai_request_model.
# Two model_key_kind values are emitted:
#   - telemetry_label : keyed by the real model label seen in local Copilot traces,
#                       so Grafana can join the multiplier to real per-model usage.
#   - official_catalog: keyed by a canonical slug for official models not yet seen
#                       locally, so the full official table is visible as reference.
#
# All multipliers are re-emitted as ONE OTLP payload. The collector's Prometheus
# exporter expires metrics after a few minutes, so the Docker registry sidecar
# re-runs this seed every five minutes to keep the gauges live.

if [[ "${FRONTIER_SKIP_ENV_ZSH:-false}" != "true" ]]; then
  env_file="${FRONTIER_ENV_ZSH:-$HOME/frontier-cockpit/local-otel/env.zsh}"
  if [[ ! -f "$env_file" ]]; then
    print -u2 "Environment file not found: $env_file"
    print -u2 "Set FRONTIER_SKIP_ENV_ZSH=true when running in a container with explicit OTLP endpoint variables."
    exit 1
  fi
  source "$env_file"
fi

otlp_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
quiet="false"
[[ "${1:-}" == "--quiet" ]] && quiet="true"

# Official multiplier table.
# Columns: gen_ai_request_model | multiplier | display name | model_key_kind
#
# telemetry_label rows use the exact model label observed in local Copilot traces so
# the Grafana join lands on real usage. official_catalog rows complete the published
# table for reference. Update both when GitHub changes the multipliers.
typeset -a rows
rows=(
  # --- Observed local telemetry labels ---
  "claude-haiku-4.5|0.33|Claude Haiku 4.5|telemetry_label"
  "claude-opus-4.6|27|Claude Opus 4.6|telemetry_label"
  "claude-opus-4.8|27|Claude Opus 4.8|telemetry_label"
  "claude-sonnet-4.5|6|Claude Sonnet 4.5|telemetry_label"
  "claude-sonnet-4.6|9|Claude Sonnet 4.6|telemetry_label"
  "gemini-3-flash-preview|0.33|Gemini 3 Flash|telemetry_label"
  "gpt-4o-mini-2024-07-18|0.33|GPT-4o mini|telemetry_label"
  "gpt-5-mini|0.33|GPT-5 mini|telemetry_label"
  "gpt-5.3-codex|6|GPT-5.3-Codex|telemetry_label"
  "gpt-5.4|6|GPT-5.4|telemetry_label"
  "gpt-5.4-mini|6|GPT-5.4 mini|telemetry_label"
  "gpt-5.5|57|GPT-5.5|telemetry_label"
  # --- Remaining official catalog (reference only) ---
  "claude-opus-4.5|15|Claude Opus 4.5|official_catalog"
  "claude-opus-4.7|27|Claude Opus 4.7|official_catalog"
  "gemini-2.5-pro|1|Gemini 2.5 Pro|official_catalog"
  "gemini-3-pro|6|Gemini 3 Pro|official_catalog"
  "gemini-3.1-pro|6|Gemini 3.1 Pro|official_catalog"
  "gemini-3.5-flash|14|Gemini 3.5 Flash|official_catalog"
  "gpt-4o|0.33|GPT-4o|official_catalog"
  "gpt-5.1|3|GPT-5.1|official_catalog"
  "gpt-5.1-codex|3|GPT-5.1-Codex|official_catalog"
  "gpt-5.1-codex-mini|0.33|GPT-5.1-Codex-Mini|official_catalog"
  "gpt-5.1-codex-max|3|GPT-5.1-Codex-Max|official_catalog"
  "raptor-mini|0.33|Raptor mini|official_catalog"
  "mai-code-1-flash|0.33|MAI-Code-1-Flash|official_catalog"
  "copilot-code-review|13|Copilot code review|official_catalog"
)

# Newline-separated rows for the payload builder.
multiplier_rows=""
for row in "${rows[@]}"; do
  multiplier_rows+="${row}"$'\n'
done

MULTIPLIER_ROWS="$multiplier_rows" \
python3 <<'PY' | curl -fsS -X POST "$otlp_endpoint" -H 'Content-Type: application/json' --data-binary @- >/dev/null
import json
import os
import time

now = str(time.time_ns())


def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}


data_points = []
for line in os.environ["MULTIPLIER_ROWS"].splitlines():
    line = line.strip()
    if not line:
        continue
    parts = line.split("|")
    if len(parts) != 4:
        continue
    model, multiplier, display_name, key_kind = parts
    data_points.append(
        {
            "timeUnixNano": now,
            "asDouble": float(multiplier),
            "attributes": [
                attr("gen_ai_request_model", model),
                attr("model_display_name", display_name),
                attr("model_key_kind", key_kind),
                attr("multiplier_source", "github-pricing-docs-legacy-annual"),
                attr("multiplier_plan", "legacy-request-based-annual"),
            ],
        }
    )

payload = {
    "resourceMetrics": [
        {
            "resource": {
                "attributes": [
                    attr("service.name", "copilot-model-multiplier-registry"),
                    attr("service.version", "1.0.0"),
                    attr("collection.scope", "user"),
                    attr("environment", "local"),
                ]
            },
            "scopeMetrics": [
                {
                    "scope": {"name": "copilot-otel-multiplier-registry"},
                    "metrics": [
                        {
                            "name": "copilot_model_premium_request_multiplier",
                            "description": "Official GitHub Copilot premium-request multiplier per model, entered from GitHub pricing docs. Legacy annual request-based billing. Local planning aid, not official billing.",
                            "unit": "1",
                            "gauge": {"dataPoints": data_points},
                        }
                    ],
                }
            ],
        }
    ]
}
print(json.dumps(payload, separators=(",", ":")))
PY

if [[ "$quiet" != "true" ]]; then
  print "Seeded ${#rows} official GitHub Copilot premium-request multipliers (legacy annual)."
  print "Metric: copilot_model_premium_request_multiplier_ratio (keyed by gen_ai_request_model)."
  print "Source: https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans"
  print "Retrieved 2026-06-25. Legacy request-based values, subject to change. LOCAL planning aid, NOT official billing."
  print "Verify: curl -s 'http://localhost:9090/api/v1/query?query=copilot_model_premium_request_multiplier_ratio' | python3 -m json.tool"
fi
