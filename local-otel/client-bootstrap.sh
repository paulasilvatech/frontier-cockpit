#!/usr/bin/env bash
set -euo pipefail

# Cross-platform POSIX bootstrap for Frontier Cockpit Local clients.
# Supports macOS and Linux. Use client-bootstrap.ps1 on Windows.

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stack_dir="$script_dir/stack"
config_file="$script_dir/client.env"
skip_vscode_settings="false"
skip_user_env="false"
skip_workspace_register="false"
skip_validation="false"
build_flag="--build"
caller_dir="$PWD"

usage() {
  cat <<EOF
Frontier Cockpit Local client bootstrap

Usage:
  bash local-otel/client-bootstrap.sh [options]

Options:
  --config PATH              Use a custom client env file.
  --no-build                 Start Docker Compose without rebuilding images.
  --skip-vscode-settings     Do not update VS Code user settings.
  --skip-user-env            Do not persist user-level OTel environment variables.
  --skip-workspace-register  Do not emit the workspace registry metric.
  --skip-validation          Do not validate local endpoints after startup.
  -h, --help                 Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --config)
      config_file="${2:-}"
      if [[ -z "$config_file" ]]; then
        echo "FAIL  --config requires a path." >&2
        exit 2
      fi
      shift 2
      ;;
    --no-build)
      build_flag=""
      shift
      ;;
    --skip-vscode-settings)
      skip_vscode_settings="true"
      shift
      ;;
    --skip-user-env)
      skip_user_env="true"
      shift
      ;;
    --skip-workspace-register)
      skip_workspace_register="true"
      shift
      ;;
    --skip-validation)
      skip_validation="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "FAIL  Unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

info() { printf '\n==> %s\n' "$1"; }
ok() { printf 'PASS  %s\n' "$1"; }
warn() { printf 'WARN  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1" >&2; exit 1; }

if [[ ! -f "$config_file" ]]; then
  if [[ -f "$script_dir/client.env.example" ]]; then
    cp "$script_dir/client.env.example" "$script_dir/client.env"
    warn "Created $script_dir/client.env from client.env.example. Edit it for the client, then rerun if needed."
    config_file="$script_dir/client.env"
  else
    fail "Missing config file: $config_file"
  fi
fi

set -a
# shellcheck disable=SC1090
source "$config_file"
set +a

FRONTIER_PARTICIPANT_NAME="${FRONTIER_PARTICIPANT_NAME:-Client Developer}"
FRONTIER_PARTICIPANT_ROLE="${FRONTIER_PARTICIPANT_ROLE:-Developer}"
FRONTIER_PARTICIPANT_EMAIL="${FRONTIER_PARTICIPANT_EMAIL:-}"
FRONTIER_PARTICIPANT_TEAM="${FRONTIER_PARTICIPANT_TEAM:-}"
FRONTIER_CUSTOMER_NAME="${FRONTIER_CUSTOMER_NAME:-Client Organization}"
FRONTIER_DASHBOARD_TITLE="${FRONTIER_DASHBOARD_TITLE:-Frontier Cockpit Local}"
FRONTIER_COPILOT_PLAN="${FRONTIER_COPILOT_PLAN:-business}"
FRONTIER_COPILOT_SEATS="${FRONTIER_COPILOT_SEATS:-1}"
FRONTIER_AI_CREDITS_USE_PROMO="${FRONTIER_AI_CREDITS_USE_PROMO:-false}"
FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE="${FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE:-}"
FRONTIER_VSCODE_CHANNELS="${FRONTIER_VSCODE_CHANNELS:-stable,insiders}"
FRONTIER_ENABLE_CONTENT_CAPTURE="${FRONTIER_ENABLE_CONTENT_CAPTURE:-false}"

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
  elif command -v python >/dev/null 2>&1; then
    command -v python
  else
    return 1
  fi
}

python_cmd="$(find_python || true)"
if [[ -z "$python_cmd" ]]; then
  fail "Python 3 is required for JSON settings and OTLP bootstrap payloads."
