#!/usr/bin/env zsh
set -euo pipefail

# Export local OpenTelemetry backend data to a DuckDB analytical file.
# This complements Tempo, Prometheus, Loki, and Grafana. It does not replace them.
# Raw content remains local. Do not forward this DuckDB file to Azure or commit it.

export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.local/bin"

prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
loki_url="${LOKI_URL:-http://localhost:3100}"
tempo_url="${TEMPO_URL:-http://localhost:3200}"
export_range="${FRONTIER_OTEL_EXPORT_RANGE:-1h}"
db_path="${FRONTIER_OTEL_EXPORT_DB:-$HOME/frontier-cockpit/local-otel/frontier-otel-export.duckdb}"
agent_host_sqlite_db="${FRONTIER_AGENT_HOST_SQLITE_DB:-$HOME/Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat/agent-traces.db}"
python_bin="${FRONTIER_PYTHON:-$HOME/frontier-cockpit/local-otel/.venv/bin/python}"

if [[ ! -x "$python_bin" ]]; then
  python_bin="$(command -v python3)"
fi

"$python_bin" - "$prometheus_url" "$loki_url" "$tempo_url" "$export_range" "$db_path" "$agent_host_sqlite_db" <<'PY'
import datetime as dt
import hashlib
import json
import pathlib
import re
import sqlite3
import sys
import time
import urllib.parse
import urllib.request

prometheus_url, loki_url, tempo_url, export_range, db_path, agent_host_sqlite_db = sys.argv[1:]

try:
    import duckdb
except Exception as exc:
    raise SystemExit(f"DuckDB is required for export-otel-duckdb: {exc}")


def parse_duration(value):
    match = re.fullmatch(r"(\d+)([smhd])", value.strip())
    if not match:
        raise SystemExit(f"Unsupported FRONTIER_OTEL_EXPORT_RANGE: {value}. Use values like 30m, 1h, or 24h.")
    amount = int(match.group(1))
    unit = match.group(2)
    multipliers = {"s": 1, "m": 60, "h": 3600, "d": 86400}
    return amount * multipliers[unit]


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def prometheus_query(query):
    url = f"{prometheus_url}/api/v1/query?" + urllib.parse.urlencode({"query": query})
    return fetch_json(url).get("data", {}).get("result", [])


def metric_names():
    url = f"{prometheus_url}/api/v1/label/__name__/values"
    names = fetch_json(url).get("data", [])
    prefixes = (
        "copilot_",
        "copilot_chat_",
        "gen_ai_",
        "github_",
        "vscode_",
    )
    return sorted(name for name in names if name.startswith(prefixes))


def label_value(service_name):
    return service_name.replace('\\', '\\\\').replace('"', '\\"')


def to_float(value):
    try:
        return float(value)
    except Exception:
        return None


def trace_summary(trace_payload):
    services = set()
    span_count = 0
    start_values = []
    end_values = []
    for batch in trace_payload.get("batches", []):
        resource_attrs = {
            attr.get("key"): next(iter(attr.get("value", {}).values()), "")
            for attr in batch.get("resource", {}).get("attributes", [])
        }
        service_name = resource_attrs.get("service.name")
        if service_name:
            services.add(str(service_name))
        for scope in batch.get("scopeSpans", []):
            for span in scope.get("spans", []):
                span_count += 1
                if span.get("startTimeUnixNano"):
                    start_values.append(int(span["startTimeUnixNano"]))
                if span.get("endTimeUnixNano"):
                    end_values.append(int(span["endTimeUnixNano"]))
    start_time = min(start_values) if start_values else None
    end_time = max(end_values) if end_values else None
    duration_ms = ((end_time - start_time) / 1_000_000) if start_time and end_time else None
    return sorted(services), span_count, start_time, duration_ms


range_seconds = parse_duration(export_range)
now_seconds = int(time.time())
start_seconds = now_seconds - range_seconds
now_ns = now_seconds * 1_000_000_000
start_ns = start_seconds * 1_000_000_000
exported_at = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
run_seed = f"{exported_at}:{export_range}:{prometheus_url}:{loki_url}:{tempo_url}"
run_id = hashlib.sha256(run_seed.encode("utf-8")).hexdigest()[:24]

pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
connection = duckdb.connect(db_path)


def ensure_column(table_name, column_name, column_type):
    columns = {row[1] for row in connection.execute(f"PRAGMA table_info('{table_name}')").fetchall()}
    if column_name not in columns:
        connection.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")

