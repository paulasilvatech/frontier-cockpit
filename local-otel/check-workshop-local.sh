#!/usr/bin/env zsh
set -euo pipefail

# Workshop validation gate for the local Frontier Cockpit Local.
# Default mode validates stack, endpoints, workspace registry, and reports whether
# real GitHub Copilot telemetry is present. Use --strict-data after the participant
# has run at least one GitHub Copilot Chat or agent session in this repository.

script_dir="${0:A:h}"
strict_data=0

for arg in "$@"; do
  case "$arg" in
    --strict-data) strict_data=1 ;;
    *) print -u2 "Unknown argument: $arg"; exit 2 ;;
  esac
done

export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

fail=0
warn_count=0

ok() { print "PASS  $1"; }
warn() { print "WARN  $1"; warn_count=$((warn_count + 1)); }
err() { print "FAIL  $1"; fail=1; }

http_code() {
  curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "$1" 2>/dev/null || true
}

prom_scalar() {
  local query="$1"
  python3 - "$query" <<'PY'
import json
import sys
import urllib.parse
import urllib.request

query = sys.argv[1]
url = "http://localhost:9090/api/v1/query?query=" + urllib.parse.quote(query)
try:
    with urllib.request.urlopen(url, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    result = payload.get("data", {}).get("result", [])
    if not result:
        print("0")
    else:
        print(result[0].get("value", [0, "0"])[1])
except Exception:
    print("0")
PY
}

print "==> Frontier Cockpit Local workshop validation"
print "mode=$([[ "$strict_data" -eq 1 ]] && print strict-data || print setup)"
print ""

if ! command -v docker >/dev/null 2>&1; then
  err "Docker CLI not found. Install Docker Desktop or add Docker.app CLI to PATH."
elif ! docker info >/dev/null 2>&1; then
  err "Docker daemon is not running. Start Docker Desktop and wait until it is ready."
else
  ok "Docker daemon is running."
fi

expected_containers=(
  aspire-dashboard
  copilot-otel-collector
  copilot-otel-grafana
  copilot-otel-jobs
  copilot-otel-loki
  copilot-otel-prometheus
  copilot-otel-registry
  copilot-otel-tempo
  frontier-dashboard-api
  frontier-dashboard-web
)

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  running_names="$(docker ps --format '{{.Names}}' 2>/dev/null || true)"
  for name in "${expected_containers[@]}"; do
    if print -r -- "$running_names" | grep -qx "$name"; then
      ok "$name container is running."
    else
      err "$name container is not running. Run $script_dir/workshop-ready.sh from a Git repository."
    fi
  done
fi

for item in \
  "http://localhost:3300|Frontier Cockpit Local mini app" \
  "http://localhost:3300/api/health|Dashboard API health" \
  "http://localhost:3300/api/summary?range=24h&repo=all|Dashboard summary API" \
  "http://localhost:3300/api/sessions?range=24h&repo=all|Dashboard sessions API" \
  "http://localhost:3300/api/coach?range=24h&repo=all|Dashboard coach API" \
  "http://localhost:3000/api/health|Grafana" \
  "http://localhost:18888|Aspire Dashboard" \
  "http://localhost:9090/-/ready|Prometheus" \
  "http://localhost:3200/ready|Tempo" \
  "http://localhost:3100/ready|Loki"; do
  url="${item%%|*}"
  name="${item##*|}"
  code="$(http_code "$url")"
  if [[ "$code" == "200" || "$code" == "302" ]]; then
    ok "$name responds (HTTP $code)."
  else
    err "$name did not respond as expected (HTTP ${code:-none})."
  fi
done

if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  current_repo="$(git -C "$git_root" config --get remote.origin.url 2>/dev/null || print unknown)"
  current_branch="$(git -C "$git_root" branch --show-current 2>/dev/null || print unknown)"
  print ""
  print "Workspace context:"
  print "  git_root=$git_root"
  print "  repo=$current_repo"
  print "  branch=$current_branch"
else
  current_repo="unknown"
  warn "Current directory is not inside a Git repository. Workspace attribution will be incomplete."
fi

workspace_registry="$(prom_scalar 'count(copilot_workspace_registry_ratio{workspace_kind="git"})')"
real_sessions="$(prom_scalar 'count(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real"})')"
non_workspace_sessions="$(prom_scalar 'count(copilot_real_session_input_tokens_ratio{usage_scope="non_workspace_real"})')"
ai_credits="$(prom_scalar 'sum(max_over_time(copilot_real_session_nano_aiu_ratio{usage_scope="workspace_real"}[24h])) / 1e9')"
input_tokens="$(prom_scalar 'sum(max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real"}[24h]))')"
cache_read="$(prom_scalar 'sum(max_over_time(copilot_real_session_cache_read_tokens_ratio{usage_scope="workspace_real"}[24h]))')"
workspaces_observed="$(prom_scalar 'count(max by (workspace_path_hash, workspace_name, branch) (max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real",workspace_kind="git",workspace_name!="unknown",repo!="",repo!="unknown"}[24h])))')"
coach_cards="0"
coach_cards="$(python3 <<'PY'
import json
import urllib.request
try:
    with urllib.request.urlopen('http://localhost:3300/api/coach?range=24h&repo=all', timeout=10) as response:
        print(len(json.loads(response.read().decode('utf-8')).get('cards', [])))
except Exception:
    print(0)
PY
)"

print ""
print "Local telemetry summary:"
printf "  workspace_registry_git=%s\n" "$workspace_registry"
printf "  workspace_real_session_series=%s\n" "$real_sessions"
printf "  non_workspace_real_session_series=%s\n" "$non_workspace_sessions"
printf "  workspaces_observed_24h=%s\n" "$workspaces_observed"
printf "  ai_credits_local_24h=%s\n" "$ai_credits"
printf "  input_tokens_24h=%s\n" "$input_tokens"
printf "  cache_read_tokens_24h=%s\n" "$cache_read"
printf "  coach_cards=%s\n" "$coach_cards"

if (( ${workspace_registry%.*} > 0 )); then
  ok "At least one Git workspace is registered."
else
  warn "No Git workspace registry metric found yet. Run $script_dir/register-workspace.sh inside the participant repository."
fi

if (( ${real_sessions%.*} > 0 )); then
  ok "Real workspace-attributed GitHub Copilot sessions are available."
else
  if [[ "$strict_data" -eq 1 ]]; then
    err "No workspace-attributed GitHub Copilot sessions found. Run one GitHub Copilot Chat or agent request in this Git repository, then rerun with --strict-data."
  else
    warn "No workspace-attributed GitHub Copilot sessions found yet. The stack is ready for the participant to generate one."
  fi
fi

if (( ${non_workspace_sessions%.*} > 0 )); then
  warn "Some sessions are non_workspace_real. Open a Git repository in VS Code before generating workshop telemetry."
fi

if (( ${coach_cards%.*} > 0 )); then
  ok "Coach recommendations endpoint returns cards."
else
  warn "Coach endpoint returned no cards. It will populate after real telemetry is present."
fi

print ""
if [[ "$fail" -eq 0 ]]; then
  if [[ "$warn_count" -eq 0 ]]; then
    print "Ready for workshop. Open http://localhost:3300"
  else
    print "Workshop stack is ready with $warn_count warning(s). Open http://localhost:3300"
    print "If this is before the participant's first GitHub Copilot request, warnings about missing sessions are expected."
  fi
  exit 0
fi

print "Workshop validation failed. Fix the FAIL items above and rerun this script."
exit 1
