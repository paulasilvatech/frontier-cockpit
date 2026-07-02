#!/usr/bin/env zsh
set -euo pipefail

script_dir="${0:A:h}"

# Select the environment parameter file: dev (default), test, or prod.
deploy_env="${AZURE_DEPLOY_ENV:-dev}"
case "$deploy_env" in
  dev) param_file="$script_dir/main.bicepparam" ;;
  test) param_file="$script_dir/main.test.bicepparam" ;;
  prod) param_file="$script_dir/main.prod.bicepparam" ;;
  *) print -u2 "Unknown AZURE_DEPLOY_ENV: $deploy_env (use dev, test, or prod)"; exit 2 ;;
esac

location="${AZURE_LOCATION:-eastus}"
workload="${AZURE_WORKLOAD:-agentobs}"
environment_name="${AZURE_ENVIRONMENT_NAME:-dev}"
region_abbr="${AZURE_REGION_ABBR:-eus}"
instance="${AZURE_INSTANCE:-001}"
collector_min_replicas="${AZURE_COLLECTOR_MIN_REPLICAS:-1}"
collector_max_replicas="${AZURE_COLLECTOR_MAX_REPLICAS:-3}"
suffix="${workload}-${environment_name}-${region_abbr}-${instance}"
deployment_name="${suffix}-validate-$(date +%Y%m%d%H%M%S)"

if ! command -v az >/dev/null 2>&1; then
  print -u2 "Azure CLI was not found."
  exit 1
fi

if ! az account show >/dev/null 2>&1; then
  print -u2 "Azure CLI is not logged in. Run az login first."
  exit 1
fi

collector_token="${AZURE_OTLP_TOKEN:-validation-only-token}"
export AZURE_OTLP_TOKEN="$collector_token"

print "Validating Bicep deployment at subscription scope..."
az deployment sub validate \
  --name "$deployment_name" \
  --location "$location" \
  --template-file "$script_dir/main.bicep" \
  --parameters "$param_file" \
  --parameters \
    location="$location" \
    workload="$workload" \
    environmentName="$environment_name" \
    regionAbbr="$region_abbr" \
    instance="$instance" \
    collectorMinReplicas="$collector_min_replicas" \
    collectorMaxReplicas="$collector_max_replicas"

print "Running what-if..."
az deployment sub what-if \
  --name "$deployment_name-whatif" \
  --location "$location" \
  --template-file "$script_dir/main.bicep" \
  --parameters "$param_file" \
  --parameters \
    location="$location" \
    workload="$workload" \
    environmentName="$environment_name" \
    regionAbbr="$region_abbr" \
    instance="$instance" \
    collectorMinReplicas="$collector_min_replicas" \
    collectorMaxReplicas="$collector_max_replicas"