connection.execute(
    """
    CREATE TABLE IF NOT EXISTS otel_export_runs (
      run_id VARCHAR,
      exported_at TIMESTAMP,
      export_range VARCHAR,
      range_seconds BIGINT,
      prometheus_url VARCHAR,
      loki_url VARCHAR,
      tempo_url VARCHAR,
      prometheus_samples BIGINT,
      loki_records BIGINT,
            tempo_traces BIGINT,
            agent_host_spans BIGINT,
            agent_host_span_attributes BIGINT,
            agent_host_span_events BIGINT,
            agent_host_sessions BIGINT,
            agent_host_sqlite_db VARCHAR
    )
    """
)
for column_name, column_type in [
        ("agent_host_spans", "BIGINT"),
        ("agent_host_span_attributes", "BIGINT"),
        ("agent_host_span_events", "BIGINT"),
        ("agent_host_sessions", "BIGINT"),
        ("agent_host_sqlite_db", "VARCHAR"),
]:
        ensure_column("otel_export_runs", column_name, column_type)
connection.execute(
    """
    CREATE TABLE IF NOT EXISTS prometheus_metric_samples (
      run_id VARCHAR,
      sampled_at TIMESTAMP,
      metric_name VARCHAR,
      labels_json VARCHAR,
      value DOUBLE
    )
    """
)
connection.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_host_sqlite_spans (
            run_id VARCHAR,
            source_db_path VARCHAR,
            span_id VARCHAR,
            trace_id VARCHAR,
            parent_span_id VARCHAR,
            name VARCHAR,
            start_time_ms BIGINT,
            end_time_ms BIGINT,
            status_code BIGINT,
            status_message VARCHAR,
            operation_name VARCHAR,
            provider_name VARCHAR,
            agent_name VARCHAR,
            conversation_id VARCHAR,
            request_model VARCHAR,
            response_model VARCHAR,
            input_tokens BIGINT,
            output_tokens BIGINT,
            cached_tokens BIGINT,
            reasoning_tokens BIGINT,
            tool_name VARCHAR,
            tool_call_id VARCHAR,
            tool_type VARCHAR,
            chat_session_id VARCHAR,
            turn_index BIGINT,
            ttft_ms DOUBLE
        )
        """
)
connection.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_host_sqlite_span_attributes (
            run_id VARCHAR,
            source_db_path VARCHAR,
            span_id VARCHAR,
            key VARCHAR,
            value VARCHAR
        )
        """
)
connection.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_host_sqlite_span_events (
            run_id VARCHAR,
            source_db_path VARCHAR,
            id BIGINT,
            span_id VARCHAR,
            name VARCHAR,
            timestamp_ms BIGINT,
            attributes VARCHAR
        )
        """
)
connection.execute(
        """
        CREATE TABLE IF NOT EXISTS agent_host_sqlite_sessions (
            run_id VARCHAR,
            source_db_path VARCHAR,
            session_id VARCHAR,
            agent_name VARCHAR,
            model VARCHAR,
            started_at BIGINT,
            ended_at BIGINT,
            duration_ms BIGINT,
            span_count BIGINT,
            llm_calls BIGINT,
            tool_calls BIGINT,
            total_input_tokens BIGINT,
            total_output_tokens BIGINT,
            total_cached_tokens BIGINT
        )
        """
)
connection.execute(
    """
    CREATE TABLE IF NOT EXISTS loki_log_records (
      run_id VARCHAR,
      timestamp_ns VARCHAR,
      service_name VARCHAR,
      labels_json VARCHAR,
      line VARCHAR
    )
    """
)
connection.execute(
    """
    CREATE TABLE IF NOT EXISTS tempo_trace_exports (
      run_id VARCHAR,
      trace_id VARCHAR,
      services_json VARCHAR,
      span_count BIGINT,
      start_time_unix_nano VARCHAR,
      duration_ms DOUBLE,
      trace_json VARCHAR
    )
    """
)

prometheus_records = []
for metric_name in metric_names():
    for item in prometheus_query(metric_name):
        labels = item.get("metric", {})
        sample_value = item.get("value", [None, None])[1]
        prometheus_records.append(
            {
                "run_id": run_id,
                "sampled_at": exported_at,
                "metric_name": metric_name,
                "labels_json": json.dumps(labels, ensure_ascii=False, sort_keys=True),
                "value": to_float(sample_value),
            }
        )

if prometheus_records:
    connection.executemany(
        """
        INSERT INTO prometheus_metric_samples VALUES (
          $run_id, $sampled_at, $metric_name, $labels_json, $value
        )
        """,
        prometheus_records,
    )

loki_records = []
label_url = f"{loki_url}/loki/api/v1/label/service_name/values?" + urllib.parse.urlencode(
    {"start": str(start_ns), "end": str(now_ns)}
)
try:
    service_names = fetch_json(label_url).get("data", [])
except Exception:
    service_names = []

for service_name in sorted(service_names):
    if not (service_name.startswith("copilot") or service_name.startswith("github") or service_name.startswith("vscode")):
        continue
    selector = f'{{service_name="{label_value(service_name)}"}}'
    query_url = f"{loki_url}/loki/api/v1/query_range?" + urllib.parse.urlencode(
        {
            "query": selector,
            "start": str(start_ns),
            "end": str(now_ns),
            "limit": "5000",
            "direction": "BACKWARD",
        }
    )
    try:
        payload = fetch_json(query_url)
    except Exception:
        continue
    for stream in payload.get("data", {}).get("result", []):
        labels = stream.get("stream", {})
        for timestamp_ns, line in stream.get("values", []):
            loki_records.append(
                {
                    "run_id": run_id,
                    "timestamp_ns": str(timestamp_ns),
                    "service_name": service_name,
                    "labels_json": json.dumps(labels, ensure_ascii=False, sort_keys=True),
                    "line": line,
                }
            )

if loki_records:
    connection.executemany(
        """
        INSERT INTO loki_log_records VALUES (
          $run_id, $timestamp_ns, $service_name, $labels_json, $line
        )
        """,
        loki_records,
    )

trace_ids = []
for tags_query in ['service.name="copilot-chat"', 'service.name="copilot-real-session-materializer"']:
    search_url = f"{tempo_url}/api/search?" + urllib.parse.urlencode(
        {"tags": tags_query, "start": str(start_seconds), "end": str(now_seconds), "limit": "500"}
    )
    try:
        payload = fetch_json(search_url)
    except Exception:
        continue
    trace_ids.extend(trace.get("traceID") for trace in payload.get("traces", []) if trace.get("traceID"))
trace_ids = list(dict.fromkeys(trace_ids))

tempo_records = []
for trace_id in trace_ids:
    try:
        trace_payload = fetch_json(f"{tempo_url}/api/traces/{trace_id}")
    except Exception:
        continue
    services, span_count, start_time, duration_ms = trace_summary(trace_payload)
    tempo_records.append(
        {
            "run_id": run_id,
            "trace_id": trace_id,
            "services_json": json.dumps(services, ensure_ascii=False),
            "span_count": span_count,
            "start_time_unix_nano": str(start_time or ""),
            "duration_ms": duration_ms,
            "trace_json": json.dumps(trace_payload, ensure_ascii=False, separators=(",", ":")),
        }
    )

if tempo_records:
    connection.executemany(
        """
        INSERT INTO tempo_trace_exports VALUES (
          $run_id, $trace_id, $services_json, $span_count, $start_time_unix_nano, $duration_ms, $trace_json
        )
        """,
        tempo_records,
    )

agent_host_spans = 0
agent_host_span_attributes = 0
agent_host_span_events = 0
agent_host_sessions = 0
agent_host_db_path = pathlib.Path(agent_host_sqlite_db).expanduser()
if agent_host_db_path.exists():
    sqlite_uri = agent_host_db_path.as_uri() + "?mode=ro"
    sqlite_connection = sqlite3.connect(sqlite_uri, uri=True)
    sqlite_connection.row_factory = sqlite3.Row
    try:
        source_db_path = str(agent_host_db_path)
        existing_span_ids = {
            row[0]
            for row in connection.execute(
                "SELECT span_id FROM agent_host_sqlite_spans WHERE source_db_path = ?",
                [source_db_path],
            ).fetchall()
        }

        span_rows = []
        new_span_ids = []
        for row in sqlite_connection.execute("SELECT * FROM spans"):
            row = dict(row)
            span_id = row.get("span_id")
            if span_id in existing_span_ids:
                continue
            new_span_ids.append(span_id)
            span_rows.append(
                (
                    run_id,
                    source_db_path,
                    row.get("span_id"),
                    row.get("trace_id"),
                    row.get("parent_span_id"),
                    row.get("name"),
                    row.get("start_time_ms"),
                    row.get("end_time_ms"),
                    row.get("status_code"),
                    row.get("status_message"),
                    row.get("operation_name"),
                    row.get("provider_name"),
                    row.get("agent_name"),
                    row.get("conversation_id"),
                    row.get("request_model"),
                    row.get("response_model"),
                    row.get("input_tokens"),
                    row.get("output_tokens"),
                    row.get("cached_tokens"),
                    row.get("reasoning_tokens"),
                    row.get("tool_name"),
                    row.get("tool_call_id"),
                    row.get("tool_type"),
                    row.get("chat_session_id"),
                    row.get("turn_index"),
                    row.get("ttft_ms"),
                )
            )
        if span_rows:
            connection.executemany(
                """
                INSERT INTO agent_host_sqlite_spans VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                span_rows,
            )
        agent_host_spans = len(span_rows)

        existing_attribute_keys = {
            (row[0], row[1])
            for row in connection.execute(
                "SELECT span_id, key FROM agent_host_sqlite_span_attributes WHERE source_db_path = ?",
                [source_db_path],
            ).fetchall()
        }
        attribute_rows = []
        for row in sqlite_connection.execute("SELECT * FROM span_attributes"):
            attribute_key = (row["span_id"], row["key"])
            if attribute_key in existing_attribute_keys:
                continue
            attribute_rows.append((run_id, source_db_path, row["span_id"], row["key"], row["value"]))
            if len(attribute_rows) >= 5000:
                connection.executemany(
                    """
                    INSERT INTO agent_host_sqlite_span_attributes VALUES (?, ?, ?, ?, ?)
                    """,
                    attribute_rows,
                )
                agent_host_span_attributes += len(attribute_rows)
                attribute_rows = []
        if attribute_rows:
            connection.executemany(
                """
                INSERT INTO agent_host_sqlite_span_attributes VALUES (?, ?, ?, ?, ?)
                """,
                attribute_rows,
            )
            agent_host_span_attributes += len(attribute_rows)

        existing_event_ids = {
            row[0]
            for row in connection.execute(
                "SELECT id FROM agent_host_sqlite_span_events WHERE source_db_path = ?",
                [source_db_path],
            ).fetchall()
        }
        event_rows = []
        for row in sqlite_connection.execute("SELECT * FROM span_events"):
            if row["id"] in existing_event_ids:
                continue
            event_rows.append((run_id, source_db_path, row["id"], row["span_id"], row["name"], row["timestamp_ms"], row["attributes"]))
            if len(event_rows) >= 5000:
                connection.executemany(
                    """
                    INSERT INTO agent_host_sqlite_span_events VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    event_rows,
                )
                agent_host_span_events += len(event_rows)
                event_rows = []
        if event_rows:
            connection.executemany(
                """
                INSERT INTO agent_host_sqlite_span_events VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                event_rows,
            )
            agent_host_span_events += len(event_rows)

        session_rows = []
        for row in sqlite_connection.execute("SELECT * FROM sessions"):
            row = dict(row)
            session_rows.append(
                (
                    run_id,
                    source_db_path,
                    row.get("session_id"),
                    row.get("agent_name"),
                    row.get("model"),
                    row.get("started_at"),
                    row.get("ended_at"),
                    row.get("duration_ms"),
                    row.get("span_count"),
                    row.get("llm_calls"),
                    row.get("tool_calls"),
                    row.get("total_input_tokens"),
                    row.get("total_output_tokens"),
                    row.get("total_cached_tokens"),
                )
            )
        if session_rows:
            connection.executemany(
                """
                INSERT INTO agent_host_sqlite_sessions VALUES (
                  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
                """,
                session_rows,
            )
        agent_host_sessions = len(session_rows)
    finally:
        sqlite_connection.close()

