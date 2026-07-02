#!/usr/bin/env zsh
set -euo pipefail

# Audit local GitHub Copilot OTel coverage against the VS Code monitoring article.
# Emits coverage metadata to Prometheus through OTLP so Grafana can show observed/missing
# status. This is audit metadata only, not usage telemetry.

metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
tempo_url="${TEMPO_URL:-http://localhost:3200}"
loki_url="${LOKI_URL:-http://localhost:3100}"
if [[ "$(uname -s)" == "Darwin" ]]; then
  vscode_config_root="$HOME/Library/Application Support"
else
  vscode_config_root="${XDG_CONFIG_HOME:-$HOME/.config}"
fi
settings_file="${FRONTIER_VSCODE_SETTINGS_FILE:-$vscode_config_root/Code - Insiders/User/settings.json}"

python3 - "$metrics_endpoint" "$prometheus_url" "$tempo_url" "$loki_url" "$settings_file" <<'PY'
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

metrics_endpoint, prometheus_url, tempo_url, loki_url, settings_file = sys.argv[1:]

EXPECTED_PROM_METRICS = {
    "GenAI metric": {
        "gen_ai.client.operation.duration": ["gen_ai_client_operation_duration_bucket", "gen_ai_client_operation_duration_count", "gen_ai_client_operation_duration_sum"],
        "gen_ai.client.token.usage": ["gen_ai_client_token_usage_bucket", "gen_ai_client_token_usage_count", "gen_ai_client_token_usage_sum"],
    },
    "Extension metric": {
        "copilot_chat.tool.call.count": ["copilot_chat_tool_call_count_total"],
        "copilot_chat.tool.call.duration": ["copilot_chat_tool_call_duration_bucket", "copilot_chat_tool_call_duration_count", "copilot_chat_tool_call_duration_sum"],
        "copilot_chat.agent.invocation.duration": ["copilot_chat_agent_invocation_duration_bucket", "copilot_chat_agent_invocation_duration_count", "copilot_chat_agent_invocation_duration_sum"],
        "copilot_chat.agent.turn.count": ["copilot_chat_agent_turn_count_bucket", "copilot_chat_agent_turn_count_count", "copilot_chat_agent_turn_count_sum"],
        "copilot_chat.session.count": ["copilot_chat_session_count_total"],
        "copilot_chat.time_to_first_token": ["copilot_chat_time_to_first_token_bucket", "copilot_chat_time_to_first_token_count", "copilot_chat_time_to_first_token_sum"],
        "copilot_chat.edit.acceptance.count": ["copilot_chat_edit_acceptance_count_total"],
        "copilot_chat.chat_edit.outcome.count": ["copilot_chat_chat_edit_outcome_count_total"],
        "copilot_chat.lines_of_code.count": ["copilot_chat_lines_of_code_count_total"],
        "copilot_chat.edit.survival.four_gram": ["copilot_chat_edit_survival_four_gram_bucket", "copilot_chat_edit_survival_four_gram_count", "copilot_chat_edit_survival_four_gram_sum"],
        "copilot_chat.edit.survival.no_revert": ["copilot_chat_edit_survival_no_revert_bucket", "copilot_chat_edit_survival_no_revert_count", "copilot_chat_edit_survival_no_revert_sum"],
        "copilot_chat.user.action.count": ["copilot_chat_user_action_count_total"],
        "copilot_chat.user.feedback.count": ["copilot_chat_user_feedback_count_total"],
        "copilot_chat.agent.edit_response.count": ["copilot_chat_agent_edit_response_count_total"],
        "copilot_chat.agent.summarization.count": ["copilot_chat_agent_summarization_count_total"],
        "copilot_chat.pull_request.count": ["copilot_chat_pull_request_count_total"],
        "copilot_chat.cloud.session.count": ["copilot_chat_cloud_session_count_total"],
        "copilot_chat.cloud.pr_ready.count": ["copilot_chat_cloud_pr_ready_count_total"],
    },
}

