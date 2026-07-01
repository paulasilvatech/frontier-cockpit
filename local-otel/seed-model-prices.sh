#!/usr/bin/env zsh
set -euo pipefail

# Seed LOCAL PLANNING prices (USD per 1M tokens) for observed model labels so the
# Sessions and Model Labels dashboard can show a what-if USD estimate.
#
# IMPORTANT, read before trusting any dollar value:
#   - These are LOCAL PLANNING ASSUMPTIONS, not official billing and not provider
#     confirmed for these exact telemetry labels. They approximate public provider
#     list-price tiers (small / standard / frontier) for planning only.
#   - price_source is published as "local-planning-assumption" on every series.
#   - Official spend and AI Credits must come from GitHub billing exports or the
#     Copilot usage metrics API. This seed never replaces them.
#   - Edit the values below to match your own negotiated or source-of-truth prices,
#     then re-run. Or override a single model with register-model-price.sh.
#
# Values are emitted as copilot_model_price_usd_per_million_ratio, kept alive by the
# Docker registry sidecar because the collector expires one-shot gauges after about
# five minutes.

here="${0:A:h}"
register="$here/register-model-price.sh"
quiet="${1:-}"

if [[ ! -x "$register" ]]; then
  chmod +x "$register" 2>/dev/null || true
fi

# Format: "<gen_ai_request_model label>|<input USD/1M>|<output USD/1M>|<tier note>"
typeset -a prices
prices=(
  "gpt-4o-mini-2024-07-18|0.15|0.60|small tier"
  "gpt-5-mini|0.25|2.00|small tier"
  "gpt-5.4-mini|0.25|2.00|small tier"
  "gpt-5.4|1.25|10.00|standard tier"
  "gpt-5.5|1.25|10.00|standard tier"
  "gpt-5.3-codex|1.25|10.00|standard tier"
  "claude-haiku-4.5|1.00|5.00|small tier"
  "claude-sonnet-4.5|3.00|15.00|standard tier"
  "claude-sonnet-4.6|3.00|15.00|standard tier"
  "claude-opus-4.6|15.00|75.00|frontier tier"
  "claude-opus-4.8|15.00|75.00|frontier tier"
  "gemini-3-flash-preview|0.30|2.50|small tier"
)

if [[ "$quiet" != "--quiet" ]]; then
  print "Seeding LOCAL PLANNING prices (assumptions, not official billing)."
  print "price_source=local-planning-assumption. Edit values in this script for your own source of truth."
  print ""
fi

count=0
for row in "${prices[@]}"; do
  label="${row%%|*}"; rest="${row#*|}"
  in_p="${rest%%|*}"; rest="${rest#*|}"
  out_p="${rest%%|*}"; note="${rest#*|}"
  "$register" "$label" "$in_p" "$out_p" "local-planning-assumption" >/dev/null
  if [[ "$quiet" != "--quiet" ]]; then
    print "  ${(r:26:)label} in=\$${in_p}/1M out=\$${out_p}/1M  (${note})"
  fi
  count=$((count + 1))
done

if [[ "$quiet" != "--quiet" ]]; then
  print ""
  print "Done. Registered planning prices for $count models."
  print "Reminder: planning assumptions only, NOT official billing."
  print "Verify: curl -s 'http://localhost:9090/api/v1/label/__name__/values' | grep price_usd"
fi