connection.execute(
    """
    INSERT INTO otel_export_runs (
      run_id, exported_at, export_range, range_seconds, prometheus_url, loki_url,
      tempo_url, prometheus_samples, loki_records, tempo_traces,
      agent_host_spans, agent_host_span_attributes, agent_host_span_events,
      agent_host_sessions, agent_host_sqlite_db
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    [
        run_id,
        exported_at,
        export_range,
        range_seconds,
        prometheus_url,
        loki_url,
        tempo_url,
        len(prometheus_records),
        len(loki_records),
        len(tempo_records),
        agent_host_spans,
        agent_host_span_attributes,
        agent_host_span_events,
        agent_host_sessions,
        str(agent_host_db_path) if agent_host_db_path.exists() else "",
    ],
)

connection.close()

print(
    json.dumps(
        {
            "db_path": db_path,
            "run_id": run_id,
            "export_range": export_range,
            "prometheus_samples": len(prometheus_records),
            "loki_records": len(loki_records),
            "tempo_traces": len(tempo_records),
            "agent_host_spans": agent_host_spans,
            "agent_host_span_attributes": agent_host_span_attributes,
            "agent_host_span_events": agent_host_span_events,
            "agent_host_sessions": agent_host_sessions,
            "agent_host_sqlite_db": str(agent_host_db_path) if agent_host_db_path.exists() else "not_found",
        },
        indent=2,
    )
)
PY