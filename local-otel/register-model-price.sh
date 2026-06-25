#!/usr/bin/env zsh
set -euo pipefail

# Register a local planning price for one telemetry model label.
# This is NOT official GitHub billing. It only enables local what-if estimates in Grafana.
# Prices are local planning assumptions unless you pass values from a trusted source.
# Usage:
#   register-model-price.sh <gen_ai_request_model> <input_usd_per_1m> <output_usd_per_1m> [price_source]

if [[ "$#" -lt 3 || "$#" -gt 4 ]]; then
  print -u2 "Usage: $0 <gen_ai_request_model> <input_usd_per_1m> <output_usd_per_1m> [price_source]"
  print -u2 "Example: $0 gpt-4o-mini-2024-07-18 0.15 0.60"
  exit 2
fi

source "$HOME/frontier-cockpit/local-otel/env.zsh"

model_label="$1"
input_price="$2"
output_price="$3"
price_source="${4:-local-user-configured}"
endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"

MODEL_LABEL="$model_label" \
MODEL_INPUT_PRICE="$input_price" \
MODEL_OUTPUT_PRICE="$output_price" \
MODEL_PRICE_SOURCE="$price_source" \
python3 <<'PY' | curl -fsS -X POST "$endpoint" -H 'Content-Type: application/json' --data-binary @- >/dev/null
import json
import os
import time

model = os.environ["MODEL_LABEL"]
prices = [
    ("input", float(os.environ["MODEL_INPUT_PRICE"])),
    ("output", float(os.environ["MODEL_OUTPUT_PRICE"])),
]
price_source = os.environ["MODEL_PRICE_SOURCE"]
now = str(time.time_ns())

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}

payload = {
    "resourceMetrics": [
        {
            "resource": {
                "attributes": [
                    attr("service.name", "copilot-model-price-registry"),
                    attr("service.version", "1.0.0"),
                    attr("collection.scope", "user"),
                    attr("environment", "local"),
                ]
            },
            "scopeMetrics": [
                {
                    "scope": {"name": "copilot-otel-price-registry"},
                    "metrics": [
                        {
                            "name": "copilot_model_price_usd_per_million",
                            "description": "Local planning-only model price per million tokens. Not official billing.",
                            "unit": "1",
                            "gauge": {
                                "dataPoints": [
                                    {
                                        "timeUnixNano": now,
                                        "asDouble": price,
                                        "attributes": [
                                            attr("gen_ai_request_model", model),
                                            attr("gen_ai_token_type", token_type),
                                            attr("price_source", price_source),
                                        ],
                                    }
                                    for token_type, price in prices
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

print "Registered local planning prices, not official billing:"
print "  gen_ai_request_model=$model_label"
print "  input_usd_per_1m=$input_price"
print "  output_usd_per_1m=$output_price"
print "  price_source=$price_source"