EXPECTED_TEMPO_TAGS = {
    "invoke_agent span attributes": [
        "gen_ai.operation.name", "gen_ai.provider.name", "gen_ai.agent.name", "gen_ai.conversation.id",
        "gen_ai.request.model", "gen_ai.response.model", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens",
        "gen_ai.usage.cache_read.input_tokens", "gen_ai.usage.cache_creation.input_tokens", "github.copilot.agent.type",
        "github.copilot.git.repository", "github.copilot.git.branch", "github.copilot.git.commit_sha",
        "github.copilot.github.org", "copilot_chat.repo.remote_url", "copilot_chat.repo.head_branch_name",
        "copilot_chat.repo.head_commit_hash", "copilot_chat.turn_count", "error.type",
        "gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.tool.definitions",
    ],
    "chat span attributes": [
        "gen_ai.operation.name", "gen_ai.provider.name", "gen_ai.request.model", "gen_ai.response.model",
        "gen_ai.response.finish_reasons", "gen_ai.request.max_tokens", "gen_ai.request.temperature",
        "gen_ai.request.top_p", "gen_ai.usage.input_tokens", "gen_ai.usage.output_tokens",
        "gen_ai.usage.cache_read.input_tokens", "gen_ai.usage.cache_creation.input_tokens",
        "gen_ai.usage.reasoning.output_tokens", "gen_ai.usage.reasoning_tokens", "copilot_chat.time_to_first_token",
        "server.address", "error.type",
    ],
    "execute_tool span attributes": [
        "gen_ai.operation.name", "gen_ai.tool.name", "gen_ai.tool.type", "gen_ai.tool.call.id",
        "github.copilot.tool.parameters.edit_type", "github.copilot.tool.parameters.skill_name",
        "github.copilot.tool.parameters.mcp_server_name_hash", "github.copilot.tool.parameters.mcp_tool_name",
        "github.copilot.tool.parameters.command", "github.copilot.tool.parameters.file_path",
        "github.copilot.tool.parameters.mcp_server_name", "error.type", "gen_ai.tool.call.arguments", "gen_ai.tool.call.result",
    ],
    "execute_hook span attributes": [
        "gen_ai.operation.name", "github.copilot.hook.decision", "github.copilot.hook.duration",
        "github.copilot.hook.tool_names", "copilot_chat.hook_type", "copilot_chat.hook_result_kind",
        "copilot_chat.hook_input", "copilot_chat.hook_output", "error.type",
    ],
    "resource attributes": [
        "service.name", "service.version", "session.id", "team.id", "department", "workspace.name", "workspace.kind", "workspace.path_hash",
    ],
    "content capture attributes": [
        "gen_ai.input.messages", "gen_ai.output.messages", "gen_ai.tool.definitions", "gen_ai.tool.call.arguments", "gen_ai.tool.call.result",
    ],
    "context and cost attributes": [
        "copilot_chat.request.max_prompt_tokens", "copilot_chat.copilot_usage_nano_aiu",
        "github.copilot.cost", "github.copilot.aiu", "github.copilot.turn_count",
        "github.copilot.server_duration", "github.copilot.initiator", "github.copilot.turn_id",
        "github.copilot.interaction_id", "turnId",
    ],
    "compaction and memory attributes": [
        "github.copilot.token_limit", "github.copilot.pre_tokens", "github.copilot.post_tokens",
        "github.copilot.tokens_removed", "github.copilot.messages_removed", "github.copilot.performed_by",
        "github.copilot.message", "github.copilot.success",
    ],
    "event-like attributes": [
        "copilot_chat.event_category", "copilot_chat.event_details", "copilot_chat.user_request",
        "github.copilot.session.truncation", "github.copilot.session.compaction_start",
        "github.copilot.session.compaction_complete", "github.copilot.skill.invoked",
        "github.copilot.session.shutdown", "github.copilot.session.abort",
    ],
}

