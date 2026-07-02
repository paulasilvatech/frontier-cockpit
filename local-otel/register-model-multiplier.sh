#!/usr/bin/env zsh
set -euo pipefail

# Register the OFFICIAL GitHub Copilot premium-request multiplier for one model.
# Source the value from the official GitHub Copilot pricing docs, do not invent it:
#   https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans
#
# This is a LOCAL planning aid for the Frontier Cockpit Local. It does not
# replace GitHub billing. The official premium-request count and invoice still
# come from GitHub billing exports or the Copilot usage metrics API.
#
# Usage:
#   register-model-multiplier.sh <gen_ai_request_model> <premium_request_multiplier> [model_display_name] [model_key_kind]
#
# Examples:
#   register-model-multiplier.sh gpt-5.5 57 "GPT-5.5"
#   register-model-multiplier.sh claude-sonnet-4.6 9 "Claude Sonnet 4.6" telemetry_label

if [[ "$#" -lt 2 || "$#" -gt 4 ]]; then
  print -u2 "Usage: $0 <gen_ai_request_model> <premium_request_multiplier> [model_display_name] [model_key_kind]"
  print -u2 "Example: $0 gpt-5.5 57 \"GPT-5.5\""
  exit 2
fi

if [[ "${FRONTIER_SKIP_ENV_ZSH:-false}" != "true" ]]; then
  env_file="${FRONTIER_ENV_ZSH:-${0:A:h}/env.zsh}"
  if [[ ! -f "$env_file" ]]; then
    print -u2 "Environment file not found: $env_file"
    print -u2 "Set FRONTIER_SKIP_ENV_ZSH=true when running in a container with explicit OTLP endpoint variables."
    exit 1
  fi
  source "$env_file"
fi

model_label="$1"
multiplier="$2"
display_name="${3:-$1}"
key_kind="${4:-telemetry_label}"
endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"

MODEL_LABEL="$model_label" \
MODEL_MULTIPLIER="$multiplier" \
MODEL_DISPLAY_NAME="$display_name" \
MODEL_KEY_KIND="$key_kind" \
python3 <<'PY' | curl -fsS -X POST "$endpoint" -H 'Content-Type: application/json' --data-binary @- >/dev/null
import json
import os
import time

model = os.environ["MODEL_LABEL"]
multiplier = float(os.environ["MODEL_MULTIPLIER"])
display_name = os.environ["MODEL_DISPLAY_NAME"]
key_kind = os.environ["MODEL_KEY_KIND"]
now = str(time.time_ns())

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}

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
                            "gauge": {
                                "dataPoints": [
                                    {
                                        "timeUnixNano": now,
                                        "asDouble": multiplier,
                                        "attributes": [
                                            attr("gen_ai_request_model", model),
                                            attr("model_display_name", display_name),
                                            attr("model_key_kind", key_kind),
                                            attr("multiplier_source", "github-pricing-docs-legacy-annual"),
                                            attr("multiplier_plan", "legacy-request-based-annual"),
                                        ],
                                    }
                                ]
                            },
                        }
                    ],
                }
            ],
        }
    ]
}
print(json.dumps(payload, separators=(",", ":")))
PY

print "Registered official premium-request multiplier (local planning aid, not official billing):"
print "  gen_ai_request_model=$model_label"
print "  model_display_name=$display_name"
print "  premium_request_multiplier=$multiplier"
print "  model_key_kind=$key_kind"
print "  multiplier_source=github-pricing-docs-legacy-annual"