fi

sanitize_attr() {
  printf '%s' "$1" | tr ',' ' ' | tr '\n\r' '  '
}

export COPILOT_OTEL_ENABLED="true"
export COPILOT_OTEL_ENDPOINT="http://localhost:4318"
export COPILOT_OTEL_PROTOCOL="http"
export COPILOT_OTEL_CAPTURE_CONTENT="$FRONTIER_ENABLE_CONTENT_CAPTURE"
export COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS="0"
export COPILOT_MATERIALIZE_CONTENT="$FRONTIER_ENABLE_CONTENT_CAPTURE"
export COPILOT_MATERIALIZE_TRACE_LIMIT="1000"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="$FRONTIER_ENABLE_CONTENT_CAPTURE"
export COPILOT_OTEL_LOG_LEVEL="info"
export COPILOT_OTEL_HTTP_INSTRUMENTATION="true"
export OTEL_EXPORTER_OTLP_ENDPOINT="http://localhost:4318"
export OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_TRACES_ENDPOINT="http://localhost:4318/v1/traces"
export OTEL_EXPORTER_OTLP_METRICS_ENDPOINT="http://localhost:4318/v1/metrics"
export OTEL_EXPORTER_OTLP_LOGS_ENDPOINT="http://localhost:4318/v1/logs"
export OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_METRICS_PROTOCOL="http/protobuf"
export OTEL_EXPORTER_OTLP_LOGS_PROTOCOL="http/protobuf"
export OTEL_TRACES_EXPORTER="otlp"
export OTEL_METRICS_EXPORTER="otlp"
export OTEL_LOGS_EXPORTER="otlp"
frontier_customer_attr="$(sanitize_attr "$FRONTIER_CUSTOMER_NAME")"
frontier_team_attr="$(sanitize_attr "$FRONTIER_PARTICIPANT_TEAM")"
export OTEL_RESOURCE_ATTRIBUTES="service.namespace=frontier-cockpit,environment=local,collection.scope=user,frontier.customer=$frontier_customer_attr,frontier.team=$frontier_team_attr"

otel_vars=(
  COPILOT_OTEL_ENABLED
  COPILOT_OTEL_ENDPOINT
  COPILOT_OTEL_PROTOCOL
  COPILOT_OTEL_CAPTURE_CONTENT
  COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS
  COPILOT_MATERIALIZE_CONTENT
  COPILOT_MATERIALIZE_TRACE_LIMIT
  OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT
  COPILOT_OTEL_LOG_LEVEL
  COPILOT_OTEL_HTTP_INSTRUMENTATION
  OTEL_EXPORTER_OTLP_ENDPOINT
  OTEL_EXPORTER_OTLP_PROTOCOL
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT
  OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
  OTEL_EXPORTER_OTLP_LOGS_ENDPOINT
  OTEL_EXPORTER_OTLP_TRACES_PROTOCOL
  OTEL_EXPORTER_OTLP_METRICS_PROTOCOL
  OTEL_EXPORTER_OTLP_LOGS_PROTOCOL
  OTEL_TRACES_EXPORTER
  OTEL_METRICS_EXPORTER
  OTEL_LOGS_EXPORTER
  OTEL_RESOURCE_ATTRIBUTES
)

