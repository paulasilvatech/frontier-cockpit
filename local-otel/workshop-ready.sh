#!/usr/bin/env zsh
set -euo pipefail

# One-command local workshop setup for Frontier Developer Cockpit.
# Run from the participant Git repository. This is local-only and never enables
# Azure forwarding or hybrid mode.

script_dir="${0:A:h}"
export PATH="/Applications/Docker.app/Contents/Resources/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

print_step() { print "\n==> $1"; }

print "Frontier Developer Cockpit workshop setup"
print "local_only=true"
print "azure_forwarding=disabled"
print ""

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  print -u2 "FAIL  Run this command from inside the Git repository the participant will use during the workshop."
  print -u2 "      Workspace attribution depends on Git repository metadata."
  exit 1
fi

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

print "repo_root=$repo_root"
print "repo_remote=$(git config --get remote.origin.url 2>/dev/null || print unknown)"
print "branch=$(git branch --show-current 2>/dev/null || print unknown)"

if ! command -v docker >/dev/null 2>&1; then
  print -u2 "FAIL  Docker CLI was not found. Install Docker Desktop first."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  print -u2 "FAIL  Docker is installed, but the daemon is not running. Start Docker Desktop, wait until it is ready, then rerun."
  exit 1
fi

print_step "Resolve participant identity"
# Precedence: shell env > local-otel/workshop.env > git config > generic default.
# These values only label the local dashboard. They are not sent to Azure.
if [ -f "$script_dir/workshop.env" ]; then
  set -a
  source "$script_dir/workshop.env"
  set +a
  print "identity_source=workshop.env"
else
  print "identity_source=git-config-or-default"
fi

export FRONTIER_PARTICIPANT_NAME="${FRONTIER_PARTICIPANT_NAME:-$(git config user.name 2>/dev/null || print 'Workshop Participant')}"
export FRONTIER_PARTICIPANT_EMAIL="${FRONTIER_PARTICIPANT_EMAIL:-$(git config user.email 2>/dev/null || print '')}"
export FRONTIER_PARTICIPANT_ROLE="${FRONTIER_PARTICIPANT_ROLE:-Developer}"
export FRONTIER_PARTICIPANT_TEAM="${FRONTIER_PARTICIPANT_TEAM:-}"
export FRONTIER_CUSTOMER_NAME="${FRONTIER_CUSTOMER_NAME:-}"
export FRONTIER_DASHBOARD_TITLE="${FRONTIER_DASHBOARD_TITLE:-Frontier Developer Cockpit}"

# These exported variables are inherited by start-full-stack.sh and docker
# compose, which substitutes them into the frontier-dashboard-api service.
# The tracked stack/.env (Aspire key) is left untouched.
print "participant_name=${FRONTIER_PARTICIPANT_NAME}"
print "participant_role=${FRONTIER_PARTICIPANT_ROLE}"

print_step "Enable local OpenTelemetry environment"
"$script_dir/enable-user-env.sh"

print_step "Start full local stack"
"$script_dir/start-full-stack.sh"

print_step "Register this Git workspace"
"$script_dir/register-workspace.sh"

print_step "Send synthetic validation span"
"$script_dir/send-test-span.sh"

print_step "Materialize recent GitHub Copilot sessions"
COPILOT_MATERIALIZE_FORCE_REPLAY=true \
COPILOT_MATERIALIZE_CONTENT=true \
COPILOT_MATERIALIZE_TRACE_LIMIT=1000 \
COPILOT_MATERIALIZE_ACTIVE_WORKSPACE=true \
"$script_dir/materialize-copilot-sessions.sh" || true

print_step "Refresh local support metrics"
"$script_dir/sample-vscode-memory.sh" >/dev/null 2>&1 || true
"$script_dir/audit-coverage.sh" >/dev/null 2>&1 || true
"$script_dir/daily-rollup.sh" >/dev/null 2>&1 || true

print_step "Validate workshop readiness"
"$script_dir/check-workshop-local.sh"

print ""
print "Open the local cockpit: http://localhost:3300"
print "Open live traces:       http://localhost:18888"
print "Open Grafana:           http://localhost:3000"
print ""
print "Workshop next step: run one GitHub Copilot Chat or agent request in this repository, then click Refresh in the mini app."
