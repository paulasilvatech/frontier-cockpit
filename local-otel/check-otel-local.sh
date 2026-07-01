#!/usr/bin/env zsh
set -u

settings_file="$HOME/Library/Application Support/Code - Insiders/User/settings.json"
fail=0

ok() { print "PASS  $1"; }
warn() { print "WARN  $1"; }
err() { print "FAIL  $1"; fail=1; }

if command -v docker >/dev/null 2>&1; then
  ok "Docker CLI found: $(docker --version)"
  if docker info >/dev/null 2>&1; then
    ok "Docker daemon is running."
    full_stack=0
    if docker ps --format '{{.Names}}' | grep -qx 'copilot-otel-collector'; then
      full_stack=1
      ok "OpenTelemetry Collector container is running."
      collector_grpc_port="$(docker port copilot-otel-collector 4317/tcp 2>/dev/null || true)"
      collector_http_port="$(docker port copilot-otel-collector 4318/tcp 2>/dev/null || true)"
      if [[ "$collector_grpc_port" == *":4317"* ]]; then
        ok "Collector OTLP gRPC port is mapped on localhost:4317."
      else
        err "Collector OTLP gRPC port is not mapped on localhost:4317. Run $HOME/frontier-cockpit/local-otel/start-full-stack.sh"
      fi
      if [[ "$collector_http_port" == *":4318"* ]]; then
        ok "Collector OTLP HTTP port is mapped on localhost:4318."
      else
        err "Collector OTLP HTTP port is not mapped on localhost:4318. Run $HOME/frontier-cockpit/local-otel/start-full-stack.sh"
      fi
    fi

    if docker ps --format '{{.Names}}' | grep -qx 'aspire-dashboard'; then
      ok "Aspire Dashboard container is running."
      if [[ "$full_stack" -eq 0 ]]; then
        grpc_port="$(docker port aspire-dashboard 18889/tcp 2>/dev/null || true)"
        http_port="$(docker port aspire-dashboard 18890/tcp 2>/dev/null || true)"
        if [[ "$grpc_port" == *":4317"* ]]; then
          ok "Aspire OTLP gRPC port is mapped on localhost:4317."
        else
          err "Aspire OTLP gRPC port is not mapped on localhost:4317. Run $HOME/frontier-cockpit/local-otel/start-aspire-dashboard.sh to recreate the container."
        fi
        if [[ "$http_port" == *":4318"* ]]; then
          ok "Aspire OTLP HTTP port is mapped on localhost:4318."
        else
          err "Aspire OTLP HTTP port is not mapped on localhost:4318."
        fi
      fi
    else
      err "Aspire Dashboard container is not running. Run $HOME/frontier-cockpit/local-otel/start-aspire-dashboard.sh"
    fi

    if [[ "$full_stack" -eq 1 ]]; then
      for container_name in copilot-otel-tempo copilot-otel-loki copilot-otel-prometheus copilot-otel-grafana copilot-otel-postgres; do
        if docker ps --format '{{.Names}}' | grep -qx "$container_name"; then
          ok "$container_name container is running."
        else
          err "$container_name container is not running. Run $HOME/frontier-cockpit/local-otel/start-full-stack.sh"
        fi
      done
      postgres_health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' copilot-otel-postgres 2>/dev/null || true)"
      if [[ "$postgres_health" == "healthy" ]]; then
        ok "PostgreSQL backing Grafana is healthy."
      else
        err "PostgreSQL backing Grafana is not healthy (status: ${postgres_health:-unknown})."
      fi
    fi
  else
    err "Docker daemon is not running. Start Docker Desktop."
  fi
else
  err "Docker CLI was not found."
fi

if command -v nc >/dev/null 2>&1 && nc -z localhost 4317 >/dev/null 2>&1; then
  ok "OTLP gRPC endpoint is reachable on localhost:4317."
else
  warn "OTLP gRPC endpoint did not respond on localhost:4317."
fi

if curl -fsS http://localhost:18888 >/dev/null 2>&1; then
  ok "Aspire Dashboard responds on http://localhost:18888"
else
  warn "Aspire Dashboard UI did not respond yet on http://localhost:18888"
fi

trace_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST http://localhost:4318/v1/traces -H 'Content-Type: application/json' --data '{}' 2>/dev/null || true)"
if [[ "$trace_status" == "400" || "$trace_status" == "415" || "$trace_status" == "200" ]]; then
  ok "OTLP HTTP traces endpoint is reachable on http://localhost:4318/v1/traces (HTTP $trace_status)."