write_user_env() {
  local env_dir="$HOME/.frontier-cockpit"
  local env_file="$env_dir/otel.env"
  mkdir -p "$env_dir"
  : > "$env_file"
  chmod 600 "$env_file"
  for name in "${otel_vars[@]}"; do
    local value="${!name}"
    value="${value//\\/\\\\}"
    value="${value//\"/\\\"}"
    value="${value//\$/\\\$}"
    printf 'export %s="%s"\n' "$name" "$value" >> "$env_file"
  done

  local block_start="# Frontier Cockpit Local OTel start"
  local block_end="# Frontier Cockpit Local OTel end"
  local block="${block_start}
if [ -f \"\$HOME/.frontier-cockpit/otel.env\" ]; then
  . \"\$HOME/.frontier-cockpit/otel.env\"
fi
${block_end}"

  local profiles=()
  case "${SHELL:-}" in
    *zsh*) profiles+=("$HOME/.zshrc") ;;
    *bash*) profiles+=("$HOME/.bashrc") ;;
  esac
  [[ -f "$HOME/.zshrc" ]] && profiles+=("$HOME/.zshrc")
  [[ -f "$HOME/.bashrc" ]] && profiles+=("$HOME/.bashrc")
  [[ ${#profiles[@]} -eq 0 ]] && profiles+=("$HOME/.profile")

  local seen=""
  for profile in "${profiles[@]}"; do
    [[ ",$seen," == *",$profile,"* ]] && continue
    seen="$seen,$profile"
    touch "$profile"
    if ! grep -q "$block_start" "$profile"; then
      printf '\n%s\n' "$block" >> "$profile"
      ok "Added OTel env source block to $profile."
    else
      ok "OTel env source block already exists in $profile."
    fi
  done

  if [[ "$(uname -s)" == "Darwin" ]] && command -v launchctl >/dev/null 2>&1; then
    for name in "${otel_vars[@]}"; do
      launchctl setenv "$name" "${!name}"
    done
    ok "Set macOS launchd user environment for GUI apps started after this run."
  fi

  ok "Wrote $env_file for GitHub Copilot CLI, Copilot SDK apps, and terminal-launched tools that honor OTEL_* variables."
}

apply_vscode_settings() {
  local settings_paths=()
  local os_name
  os_name="$(uname -s)"
  IFS=',' read -r -a channels <<< "$FRONTIER_VSCODE_CHANNELS"
  for channel in "${channels[@]}"; do
    channel="$(printf '%s' "$channel" | tr '[:upper:]' '[:lower:]' | xargs)"
    case "$os_name:$channel" in
      Darwin:stable) settings_paths+=("$HOME/Library/Application Support/Code/User/settings.json") ;;
      Darwin:insiders) settings_paths+=("$HOME/Library/Application Support/Code - Insiders/User/settings.json") ;;
      Linux:stable) settings_paths+=("${XDG_CONFIG_HOME:-$HOME/.config}/Code/User/settings.json") ;;
      Linux:insiders) settings_paths+=("${XDG_CONFIG_HOME:-$HOME/.config}/Code - Insiders/User/settings.json") ;;
    esac
  done

  if [[ ${#settings_paths[@]} -eq 0 ]]; then
    warn "No VS Code settings paths selected for this platform."
    return 0
  fi

  FRONTIER_VSCODE_SETTINGS_PATHS="$(IFS=:; echo "${settings_paths[*]}")" \
  FRONTIER_ENABLE_CONTENT_CAPTURE="$FRONTIER_ENABLE_CONTENT_CAPTURE" \
  "$python_cmd" - <<'PY'
import json
import os
import pathlib
import re
import shutil
import time

def strip_jsonc(text: str) -> str:
    output = []
    i = 0
    in_string = False
    escape = False
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if in_string:
            output.append(ch)
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_string = False
            i += 1
            continue
        if ch == '"':
            in_string = True
            output.append(ch)
            i += 1
            continue
        if ch == "/" and nxt == "/":
            while i < len(text) and text[i] not in "\r\n":
                i += 1
            continue
        if ch == "/" and nxt == "*":
            i += 2
            while i + 1 < len(text) and not (text[i] == "*" and text[i + 1] == "/"):
                i += 1
            i += 2
            continue
        output.append(ch)
        i += 1
    return re.sub(r",\s*([}\]])", r"\1", "".join(output))

capture = os.environ.get("FRONTIER_ENABLE_CONTENT_CAPTURE", "false").lower() == "true"
settings_update = {
    "github.copilot.chat.otel.enabled": True,
    "github.copilot.chat.otel.exporterType": "otlp-http",
    "github.copilot.chat.otel.otlpEndpoint": "http://localhost:4318",
    "github.copilot.chat.otel.captureContent": capture,
    "github.copilot.chat.otel.maxAttributeSizeChars": 0,
    "github.copilot.chat.otel.dbSpanExporter.enabled": True,
    "chat.agentHost.otel.enabled": True,
    "chat.agentHost.otel.captureContent": capture,
    "chat.agentHost.otel.dbSpanExporter.enabled": True,
}

for raw_path in os.environ["FRONTIER_VSCODE_SETTINGS_PATHS"].split(os.pathsep):
    path = pathlib.Path(raw_path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    if path.exists() and path.read_text(encoding="utf-8", errors="replace").strip():
        text = path.read_text(encoding="utf-8", errors="replace")
        backup = path.with_name(path.name + f".frontier-backup-{int(time.time())}")
        shutil.copy2(path, backup)
        try:
            data = json.loads(strip_jsonc(text))
        except Exception as exc:
            raise SystemExit(f"Could not parse {path}: {exc}. Backup written to {backup}.")
    data.update(settings_update)
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(f"PASS  Updated VS Code settings: {path}")
PY
}

ensure_docker() {
  if ! command -v docker >/dev/null 2>&1 && [[ "$(uname -s)" == "Darwin" ]] && [[ -x "/Applications/Docker.app/Contents/Resources/bin/docker" ]]; then
    export PATH="/Applications/Docker.app/Contents/Resources/bin:$PATH"
  fi
  command -v docker >/dev/null 2>&1 || fail "Docker CLI was not found. Install Docker Desktop or Docker Engine."
  docker info >/dev/null 2>&1 || fail "Docker is installed, but the daemon is not running. Start Docker and rerun."
  ok "Docker daemon is running."
}

ensure_aspire_key() {
  local key_file="$stack_dir/aspire-api-key.env"
  if [[ -f "$key_file" ]]; then
    return 0
  fi
  umask 077
  "$python_cmd" - <<'PY' > "$key_file"
import secrets
print(f"ASPIRE_DASHBOARD_API_KEY={secrets.token_urlsafe(32)}")
PY
  ok "Created local Aspire API key file."
}

ensure_grafana_admin() {
  local admin_file="$stack_dir/grafana-admin.env"
  if [[ -f "$admin_file" ]]; then
    return 0
  fi
  umask 077
  "$python_cmd" - <<'PY' > "$admin_file"
import secrets
print(f"GF_SECURITY_ADMIN_PASSWORD={secrets.token_urlsafe(24)}")
PY
  ok "Created local Grafana admin credentials. Username admin, password stored in $admin_file."
}

start_stack() {
  if docker ps --format '{{.Names}}' | grep -qx 'aspire-dashboard'; then
    local standalone_owns_otlp
    standalone_owns_otlp="$(docker port aspire-dashboard 18890/tcp 2>/dev/null || true)"
    if [[ "$standalone_owns_otlp" == *":4318"* ]]; then
      warn "Stopping standalone Aspire container to free OTLP ports for the Collector."
      docker stop aspire-dashboard >/dev/null 2>&1 || true
    fi
  fi

  set -a
  # shellcheck disable=SC1091
  source "$stack_dir/aspire-api-key.env"
  set +a

  export FRONTIER_PARTICIPANT_NAME FRONTIER_PARTICIPANT_ROLE FRONTIER_PARTICIPANT_EMAIL
  export FRONTIER_PARTICIPANT_TEAM FRONTIER_CUSTOMER_NAME FRONTIER_DASHBOARD_TITLE
  export FRONTIER_COPILOT_PLAN FRONTIER_COPILOT_SEATS FRONTIER_AI_CREDITS_USE_PROMO
  export FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE FRONTIER_ENABLE_CONTENT_CAPTURE

  (cd "$stack_dir" && docker compose -f docker-compose.yml up -d ${build_flag})
  ok "Docker Compose stack is starting."
}

emit_workspace_registry() {
  local workspace_path="$caller_dir"
  local workspace_kind="directory"
  local workspace_name
  workspace_name="$(basename "$workspace_path")"
  local git_branch=""
  local git_remote=""
  local git_head=""
  local git_heads=""

  if command -v git >/dev/null 2>&1 && git -C "$caller_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    workspace_path="$(git -C "$caller_dir" rev-parse --show-toplevel)"
    workspace_kind="git"
    workspace_name="$(basename "$workspace_path")"
    git_branch="$(git -C "$workspace_path" branch --show-current 2>/dev/null || true)"
    git_remote="$(git -C "$workspace_path" config --get remote.origin.url 2>/dev/null || true)"
    git_head="$(git -C "$workspace_path" rev-parse HEAD 2>/dev/null || true)"
    git_heads="$(git -C "$workspace_path" for-each-ref --format='%(objectname)' refs/heads 2>/dev/null | sort -u | tr '\n' ' ' | sed -e 's/  */ /g' -e 's/^ //' -e 's/ $//')"
  fi

  FRONTIER_WORKSPACE_PATH="$workspace_path" \
  FRONTIER_WORKSPACE_KIND="$workspace_kind" \
  FRONTIER_WORKSPACE_NAME="$workspace_name" \
  FRONTIER_GIT_BRANCH="$git_branch" \
  FRONTIER_GIT_REMOTE="$git_remote" \
  FRONTIER_GIT_HEAD="$git_head" \
  FRONTIER_GIT_HEADS="$git_heads" \
  "$python_cmd" - <<'PY'
import hashlib
import json
import os
import pathlib
import time
import urllib.request

endpoint = os.environ.get("OTEL_EXPORTER_OTLP_METRICS_ENDPOINT", "http://localhost:4318/v1/metrics")
workspace_path = os.environ["FRONTIER_WORKSPACE_PATH"]
workspace_name = os.environ["FRONTIER_WORKSPACE_NAME"]
workspace_kind = os.environ["FRONTIER_WORKSPACE_KIND"]
remote = os.environ.get("FRONTIER_GIT_REMOTE", "")
branch = os.environ.get("FRONTIER_GIT_BRANCH", "")
heads = " ".join(filter(None, [os.environ.get("FRONTIER_GIT_HEAD", ""), os.environ.get("FRONTIER_GIT_HEADS", "")]))
workspace_hash = hashlib.sha256(workspace_path.encode("utf-8")).hexdigest()
slug = remote[:-4] if remote.endswith(".git") else remote
if slug.startswith("git@github.com:"):
    slug = slug[len("git@github.com:"):]
elif slug.startswith("https://github.com/"):
    slug = slug[len("https://github.com/"):]
owner, _, repo = slug.partition("/")
repo_name = repo or pathlib.Path(workspace_path).name

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value or "unknown")}}

payload = {
    "resourceMetrics": [{
        "resource": {"attributes": [
            attr("service.name", "copilot-workspace-registry"),
            attr("service.version", "1.0.0"),
            attr("workspace.name", workspace_name),
            attr("workspace.kind", workspace_kind),
            attr("workspace.path_hash", workspace_hash),
            attr("git.branch", branch),
            attr("git.repository.owner", owner),
            attr("git.repository.name", repo_name),
            attr("github.copilot.git.repository", remote),
            attr("git.head_commit", heads),
        ]},
        "scopeMetrics": [{
            "scope": {"name": "frontier-client-bootstrap"},
            "metrics": [{
                "name": "copilot_workspace_registry",
                "description": "Friendly workspace registry for local GitHub Copilot OTel dashboards",
                "unit": "1",
                "gauge": {"dataPoints": [{"timeUnixNano": str(time.time_ns()), "asInt": "1", "attributes": []}]},
            }],
        }],
    }]
}
request = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request, timeout=15) as response:
    response.read()
