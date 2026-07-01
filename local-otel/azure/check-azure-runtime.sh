#!/usr/bin/env zsh
set -euo pipefail

# Read-only Azure runtime validation for Frontier FinOps Cockpit.
# Requires Azure CLI authentication and the deployed resource group.

script_dir="${0:A:h}"
env_file="$script_dir/.env"

if [[ -f "$env_file" ]]; then
  set -a
  source "$env_file"
  set +a
fi

resource_group="${AZURE_RESOURCE_GROUP:-rg-agentobs-dev-eus-001}"
workload="${AZURE_WORKLOAD:-agentobs}"
environment_name="${AZURE_ENVIRONMENT_NAME:-dev}"
region_abbr="${AZURE_REGION_ABBR:-eus}"
instance="${AZURE_INSTANCE:-001}"
suffix="${workload}-${environment_name}-${region_abbr}-${instance}"
collector_name="${AZURE_COLLECTOR_APP_NAME:-ca-otelcol-${environment_name}-${region_abbr}-${instance}}"
log_workspace_name="${AZURE_LOG_ANALYTICS_NAME:-log-${suffix}}"
grafana_name="${AZURE_GRAFANA_NAME:-amg-${workload}-${environment_name}-${region_abbr}01}"
fail=0

ok() { print "PASS  $1"; }
warn() { print "WARN  $1"; }
err() { print "FAIL  $1"; fail=1; }

if ! command -v az >/dev/null 2>&1; then
  err "Azure CLI was not found."
  exit "$fail"
fi

if ! az account show >/dev/null 2>&1; then
  err "Azure CLI is not logged in. Run az login first."
  exit "$fail"
fi

if az group show -n "$resource_group" >/dev/null 2>&1; then
  ok "Resource group exists: $resource_group"
else
  err "Resource group not found: $resource_group"
fi

collector_json="$(az containerapp show -g "$resource_group" -n "$collector_name" -o json 2>/dev/null || true)"
if [[ -n "$collector_json" ]]; then
  ok "Azure Collector Container App exists: $collector_name"
  running_status="$(print -r -- "$collector_json" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("properties",{}).get("runningStatus","unknown"))' 2>/dev/null || print unknown)"
  provisioning_state="$(print -r -- "$collector_json" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("properties",{}).get("provisioningState","unknown"))' 2>/dev/null || print unknown)"
  fqdn="$(print -r -- "$collector_json" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("properties",{}).get("configuration",{}).get("ingress",{}).get("fqdn",""))' 2>/dev/null || print '')"
  [[ "$running_status" == "Running" ]] && ok "Collector runningStatus is Running." || warn "Collector runningStatus is $running_status."
  [[ "$provisioning_state" == "Succeeded" ]] && ok "Collector provisioningState is Succeeded." || warn "Collector provisioningState is $provisioning_state."
  [[ -n "$fqdn" ]] && ok "Collector ingress FQDN is $fqdn" || warn "Collector ingress FQDN was not found."
else
  err "Azure Collector Container App not found: $collector_name"
fi

workspace_id="$(az monitor log-analytics workspace show -g "$resource_group" -n "$log_workspace_name" --query customerId -o tsv 2>/dev/null || true)"
if [[ -n "$workspace_id" ]]; then
  ok "Log Analytics workspace exists: $log_workspace_name"
  for query_name query_text in \
    traces 'AppTraces | summarize Count=count(), Last=max(TimeGenerated) by AppRoleName | order by Count desc | take 10' \
    metrics 'AppMetrics | summarize Count=count(), Last=max(TimeGenerated) by Name | order by Count desc | take 10'; do
    if az monitor log-analytics query -w "$workspace_id" --analytics-query "$query_text" -o table >/tmp/frontier-azure-query.out 2>/tmp/frontier-azure-query.err; then
      ok "Log Analytics query succeeded for $query_name."
    else
      warn "Log Analytics query failed for $query_name. See /tmp/frontier-azure-query.err for details."
    fi
  done
else
  err "Log Analytics workspace not found: $log_workspace_name"
fi

if az grafana show -g "$resource_group" -n "$grafana_name" >/dev/null 2>&1; then
  ok "Azure Managed Grafana exists: $grafana_name"
else
  warn "Azure Managed Grafana not found or not readable: $grafana_name"
fi

print ""
if [[ "$fail" -eq 0 ]]; then
  print "Azure Frontier Cockpit runtime validation completed without blocking failures."
else
  print "Azure Frontier Cockpit runtime validation found blocking failures."
fi
exit "$fail"