EXPECTED_SETTINGS = {
    "github.copilot.chat.otel.enabled": True,
    "github.copilot.chat.otel.exporterType": "otlp-http",
    "github.copilot.chat.otel.otlpEndpoint": "http://localhost:4318",
    "github.copilot.chat.otel.captureContent": True,
    "github.copilot.chat.otel.dbSpanExporter.enabled": True,
    "chat.agentHost.otel.enabled": True,
    "chat.agentHost.otel.captureContent": True,
    "chat.agentHost.otel.dbSpanExporter.enabled": True,
}


def get_json(url):
    with urllib.request.urlopen(url, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def post_json(url, payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(request, timeout=10) as response:
        response.read()

prom_metric_names = set(get_json(f"{prometheus_url}/api/v1/label/__name__/values").get("data", []))
tempo_tags = set(get_json(f"{tempo_url}/api/search/tags").get("tagNames", []))
try:
    loki_labels = set(get_json(f"{loki_url}/loki/api/v1/labels").get("data", []))
except Exception:
    loki_labels = set()
try:
    settings = json.loads(pathlib.Path(settings_file).read_text(encoding="utf-8"))
except Exception:
    settings = {}

rows = []

def add(category, item, observed, backend, expected="", note=""):
    rows.append({
        "category": category,
        "item": item,
        "observed": bool(observed),
        "status": "observed" if observed else "not_observed_yet",
        "backend": backend,
        "expected": expected,
        "note": note,
    })

for category, metrics in EXPECTED_PROM_METRICS.items():
    for item, names in metrics.items():
        observed = any(name in prom_metric_names for name in names)
        add(category, item, observed, "Prometheus", ",".join(names), "Metric appears only after the matching local behavior is used.")

for category, tags in EXPECTED_TEMPO_TAGS.items():
    for tag in tags:
        add(category, tag, tag in tempo_tags, "Tempo", tag, "Trace attribute appears only after a span carrying it is emitted.")

for key, expected_value in EXPECTED_SETTINGS.items():
    add("VS Code setting", key, settings.get(key) == expected_value, "VS Code User Settings", str(expected_value), "Setting must be enabled for future sessions.")

for label in ["service_name"]:
    add("Logs/events backend", f"Loki label {label}", label in loki_labels, "Loki", label, "Loki labels are sparse until logs/events with attributes are emitted.")

now = str(time.time_ns())

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value)}}

data_points = []
for row in rows:
    data_points.append({
        "timeUnixNano": now,
        "asInt": "1" if row["observed"] else "0",
        "attributes": [
            attr("category", row["category"]),
            attr("item", row["item"]),
            attr("status", row["status"]),
            attr("backend", row["backend"]),
            attr("expected", row["expected"]),
            attr("note", row["note"]),
            attr("audit_only", "true"),
        ],
    })

payload = {
    "resourceMetrics": [
        {
            "resource": {
                "attributes": [
                    attr("service.name", "copilot-otel-coverage-audit"),
                    attr("service.version", "1.0.0"),
                    attr("environment", "local"),
                    attr("collection.scope", "user"),
                ]
            },
            "scopeMetrics": [
                {
                    "scope": {"name": "copilot-otel-coverage-audit"},
                    "metrics": [
                        {
                            "name": "copilot_otel_coverage_status",
                            "description": "Coverage audit metadata for local GitHub Copilot OTel. Not usage telemetry.",
                            "unit": "1",
                            "gauge": {"dataPoints": data_points},
                        }
                    ],
                }
            ],
        }
    ]
}

post_json(metrics_endpoint, payload)

observed = sum(1 for row in rows if row["observed"])
print(f"coverage_items={len(rows)} observed={observed} not_observed_yet={len(rows)-observed}")
for row in rows:
    marker = "OBSERVED" if row["observed"] else "NOT_OBSERVED_YET"
    print(f"{marker}\t{row['category']}\t{row['item']}\t{row['backend']}")
PY