print(f"PASS  Registered workspace {workspace_name} ({workspace_kind}) for local dashboards.")
PY
}

send_validation_span() {
  "$python_cmd" - <<'PY'
import json
import os
import time
import urllib.request

endpoint = os.environ.get("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", "http://localhost:4318/v1/traces")
trace_id = f"{time.time_ns():032x}"[-32:]
span_id = f"{time.time_ns() & ((1 << 64) - 1):016x}"
now = time.time_ns()

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}

payload = {
    "resourceSpans": [{
        "resource": {"attributes": [
            attr("service.name", "frontier-client-bootstrap"),
            attr("service.version", "1.0.0"),
            attr("frontier.customer", os.environ.get("FRONTIER_CUSTOMER_NAME", "unknown")),
        ]},
        "scopeSpans": [{
            "scope": {"name": "frontier-client-bootstrap"},
            "spans": [{
                "traceId": trace_id,
                "spanId": span_id,
                "name": "client_bootstrap_validation",
                "kind": 1,
                "startTimeUnixNano": str(now),
                "endTimeUnixNano": str(now + 1_000_000),
                "attributes": [attr("frontier.validation", "synthetic")],
            }],
        }],
    }]
}
request = urllib.request.Request(endpoint, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
with urllib.request.urlopen(request, timeout=15) as response:
    response.read()
print("PASS  Sent synthetic validation span.")
PY
}

