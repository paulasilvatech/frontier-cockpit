#!/usr/bin/env zsh
set -euo pipefail

export COPILOT_OTEL_DISABLE_DYNAMIC_WORKSPACE_TAGS="true"
source "${0:A:h}/env.zsh"
unset COPILOT_OTEL_DISABLE_DYNAMIC_WORKSPACE_TAGS

# LaunchAgents start from `/`, so dynamic workspace tags would otherwise make
# GUI apps inherit `workspace.path_hash` for the filesystem root. Keep the
# global launchd environment base-only. Per-window attribution does not rely on
# this global environment: register-all-workspaces.sh records every local repo's
# HEAD commits, and materialize-copilot-sessions.sh matches each session's
# per-window commit hash back to the right workspace.
export OTEL_RESOURCE_ATTRIBUTES="${COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES:-team.id=platform,department=engineering,environment=local,collection.scope=user,workshop=true}"

vars=(
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
  CLAUDE_CODE_ENABLE_TELEMETRY
)

for name in $vars; do
  launchctl setenv "$name" "${(P)name}"
done

print "User launchd OpenTelemetry environment is enabled for apps started after this point."
print "Restart VS Code Insiders windows to guarantee the new environment is inherited."