else
  warn "OTLP HTTP traces endpoint did not respond as expected (HTTP ${trace_status:-none})."
fi

if docker ps --format '{{.Names}}' 2>/dev/null | grep -qx 'copilot-otel-collector'; then
  if curl -fsS http://localhost:3000/api/health >/dev/null 2>&1; then
    ok "Grafana responds on http://localhost:3000"
  else
    warn "Grafana did not respond yet on http://localhost:3000"
  fi

  if curl -fsS http://localhost:9090/-/ready >/dev/null 2>&1; then
    ok "Prometheus responds on http://localhost:9090"
  else
    warn "Prometheus did not respond yet on http://localhost:9090"
  fi

  if curl -fsS http://localhost:3200/ready >/dev/null 2>&1; then
    ok "Tempo responds on http://localhost:3200"
  else
    warn "Tempo did not respond yet on http://localhost:3200"
  fi

  if curl -fsS http://localhost:3100/ready >/dev/null 2>&1; then
    ok "Loki responds on http://localhost:3100"
  else
    warn "Loki did not respond yet on http://localhost:3100"
  fi
fi

if [[ -f "$settings_file" ]]; then
  python3 - <<'PY'
from pathlib import Path
import json
p = Path.home() / "Library/Application Support/Code - Insiders/User/settings.json"
settings = json.loads(p.read_text(encoding="utf-8"))
required = {
    "github.copilot.chat.otel.enabled": True,
    "github.copilot.chat.otel.exporterType": "otlp-http",
    "github.copilot.chat.otel.otlpEndpoint": "http://localhost:4318",
    "github.copilot.chat.otel.captureContent": True,
    "github.copilot.chat.otel.dbSpanExporter.enabled": True,
  "chat.agentHost.otel.enabled": True,
  "chat.agentHost.otel.captureContent": True,
  "chat.agentHost.otel.dbSpanExporter.enabled": True,
}
failed = False
for key, expected in required.items():
    actual = settings.get(key)
    if actual == expected:
        print(f"PASS  {key} = {actual!r}")
    else:
        print(f"FAIL  {key} expected {expected!r}, got {actual!r}")
        failed = True
terminal_env = settings.get("terminal.integrated.env.osx", {})
terminal_required = {
  "COPILOT_OTEL_ENABLED": "true",
  "COPILOT_OTEL_ENDPOINT": "http://localhost:4318",
  "COPILOT_OTEL_PROTOCOL": "http",
  "COPILOT_OTEL_CAPTURE_CONTENT": "true",
  "COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS": "0",
  "COPILOT_MATERIALIZE_CONTENT": "true",
  "COPILOT_MATERIALIZE_TRACE_LIMIT": "1000",
  "OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT": "true",
  "OTEL_EXPORTER_OTLP_ENDPOINT": "http://localhost:4318",
  "OTEL_EXPORTER_OTLP_PROTOCOL": "http/protobuf",
  "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT": "http://localhost:4318/v1/traces",
  "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT": "http://localhost:4318/v1/metrics",
  "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "http://localhost:4318/v1/logs",
  "OTEL_EXPORTER_OTLP_TRACES_PROTOCOL": "http/protobuf",
  "OTEL_EXPORTER_OTLP_METRICS_PROTOCOL": "http/protobuf",
  "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/protobuf",
  "OTEL_TRACES_EXPORTER": "otlp",
  "OTEL_METRICS_EXPORTER": "otlp",
  "OTEL_LOGS_EXPORTER": "otlp",
  "CLAUDE_CODE_ENABLE_TELEMETRY": "true",
}
for key, expected in terminal_required.items():
  actual = terminal_env.get(key)
  if actual == expected:
    print(f"PASS  terminal.integrated.env.osx.{key} = {actual!r}")
  else:
    print(f"FAIL  terminal.integrated.env.osx.{key} expected {expected!r}, got {actual!r}")
    failed = True
raise SystemExit(1 if failed else 0)
PY
  if [[ "$?" -eq 0 ]]; then
    ok "VS Code Insiders user settings are configured for local OTel."
  else
    err "VS Code Insiders user settings need attention."
  fi
else
  err "VS Code Insiders user settings file was not found."
fi

