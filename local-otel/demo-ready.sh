#!/usr/bin/env zsh
set -euo pipefail

# One-command pre-demo gate for the local GitHub Copilot OTel cockpit.
# Run this from the target Git repository before a customer or internal demo.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  print -u2 "FAIL  Run this from inside the Git repository you want to demo."
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

print "==> Frontier Cockpit demo readiness"
print "repo_root=$repo_root"
print "repo_remote=$(git config --get remote.origin.url 2>/dev/null || print unknown)"
print "branch=$(git branch --show-current 2>/dev/null || print unknown)"
print ""
current_repo="$(git config --get remote.origin.url 2>/dev/null || print unknown)"

"$HOME/frontier-cockpit/local-otel/enable-user-env.sh"
"$HOME/frontier-cockpit/local-otel/start-full-stack.sh"
"$HOME/frontier-cockpit/local-otel/check-otel-local.sh"
"$HOME/frontier-cockpit/local-otel/register-workspace.sh"

COPILOT_MATERIALIZE_FORCE_REPLAY=true COPILOT_MATERIALIZE_ACTIVE_WORKSPACE=true "$HOME/frontier-cockpit/local-otel/materialize-copilot-sessions.sh"
"$HOME/frontier-cockpit/local-otel/sample-vscode-memory.sh" >/dev/null 2>&1 || true
"$HOME/frontier-cockpit/local-otel/audit-coverage.sh" >/dev/null 2>&1 || true
"$HOME/frontier-cockpit/local-otel/daily-rollup.sh" >/dev/null 2>&1 || true

CURRENT_REPO="$current_repo" python3 <<'PY'
import json
import os
import sys
import urllib.parse
import urllib.request

PROM = "http://localhost:9090"
CURRENT_REPO = os.environ.get("CURRENT_REPO", "unknown")

def query(expr):
    url = f"{PROM}/api/v1/query?query={urllib.parse.quote(expr)}"
    with urllib.request.urlopen(url, timeout=15) as response:
        data = json.loads(response.read().decode("utf-8"))
    return data.get("data", {}).get("result", [])

def scalar(expr):
    result = query(expr)
    if not result:
        return 0.0
    try:
        return float(result[0]["value"][1])
    except Exception:
        return 0.0

checks = []
checks.append(("Grafana dashboard data", scalar("count(copilot_real_session_input_tokens_ratio)") > 0))
checks.append(("Workspace registry", scalar("count(copilot_workspace_registry_ratio{workspace_kind=\"git\"})") > 0))
checks.append(("Token telemetry", scalar("count(gen_ai_client_token_usage_sum)") > 0))
checks.append(("VS Code memory telemetry", scalar("count(vscode_process_memory_rss_bytes)") > 0))
checks.append(("OTel coverage metadata", scalar("count(copilot_otel_coverage_status_ratio)") > 0))
checks.append(("24h workspace rollup", scalar("count(copilot_daily_workspace_sessions_ratio)") > 0))
current_repo_expr = 'count(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real", repo="' + CURRENT_REPO.replace('\\', '\\\\').replace('"', '\\"') + '"})'
checks.append(("Workspace-attributed sessions for current repo", scalar(current_repo_expr) > 0))

for name, ok in checks:
    print(("PASS" if ok else "FAIL") + f"  {name}")

split = query("count by (usage_scope, attribution_source, repo, branch, workspace_name) (copilot_real_session_input_tokens_ratio)")
print("\nWorkspace session split:")
if not split:
    print("  no copilot_real_session_input_tokens_ratio series yet")
else:
    for item in split:
        metric = item.get("metric", {})
        value = item.get("value", [None, "0"])[1]
        print("  " + ", ".join(f"{k}={v}" for k, v in sorted(metric.items())) + f" => {value}")

if not all(ok for _, ok in checks):
    print("\nDemo gate failed. Reload VS Code Insiders, run one GitHub Copilot Chat request in this repo, then run demo-ready.sh again.")
    sys.exit(1)

print("\nDemo gate passed. Open Grafana: http://localhost:3000/d/copilot-real-workspace-usage-local/github-copilot-real-workspace-usage-local")
PY