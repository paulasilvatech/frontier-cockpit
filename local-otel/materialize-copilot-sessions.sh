#!/usr/bin/env zsh
set -euo pipefail

# Materialize real copilot-chat Tempo traces into local Prometheus metrics and Loki logs.
# This does not create fake usage. It summarizes real Tempo traces so Grafana can filter by
# repository, branch, session, mode/shape, model label, token counts, and content-capture size.
# Raw content is materialized to local Loki by default. Azure forwarding still redacts raw
# content through the hybrid Collector overlay before enterprise ingestion.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"
metrics_endpoint="${OTEL_EXPORTER_OTLP_METRICS_ENDPOINT:-http://localhost:4318/v1/metrics}"
logs_endpoint="${OTEL_EXPORTER_OTLP_LOGS_ENDPOINT:-http://localhost:4318/v1/logs}"
tempo_url="${TEMPO_URL:-http://localhost:3200}"
show_content="${COPILOT_MATERIALIZE_CONTENT:-true}"
limit="${COPILOT_MATERIALIZE_TRACE_LIMIT:-1000}"
state_file="$HOME/frontier-cockpit/local-otel/materialized-traces.json"

python3 - "$tempo_url" "$metrics_endpoint" "$logs_endpoint" "$state_file" "$show_content" "$limit" <<'PY'
import base64
import hashlib
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
import urllib.request

tempo_url, metrics_endpoint, logs_endpoint, state_file, show_content, limit = sys.argv[1:]
show_content = show_content.lower() == "true"
limit = int(limit)
prometheus_url = os.environ.get("PROMETHEUS_URL", "http://localhost:9090")
force_replay = os.environ.get("COPILOT_MATERIALIZE_FORCE_REPLAY", "false").lower() == "true"
use_active_workspace = os.environ.get("COPILOT_MATERIALIZE_ACTIVE_WORKSPACE", "false").lower() == "true"
state_path = pathlib.Path(state_file)
if state_path.exists():
    try:
        state = json.loads(state_path.read_text())
    except Exception:
        state = {}
else:
    state = {}
seen = set() if force_replay else set(state.get("seen", []))
root_workspace_hash = hashlib.sha256(b"/").hexdigest()

def fetch_json(url):
    with urllib.request.urlopen(url, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))

def post_json(url, payload):
    data = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as response:
        response.read()

def attr(key, value):
    return {"key": key, "value": {"stringValue": str(value) if value not in (None, "") else "unknown"}}

def int_attr(key, value):
    try:
        return {"key": key, "value": {"intValue": int(value)}}
    except Exception:
        return {"key": key, "value": {"intValue": 0}}

def val(value):
    if "stringValue" in value: return value["stringValue"]
    if "intValue" in value: return value["intValue"]
    if "doubleValue" in value: return value["doubleValue"]
    if "boolValue" in value: return value["boolValue"]
    if "arrayValue" in value: return value["arrayValue"]
    if "kvlistValue" in value: return value["kvlistValue"]
    return value

def attr_map(items):
    return {a.get("key", ""): val(a.get("value", {})) for a in items}

def span_id_hex(span_id):
    try:
        return base64.b64decode(span_id).hex()
    except Exception:
        return span_id or "unknown"

def infer_mode_bucket(agent_name, request_shape, root_span_name):
    agent_name = str(agent_name or "unknown")
    root_span_name = str(root_span_name or "unknown")
    request_shape = str(request_shape or "unknown")
    if agent_name in ("XtabProvider", "nes.nextCursorPosition"):
        return "next_edit_suggestions"
    if "editAgent" in agent_name:
        return "edit"
    if agent_name == "executionSubagentTool":
        return "subagent"
    if agent_name == "backgroundTodoAgent":
        return "background_agent"
    if agent_name == "GitHub Copilot Chat":
        if str(root_span_name or "").startswith("invoke_agent"):
            return "agent"
        return "foreground_chat"
    if '"api":"responses"' in request_shape:
        return "responses_api_agentic"
    if '"api":"messages"' in request_shape:
        return "messages_api_chat"
    if root_span_name.startswith("chat"):
        return "chat"
    return "unknown"

def search_trace_ids(tags_query, query_limit):
    data = fetch_json(f"{tempo_url}/api/search?tags=" + urllib.parse.quote(tags_query) + f"&limit={query_limit}")
    return [t.get("traceID") for t in data.get("traces", []) if t.get("traceID")]