wait_for_url() {
  local url="$1"
  local name="$2"
  local attempts=30
  local code=""
  for _ in $(seq 1 "$attempts"); do
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "$url" 2>/dev/null || true)"
    if [[ "$code" == "200" || "$code" == "302" || "$code" == "405" ]]; then
      ok "$name responds at $url (HTTP $code)."
      return 0
    fi
    sleep 2
  done
  warn "$name did not respond yet at $url (last HTTP ${code:-none})."
}

validate_endpoints() {
  wait_for_url "http://localhost:4318/v1/traces" "OTLP HTTP traces endpoint"
  wait_for_url "http://localhost:18888" "Aspire Dashboard"
  wait_for_url "http://localhost:3000/api/health" "Grafana"
  wait_for_url "http://localhost:9090/-/ready" "Prometheus"
  wait_for_url "http://localhost:3200/ready" "Tempo"
  wait_for_url "http://localhost:3100/ready" "Loki"
  wait_for_url "http://localhost:3300" "Frontier Cockpit Local mini app"
}

info "Resolve client configuration"
ok "config_file=$config_file"
ok "participant_name=$FRONTIER_PARTICIPANT_NAME"
ok "customer_name=$FRONTIER_CUSTOMER_NAME"

info "Configure local OpenTelemetry environment"
if [[ "$skip_user_env" == "false" ]]; then
  write_user_env
