# User-level OpenTelemetry environment for GitHub Copilot Chat, agent hosts, and local dev agents.
# Sourced by ~/.zshrc and can also be loaded into macOS launchd with enable-user-env.sh.

export COPILOT_OTEL_ENABLED="true"
export COPILOT_OTEL_ENDPOINT="http://localhost:4318"
export COPILOT_OTEL_PROTOCOL="http"
export COPILOT_OTEL_CAPTURE_CONTENT="true"
export COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS="0"
export COPILOT_MATERIALIZE_CONTENT="true"
export COPILOT_MATERIALIZE_TRACE_LIMIT="1000"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="true"
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
export COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES="team.id=platform,department=engineering,environment=local,collection.scope=user,workshop=true"
export OTEL_RESOURCE_ATTRIBUTES="$COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES"

# Allows Claude Code subprocess telemetry to use the same standard OTel endpoint when supported.
export CLAUDE_CODE_ENABLE_TELEMETRY="true"

if [[ -f "$HOME/frontier-cockpit/local-otel/workspace-tags.zsh" ]]; then
	source "$HOME/frontier-cockpit/local-otel/workspace-tags.zsh"
fi