def meaningful(value):
    return str(value or "").strip() not in ("", "unknown", "none", "null")

def load_workspace_registry():
    query = urllib.parse.quote('copilot_workspace_registry_ratio')
    try:
        data = fetch_json(f"{prometheus_url}/api/v1/query?query={query}")
    except Exception:
        return {}, {}, None

    by_hash = {}
    by_commit = {}
    candidates = []
    for item in data.get("data", {}).get("result", []):
        metric = item.get("metric", {})
        workspace_hash = metric.get("workspace_path_hash", "unknown")
        repo_remote = metric.get("github_copilot_git_repository", "unknown")
        repo_name = metric.get("git_repository_name", "unknown")
        repo_owner = metric.get("git_repository_owner", "unknown")
        repo = repo_remote if meaningful(repo_remote) else repo_name
        if not meaningful(workspace_hash) or not meaningful(repo):
            continue
        record = {
            "workspace_path_hash": workspace_hash,
            "workspace_name": metric.get("workspace_name", "unknown"),
            "workspace_kind": metric.get("workspace_kind", "unknown"),
            "repo": repo,
            "branch": metric.get("git_branch", "unknown"),
            "repo_owner": repo_owner,
            "repo_name": repo_name,
            "head_commit": metric.get("git_head_commit", ""),
        }
        by_hash[workspace_hash] = record
        for commit in str(record["head_commit"] or "").split():
            commit = commit.strip().lower()
            if len(commit) >= 7:
                by_commit[commit] = record
        candidates.append(record)

    active = candidates[-1] if len(candidates) == 1 else None
    return by_hash, by_commit, active

workspace_registry, commit_registry, active_workspace = load_workspace_registry()