else
  warn "Skipped user-level OTel environment persistence."
fi

if [[ "$skip_vscode_settings" == "false" ]]; then
  info "Configure VS Code GitHub Copilot OTel settings"
  apply_vscode_settings
else
  warn "Skipped VS Code settings update."
fi

info "Start Docker Compose stack"
ensure_docker
ensure_aspire_key
ensure_grafana_admin
start_stack

info "Emit local validation telemetry"
send_validation_span || warn "Could not send synthetic validation span yet. The Collector may still be starting."
if [[ "$skip_workspace_register" == "false" ]]; then
  emit_workspace_registry || warn "Could not register workspace yet. Run from a Git repository after the stack is ready."
fi

if [[ "$skip_validation" == "false" ]]; then
  info "Validate local endpoints"
  validate_endpoints
fi

cat <<EOF

Frontier Cockpit Local is configured.

Open:
  Mini app:    http://localhost:3300
  Aspire:      http://localhost:18888
  Grafana:     http://localhost:3000
  Prometheus:  http://localhost:9090

Restart VS Code or VS Code Insiders, open the client Git repository, and run one GitHub Copilot Chat, agent, CLI, or SDK interaction.
Terminal-launched GitHub Copilot CLI and Copilot SDK workloads must start after the OTEL_* environment is loaded.
EOF