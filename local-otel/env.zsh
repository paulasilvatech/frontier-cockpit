# Optional user-level OpenTelemetry environment for GitHub Copilot Chat, agent hosts, and local dev agents.
# The client bootstrap writes ~/.frontier-cockpit/otel.env; this file remains for zsh users who prefer
# sourcing from the repository. Content capture stays off by default for privacy.

export COPILOT_OTEL_ENABLED="true"
export COPILOT_OTEL_ENDPOINT="http://localhost:4318"
export COPILOT_OTEL_PROTOCOL="http"
export COPILOT_OTEL_CAPTURE_CONTENT="${FRONTIER_ENABLE_CONTENT_CAPTURE:-false}"
export COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS="0"
export COPILOT_MATERIALIZE_CONTENT="${FRONTIER_ENABLE_CONTENT_CAPTURE:-false}"
export COPILOT_MATERIALIZE_TRACE_LIMIT="1000"
export OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="${FRONTIER_ENABLE_CONTENT_CAPTURE:-false}"
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
export COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES="${FRONTIER_BASE_RESOURCE_ATTRIBUTES:-environment=local,collection.scope=user}"
export OTEL_RESOURCE_ATTRIBUTES="$COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES"

# Allows Claude Code subprocess telemetry to use the same standard OTel endpoint when supported.
export CLAUDE_CODE_ENABLE_TELEMETRY="true"

if [[ -f "${0:A:h}/workspace-tags.zsh" ]]; then
	source "${0:A:h}/workspace-tags.zsh"
fi
