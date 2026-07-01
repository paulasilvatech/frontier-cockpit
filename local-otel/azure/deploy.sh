#!/usr/bin/env zsh
set -euo pipefail

# Deploy the Azure side of the hybrid Frontier Cockpit observability stack.
# By default this creates rg-agentobs-dev-eus-001 in East US. Override the
# AZURE_* variables below for customer or non-dev environments.
# It writes $HOME/frontier-cockpit/local-otel/azure/.env with the cloud Collector endpoint and local token.

script_dir="${0:A:h}"
location="${AZURE_LOCATION:-eastus}"
workload="${AZURE_WORKLOAD:-agentobs}"
environment_name="${AZURE_ENVIRONMENT_NAME:-dev}"
region_abbr="${AZURE_REGION_ABBR:-eus}"
instance="${AZURE_INSTANCE:-001}"
collector_min_replicas="${AZURE_COLLECTOR_MIN_REPLICAS:-1}"
collector_max_replicas="${AZURE_COLLECTOR_MAX_REPLICAS:-3}"
suffix="${workload}-${environment_name}-${region_abbr}-${instance}"
deployment_name="${suffix}-$(date +%Y%m%d%H%M%S)"
resource_group="${AZURE_RESOURCE_GROUP:-rg-${suffix}}"

if ! command -v az >/dev/null 2>&1; then
  print -u2 "Azure CLI was not found. Install Azure CLI and run az login."
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  print -u2 "Azure CLI is not logged in. Run az login first."
  exit 1
fi

if [[ -n "${AZURE_OTLP_TOKEN:-}" ]]; then
  collector_token="$AZURE_OTLP_TOKEN"
else
  collector_token="$(python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(48))
PY
)"
fi
export AZURE_OTLP_TOKEN="$collector_token"

print "Running subscription deployment what-if for $resource_group in $location..."
az deployment sub what-if \
  --name "$deployment_name-whatif" \
  --location "$location" \
  --template-file "$script_dir/main.bicep" \
  --parameters "$script_dir/main.bicepparam" \
  --parameters \
    location="$location" \
    workload="$workload" \
    environmentName="$environment_name" \
    regionAbbr="$region_abbr" \
    instance="$instance" \
    collectorMinReplicas="$collector_min_replicas" \
    collectorMaxReplicas="$collector_max_replicas"

print "Deploying Azure resources..."
outputs_json="$(az deployment sub create \
  --name "$deployment_name" \
  --location "$location" \
  --template-file "$script_dir/main.bicep" \
  --parameters "$script_dir/main.bicepparam" \
  --parameters \
    location="$location" \
    workload="$workload" \
    environmentName="$environment_name" \
    regionAbbr="$region_abbr" \
    instance="$instance" \
    collectorMinReplicas="$collector_min_replicas" \
    collectorMaxReplicas="$collector_max_replicas" \
  --query properties.outputs \
  -o json)"

collector_fqdn="$(python3 -c 'import json, sys; print(json.loads(sys.argv[1])["containerAppCollectorFqdn"]["value"])' "$outputs_json")"
grafana_endpoint="$(python3 -c 'import json, sys; print(json.loads(sys.argv[1])["grafanaEndpoint"]["value"])' "$outputs_json")"

cat > "$script_dir/.env" <<EOF
AZURE_RESOURCE_GROUP=${resource_group}
AZURE_LOCATION=${location}
AZURE_WORKLOAD=${workload}
AZURE_ENVIRONMENT_NAME=${environment_name}
AZURE_REGION_ABBR=${region_abbr}
AZURE_INSTANCE=${instance}
AZURE_OTLP_ENDPOINT=https://${collector_fqdn}
AZURE_OTLP_TOKEN=${collector_token}
EOF
chmod 600 "$script_dir/.env"

print ""
print "Azure deployment complete."
print "  Resource group: $resource_group"
print "  Cloud Collector OTLP/HTTP endpoint: https://${collector_fqdn}"
print "  Azure Managed Grafana: ${grafana_endpoint}"
print "  Local hybrid env file written: $script_dir/.env"
print ""
print "Start local hybrid forwarding with:"
print "  $HOME/frontier-cockpit/local-otel/start-full-stack.sh --hybrid"