def run_git(args):
    try:
        return subprocess.check_output(["git", *args], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""

def workspace_from_cwd():
    git_root = run_git(["rev-parse", "--show-toplevel"])
    if not git_root:
        return None
    remote = run_git(["config", "--get", "remote.origin.url"])
    branch = run_git(["branch", "--show-current"]) or run_git(["rev-parse", "--short", "HEAD"])
    workspace_hash = hashlib.sha256(git_root.encode("utf-8")).hexdigest()
    return {
        "workspace_path_hash": workspace_hash,
        "workspace_name": pathlib.Path(git_root).name,
        "workspace_kind": "git",
        "repo": remote or pathlib.Path(git_root).name,
        "branch": branch or "unknown",
        "repo_owner": "unknown",
        "repo_name": pathlib.Path(git_root).name,
    }

cwd_workspace = workspace_from_cwd() if use_active_workspace else None

def apply_workspace_record(summary, record, source):
    if not record:
        return source
    summary["repo"] = record.get("repo", summary["repo"])
    summary["branch"] = record.get("branch", summary["branch"])
    summary["workspace_name"] = record.get("workspace_name", summary["workspace_name"])
    summary["workspace_kind"] = record.get("workspace_kind", summary["workspace_kind"])
    summary["workspace_path_hash"] = record.get("workspace_path_hash", summary["workspace_path_hash"])
    return source

def apply_commit_record(summary, record):
    # Authoritative attribution from the per-window HEAD commit hash. This is the
    # only signal that distinguishes every workspace at once, because GitHub Copilot
    # does not emit the repository name per window and the global launchd resource
    # attributes can describe only one workspace. Preserve the per-window branch and
    # commit, which are more accurate than the registry snapshot.
    if not record:
        return "span_commit_registry"
    summary["repo"] = record.get("repo", summary["repo"])
    if not meaningful(summary["branch"]):
        summary["branch"] = record.get("branch", summary["branch"])
    summary["workspace_name"] = record.get("workspace_name", summary["workspace_name"])
    summary["workspace_kind"] = record.get("workspace_kind", "git")
    summary["workspace_path_hash"] = record.get("workspace_path_hash", summary["workspace_path_hash"])
    return "span_commit_registry"

trace_ids = []
trace_ids.extend(search_trace_ids('service.name="copilot-chat"', limit))
for repo_tag in ["github.copilot.git.repository", "copilot_chat.repo.remote_url"]:
    try:
        repo_values = fetch_json(f"{tempo_url}/api/search/tag/{repo_tag}/values").get("tagValues", [])
    except Exception:
        repo_values = []
    for repo_value in repo_values:
        if not repo_value:
            continue
        trace_ids.extend(search_trace_ids(f'{repo_tag}="{repo_value}"', limit))
trace_ids = list(dict.fromkeys(trace_ids))
now = str(time.time_ns())
metrics_points = []
logs = []
new_seen = 0

content_keys = [
    "copilot_chat.user_request",
    "gen_ai.input.messages",
    "gen_ai.output.messages",
    "gen_ai.tool.definitions",
    "gen_ai.tool.call.arguments",
    "gen_ai.tool.call.result",
    "github.copilot.tool.parameters.command",
]

for trace_id in trace_ids:
    if trace_id in seen:
        continue
    try:
        trace = fetch_json(f"{tempo_url}/api/traces/{trace_id}")
    except Exception:
        continue
    seen.add(trace_id)
    new_seen += 1

    summary = {
        "trace_id": trace_id,
        "service_name": "copilot-chat",
        "session_id": "unknown",
        "conversation_id": "unknown",
        "repo": "unknown",
        "branch": "unknown",
        "commit": "unknown",
        "workspace_name": "unknown",
        "workspace_path_hash": "unknown",
        "workspace_kind": "unknown",
        "agent_name": "unknown",
        "operation_name": "unknown",
        "request_shape": "unknown",
        "request_model": "unknown",
        "response_model": "unknown",
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_tokens": 0,
        "cache_creation_tokens": 0,
        "reasoning_tokens": 0,
        "tool_calls": 0,
        "error_count": 0,
        "content_capture_fields": 0,
        "content_capture_chars": 0,
        "root_span_name": "unknown",
        "duration_ms": 0,
        "usage_scope": "non_workspace_real",
        "workspace_filterable": "false",
        "mode_bucket": "unknown",
        "chat_models": set(),
        "max_prompt_tokens": 0,
        "peak_turn_input_tokens": 0,
        "nano_aiu": 0,
        "cold_input_tokens": 0,
        "context_utilization_pct": 0,
        "attribution_source": "span",
    }

    for batch in trace.get("batches", []):
        res = attr_map(batch.get("resource", {}).get("attributes", []))
        summary["session_id"] = res.get("session.id", summary["session_id"])
        summary["repo"] = res.get("github.copilot.git.repository", res.get("copilot_chat.repo.remote_url", summary["repo"]))
        summary["branch"] = res.get("github.copilot.git.branch", res.get("copilot_chat.repo.head_branch_name", summary["branch"]))
        summary["commit"] = res.get("github.copilot.git.commit_sha", res.get("copilot_chat.repo.head_commit_hash", summary["commit"]))
        summary["workspace_name"] = res.get("workspace.name", summary["workspace_name"])
        summary["workspace_path_hash"] = res.get("workspace.path_hash", summary["workspace_path_hash"])
        summary["workspace_kind"] = res.get("workspace.kind", summary["workspace_kind"])
        for scope in batch.get("scopeSpans", []):
            for span in scope.get("spans", []):
                attrs = attr_map(span.get("attributes", []))
                span_name = span.get("name", "unknown")
                operation = attrs.get("gen_ai.operation.name", "unknown")
                if summary["root_span_name"] == "unknown":
                    summary["root_span_name"] = span_name
                summary["repo"] = attrs.get("github.copilot.git.repository", attrs.get("copilot_chat.repo.remote_url", summary["repo"]))
                summary["branch"] = attrs.get("github.copilot.git.branch", attrs.get("copilot_chat.repo.head_branch_name", summary["branch"]))
                summary["commit"] = attrs.get("github.copilot.git.commit_sha", attrs.get("copilot_chat.repo.head_commit_hash", summary["commit"]))
                summary["operation_name"] = operation if operation != "unknown" else summary["operation_name"]
                if operation == "invoke_agent" or summary["agent_name"] == "unknown":
                    summary["agent_name"] = attrs.get("gen_ai.agent.name", summary["agent_name"])
                summary["conversation_id"] = attrs.get("gen_ai.conversation.id", summary["conversation_id"])
                summary["request_shape"] = attrs.get("copilot_chat.request.shape", summary["request_shape"])
                if operation == "invoke_agent" or summary["request_model"] == "unknown":
                    summary["request_model"] = attrs.get("gen_ai.request.model", summary["request_model"])
                if operation == "invoke_agent" or summary["response_model"] == "unknown":
                    summary["response_model"] = attrs.get("gen_ai.response.model", summary["response_model"])
                if operation == "chat" and attrs.get("gen_ai.request.model"):
                    summary["chat_models"].add(str(attrs.get("gen_ai.request.model")))
                summary["input_tokens"] += int(float(attrs.get("gen_ai.usage.input_tokens", 0) or 0))
                summary["output_tokens"] += int(float(attrs.get("gen_ai.usage.output_tokens", 0) or 0))
                summary["cache_read_tokens"] += int(float(attrs.get("gen_ai.usage.cache_read.input_tokens", 0) or 0))
                summary["cache_creation_tokens"] += int(float(attrs.get("gen_ai.usage.cache_creation.input_tokens", 0) or 0))
                summary["reasoning_tokens"] += int(float(attrs.get("gen_ai.usage.reasoning.output_tokens", attrs.get("gen_ai.usage.reasoning_tokens", 0)) or 0))
                summary["nano_aiu"] += int(float(attrs.get("copilot_chat.copilot_usage_nano_aiu", 0) or 0))
                mpt = int(float(attrs.get("copilot_chat.request.max_prompt_tokens", 0) or 0))
                if mpt > summary["max_prompt_tokens"]:
                    summary["max_prompt_tokens"] = mpt
                turn_input = int(float(attrs.get("gen_ai.usage.input_tokens", 0) or 0))
                if (operation == "chat" or span_name.startswith("chat")) and turn_input > summary["peak_turn_input_tokens"]:
                    summary["peak_turn_input_tokens"] = turn_input
                if operation == "execute_tool" or attrs.get("gen_ai.tool.name"):
                    summary["tool_calls"] += 1
                if attrs.get("error.type"):
                    summary["error_count"] += 1
                for key in content_keys:
                    if key in attrs:
                        text = attrs.get(key, "")
                        if not isinstance(text, str):
                            text = json.dumps(text, ensure_ascii=False)
                        summary["content_capture_fields"] += 1
                        summary["content_capture_chars"] += len(text)
                        log_body = {
                            "trace_id": trace_id,
                            "span_id": span_id_hex(span.get("spanId", "")),
                            "span_name": span_name,
                            "attribute": key,
                            "chars": len(text),
                            "content_hidden": not show_content,
                        }
                        if show_content:
                            log_body["content"] = text
                        logs.append({
                            "timeUnixNano": now,
                            "body": {"stringValue": json.dumps(log_body, ensure_ascii=False, separators=(",", ":"))},
                            "attributes": [
                                attr("trace_id", trace_id), attr("session_id", summary["session_id"]),
                                attr("repo", summary["repo"]), attr("branch", summary["branch"]),
                                attr("span_name", span_name), attr("content_attribute", key),
                                int_attr("content_chars", len(text)), attr("content_hidden", str(not show_content).lower()),
                            ],
                        })

    commit_key = str(summary["commit"] or "").strip().lower()
    commit_record = commit_registry.get(commit_key) if len(commit_key) >= 7 else None

    if commit_record:
        # Primary path: per-window HEAD commit -> registry. Works for every workspace
        # simultaneously and overrides a possibly stale or wrong resource-level repo
        # inherited from the shared global environment.
        summary["attribution_source"] = apply_commit_record(summary, commit_record)
    elif meaningful(summary["repo"]):
        registry_record = workspace_registry.get(summary["workspace_path_hash"])
        if registry_record:
            summary["attribution_source"] = apply_workspace_record(summary, registry_record, "span_registry_hash_enriched")
        elif active_workspace and summary["repo"] == active_workspace.get("repo") and (
            not meaningful(summary["workspace_name"]) or summary["workspace_path_hash"] in ("", "unknown", root_workspace_hash)
        ):
            summary["attribution_source"] = apply_workspace_record(summary, active_workspace, "span_repo_registry_enriched")
    else:
        registry_record = workspace_registry.get(summary["workspace_path_hash"])
        if cwd_workspace and summary["workspace_path_hash"] in ("", "unknown", root_workspace_hash):
            summary["attribution_source"] = apply_workspace_record(summary, cwd_workspace, "active_cwd_fallback")
        elif registry_record:
            summary["attribution_source"] = apply_workspace_record(summary, registry_record, "registry_hash")
        elif active_workspace and summary["workspace_path_hash"] in ("", "unknown", root_workspace_hash):
            summary["attribution_source"] = apply_workspace_record(summary, active_workspace, "active_workspace_fallback")

    has_repo = meaningful(summary["repo"])
    summary["usage_scope"] = "workspace_real" if has_repo else "non_workspace_real"
    summary["workspace_filterable"] = "true" if has_repo else "false"
    summary["mode_bucket"] = infer_mode_bucket(summary["agent_name"], summary["request_shape"], summary["root_span_name"])
    summary["chat_models"] = ",".join(sorted(summary["chat_models"])) or "unknown"
    summary["cold_input_tokens"] = max(0, summary["input_tokens"] - summary["cache_read_tokens"] - summary["cache_creation_tokens"])
    if summary["max_prompt_tokens"] > 0:
        summary["context_utilization_pct"] = round(100.0 * summary["peak_turn_input_tokens"] / summary["max_prompt_tokens"], 2)

    common = [
        attr("trace_id", summary["trace_id"]), attr("session_id", summary["session_id"]),
        attr("conversation_id", summary["conversation_id"]), attr("repo", summary["repo"]),
        attr("branch", summary["branch"]), attr("commit", summary["commit"]),
        attr("workspace_name", summary["workspace_name"]), attr("workspace_path_hash", summary["workspace_path_hash"]),
        attr("workspace_kind", summary["workspace_kind"]), attr("agent_name", summary["agent_name"]),
        attr("operation_name", summary["operation_name"]), attr("request_shape", summary["request_shape"]),
        attr("request_model", summary["request_model"]), attr("response_model", summary["response_model"]),
        attr("chat_models", summary["chat_models"]),
        attr("root_span_name", summary["root_span_name"]), attr("mode_bucket", summary["mode_bucket"]),
        attr("usage_scope", summary["usage_scope"]), attr("workspace_filterable", summary["workspace_filterable"]),
        attr("attribution_source", summary["attribution_source"]),
        attr("real_usage", "true"),
    ]
    for metric_name, value in [
        ("copilot_real_session_input_tokens", summary["input_tokens"]),
        ("copilot_real_session_output_tokens", summary["output_tokens"]),
        ("copilot_real_session_cache_read_tokens", summary["cache_read_tokens"]),
        ("copilot_real_session_cache_creation_tokens", summary["cache_creation_tokens"]),
        ("copilot_real_session_reasoning_tokens", summary["reasoning_tokens"]),
        ("copilot_real_session_tool_calls", summary["tool_calls"]),
        ("copilot_real_session_error_count", summary["error_count"]),
        ("copilot_real_session_content_capture_fields", summary["content_capture_fields"]),
        ("copilot_real_session_content_capture_chars", summary["content_capture_chars"]),
        ("copilot_real_session_max_prompt_tokens", summary["max_prompt_tokens"]),
        ("copilot_real_session_peak_turn_input_tokens", summary["peak_turn_input_tokens"]),
        ("copilot_real_session_cold_input_tokens", summary["cold_input_tokens"]),
        ("copilot_real_session_nano_aiu", summary["nano_aiu"]),
        ("copilot_real_session_context_utilization_pct", int(summary["context_utilization_pct"])),
    ]:
        metrics_points.append({"name": metric_name, "value": value, "attributes": common})

metrics_payload = {
    "resourceMetrics": [{
        "resource": {"attributes": [attr("service.name", "copilot-real-session-materializer"), attr("service.version", "1.0.0")]},
        "scopeMetrics": [{
            "scope": {"name": "copilot-real-session-materializer"},
            "metrics": [
                {"name": p["name"], "unit": "1", "gauge": {"dataPoints": [{"timeUnixNano": now, "asInt": str(int(p["value"])), "attributes": p["attributes"]}]}}
                for p in metrics_points
            ]
        }]
    }]
}
post_json(metrics_endpoint, metrics_payload)

if logs:
    logs_payload = {
        "resourceLogs": [{
            "resource": {"attributes": [attr("service.name", "copilot-real-content-capture"), attr("service.version", "1.0.0")]},
            "scopeLogs": [{"scope": {"name": "copilot-real-content-materializer"}, "logRecords": logs}]
        }]
    }
    post_json(logs_endpoint, logs_payload)

state_path.write_text(json.dumps({"seen": sorted(seen)[-5000:]}, indent=2))
print(json.dumps({"traces_checked": len(trace_ids), "new_traces_materialized": new_seen, "metrics_emitted": len(metrics_points), "content_records_emitted": len(logs), "content_raw_materialized": show_content}, indent=2))
PY