agent_host_db="$HOME/Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat/agent-traces.db"
if [[ -f "$agent_host_db" ]]; then
  span_count="$(sqlite3 "$agent_host_db" 'select count(*) from spans;' 2>/dev/null || print 0)"
  if [[ "$span_count" -gt 0 ]]; then
    ok "VS Code Agent Host OTel SQLite DB is present with $span_count spans."
  else
    warn "VS Code Agent Host OTel SQLite DB is present but has no spans yet."
  fi
else
  warn "VS Code Agent Host OTel SQLite DB was not found yet. Use GitHub Copilot Chat after dbSpanExporter is enabled."
fi

for name in COPILOT_OTEL_ENABLED COPILOT_OTEL_ENDPOINT COPILOT_MATERIALIZE_CONTENT COPILOT_MATERIALIZE_TRACE_LIMIT OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT OTEL_EXPORTER_OTLP_ENDPOINT OTEL_EXPORTER_OTLP_TRACES_ENDPOINT OTEL_EXPORTER_OTLP_METRICS_ENDPOINT OTEL_EXPORTER_OTLP_LOGS_ENDPOINT OTEL_TRACES_EXPORTER OTEL_METRICS_EXPORTER OTEL_LOGS_EXPORTER CLAUDE_CODE_ENABLE_TELEMETRY; do
  value="$(launchctl getenv "$name" 2>/dev/null || true)"
  if [[ -n "$value" ]]; then
    ok "launchd user environment $name is set."
  else
    err "launchd user environment $name is not set. Run $HOME/frontier-cockpit/local-otel/enable-user-env.sh"
  fi
done

launchagent_template_dir="$HOME/frontier-cockpit/local-otel/launchagents"
launchagent_target_dir="$HOME/Library/LaunchAgents"
expected_launchagents=(
  com.frontier.copilot-otel-env
  com.frontier.copilot-otel-autostart
  com.frontier.copilot-otel-coverage
  com.frontier.copilot-otel-materializer
  com.frontier.copilot-otel-vscode-memory
  com.frontier.copilot-otel-daily-rollup
  com.frontier.copilot-otel-github-enterprise
  com.frontier.copilot-otel-github-orgs
  com.frontier.copilot-otel-github-audit-stream-renewal
)

if [[ -d "$launchagent_template_dir" ]]; then
  ok "Versioned LaunchAgent templates are present."
  for label in $expected_launchagents; do
    if [[ -f "$launchagent_template_dir/$label.plist" ]]; then
      ok "LaunchAgent template $label is present."
    else
      warn "LaunchAgent template $label is missing from $launchagent_template_dir."
    fi
    if [[ -f "$launchagent_target_dir/$label.plist" ]]; then
      ok "LaunchAgent $label is installed for this user."
    else
      warn "LaunchAgent $label is not installed. Run $HOME/frontier-cockpit/local-otel/install-launchagents.sh to enable scheduled automation."
    fi
  done
else
  warn "Versioned LaunchAgent templates directory is missing: $launchagent_template_dir"
fi

if [[ "$OTEL_RESOURCE_ATTRIBUTES" == *"workspace.name="* ]]; then
  ok "Current shell OTEL_RESOURCE_ATTRIBUTES includes workspace.name."
else
  warn "Current shell OTEL_RESOURCE_ATTRIBUTES does not include workspace.name. Open a new shell or source $HOME/frontier-cockpit/local-otel/env.zsh."
fi

if [[ "$OTEL_RESOURCE_ATTRIBUTES" == *"workspace.kind="* ]]; then
  ok "Current shell OTEL_RESOURCE_ATTRIBUTES includes workspace.kind."
else
  warn "Current shell OTEL_RESOURCE_ATTRIBUTES does not include workspace.kind."
fi

if [[ "$OTEL_RESOURCE_ATTRIBUTES" == *"github.copilot.git.repository="* || "$OTEL_RESOURCE_ATTRIBUTES" == *"git.repository.name="* ]]; then
  ok "Current shell OTEL_RESOURCE_ATTRIBUTES includes repository tags."
else
  warn "Current shell OTEL_RESOURCE_ATTRIBUTES does not include repository tags. This is expected outside a Git repository."
fi

print ""
if [[ "$fail" -eq 0 ]]; then
  print "Local OTel setup is ready. Reload VS Code Insiders, run a GitHub Copilot Chat agent request, then inspect Traces in http://localhost:18888."
else
  print "Local OTel setup is not fully ready yet. Fix the FAIL items above and rerun this check."
fi

exit "$fail"
