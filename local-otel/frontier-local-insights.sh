#!/usr/bin/env zsh
set -euo pipefail

# Frontier Cockpit Local local insight store.
# Persists developer-local rollups to DuckDB (preferred) and SQLite-compatible tables can be added later.
# This does not replace Prometheus or Grafana. It stores derived local insights for trend analysis and reports.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

prometheus_url="${PROMETHEUS_URL:-http://localhost:9090}"
period="${FRONTIER_INSIGHTS_RANGE:-24h}"
script_dir="${0:A:h}"
db_path="${FRONTIER_INSIGHTS_DB:-$script_dir/frontier-insights.duckdb}"
# Long-term JSON snapshot consumed by the dashboard API for history beyond the
# 30-day Prometheus retention. Rebuilt from the DuckDB rollup on every run.
snapshot_path="${FRONTIER_INSIGHTS_SNAPSHOT:-$script_dir/long-term-history.json}"
python_bin="${FRONTIER_PYTHON:-$script_dir/.venv/bin/python}"

if [[ ! -x "$python_bin" ]]; then
  python_bin="$(command -v python3)"
fi

"$python_bin" - "$prometheus_url" "$period" "$db_path" "$snapshot_path" <<'PY'
import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request

prometheus_url, period, db_path, snapshot_path = sys.argv[1:]

try:
    import duckdb
except Exception as exc:
    raise SystemExit(f"DuckDB is required for frontier-local-insights: {exc}")


def fetch_json(url):
    with urllib.request.urlopen(url, timeout=20) as response:
        return json.loads(response.read().decode("utf-8"))


def prom(query):
    url = f"{prometheus_url}/api/v1/query?" + urllib.parse.urlencode({"query": query})
    return fetch_json(url).get("data", {}).get("result", [])

base_selector = 'usage_scope="workspace_real"'
queries = {
    "sessions": f"count by (repo, branch) (max_over_time(copilot_real_session_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "input_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "output_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_output_tokens_ratio{{{base_selector}}}[{period}]))",
    "cache_read_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cache_read_tokens_ratio{{{base_selector}}}[{period}]))",
    "cache_creation_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cache_creation_tokens_ratio{{{base_selector}}}[{period}]))",
    "cold_input_tokens": f"sum by (repo, branch) (max_over_time(copilot_real_session_cold_input_tokens_ratio{{{base_selector}}}[{period}]))",
    "aiu": f"sum by (repo, branch) (max_over_time(copilot_real_session_nano_aiu_ratio{{{base_selector}}}[{period}])) / 1e9",
    "max_context_pct": f"max by (repo, branch) (max_over_time(copilot_real_session_context_utilization_pct_ratio{{{base_selector}}}[{period}]))",
    "tool_calls": f"sum by (repo, branch) (max_over_time(copilot_real_session_tool_calls_ratio{{{base_selector}}}[{period}]))",
    "errors": f"sum by (repo, branch) (max_over_time(copilot_real_session_error_count_ratio{{{base_selector}}}[{period}]))",
    "content_chars": f"sum by (repo, branch) (max_over_time(copilot_real_session_content_capture_chars_ratio{{{base_selector}}}[{period}]))",
}

rows = {}
for field, query in queries.items():
    for item in prom(query):
        labels = item.get("metric", {})
        key = (labels.get("repo", "unknown"), labels.get("branch", "unknown"))
        rows.setdefault(key, {"repo": key[0], "branch": key[1]})[field] = float(item.get("value", [0, 0])[1])

now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
pathlib.Path(db_path).parent.mkdir(parents=True, exist_ok=True)
con = duckdb.connect(db_path)
con.execute(
    """
    CREATE TABLE IF NOT EXISTS developer_daily_rollup (
      ingested_at TIMESTAMP,
      period VARCHAR,
      repo VARCHAR,
      branch VARCHAR,
      sessions DOUBLE,
      input_tokens DOUBLE,
      output_tokens DOUBLE,
      cache_read_tokens DOUBLE,
      cache_creation_tokens DOUBLE,
      cold_input_tokens DOUBLE,
      aiu DOUBLE,
      max_context_pct DOUBLE,
      tool_calls DOUBLE,
      errors DOUBLE,
      content_chars DOUBLE,
      cache_read_share DOUBLE,
      cold_context_share DOUBLE,
      tokens_per_session DOUBLE,
      aiu_per_session DOUBLE,
      tool_calls_per_session DOUBLE
    )
    """
)

records = []
for row in rows.values():
    sessions = row.get("sessions", 0.0) or 0.0
    input_tokens = row.get("input_tokens", 0.0) or 0.0
    cache_read = row.get("cache_read_tokens", 0.0) or 0.0
    cold = row.get("cold_input_tokens", 0.0) or 0.0
    aiu = row.get("aiu", 0.0) or 0.0
    tool_calls = row.get("tool_calls", 0.0) or 0.0
    record = {
        "ingested_at": now,
        "period": period,
        "repo": row.get("repo", "unknown"),
        "branch": row.get("branch", "unknown"),
        "sessions": sessions,
        "input_tokens": input_tokens,
        "output_tokens": row.get("output_tokens", 0.0),
        "cache_read_tokens": cache_read,
        "cache_creation_tokens": row.get("cache_creation_tokens", 0.0),
        "cold_input_tokens": cold,
        "aiu": aiu,
        "max_context_pct": row.get("max_context_pct", 0.0),
        "tool_calls": tool_calls,
        "errors": row.get("errors", 0.0),
        "content_chars": row.get("content_chars", 0.0),
        "cache_read_share": (cache_read / input_tokens) if input_tokens else 0.0,
        "cold_context_share": (cold / input_tokens) if input_tokens else 0.0,
        "tokens_per_session": (input_tokens / sessions) if sessions else 0.0,
        "aiu_per_session": (aiu / sessions) if sessions else 0.0,
        "tool_calls_per_session": (tool_calls / sessions) if sessions else 0.0,
    }
    records.append(record)

if records:
    con.executemany(
        """
        INSERT INTO developer_daily_rollup VALUES (
          $ingested_at, $period, $repo, $branch, $sessions, $input_tokens, $output_tokens,
          $cache_read_tokens, $cache_creation_tokens, $cold_input_tokens, $aiu,
          $max_context_pct, $tool_calls, $errors, $content_chars, $cache_read_share,
          $cold_context_share, $tokens_per_session, $aiu_per_session, $tool_calls_per_session
        )
        """,
        records,
    )

# Rebuild the long-term snapshot from the full rollup so the dashboard can
# serve history beyond Prometheus retention. One entry per ingestion day and
# repo, using the latest rollup of each day.
snapshot_rows = con.execute(
    """
    WITH ranked AS (
      SELECT
        strftime(ingested_at, '%Y-%m-%d') AS day,
        repo,
        branch,
        sessions, input_tokens, output_tokens, cache_read_tokens,
        cache_creation_tokens, cold_input_tokens, aiu, max_context_pct,
        tool_calls, errors,
        row_number() OVER (
          PARTITION BY strftime(ingested_at, '%Y-%m-%d'), repo, branch
          ORDER BY ingested_at DESC
        ) AS rn
      FROM developer_daily_rollup
    )
    SELECT
      day,
      repo,
      sum(sessions), sum(input_tokens), sum(output_tokens),
      sum(cache_read_tokens), sum(cold_input_tokens), sum(aiu),
      max(max_context_pct), sum(tool_calls), sum(errors)
    FROM ranked
    WHERE rn = 1
    GROUP BY day, repo
    ORDER BY day, repo
    """
).fetchall()
snapshot = {
    "generatedAt": now,
    "source": "developer_daily_rollup (DuckDB)",
    "entries": [
        {
            "day": r[0],
            "repo": r[1],
            "sessions": float(r[2] or 0),
            "inputTokens": float(r[3] or 0),
            "outputTokens": float(r[4] or 0),
            "cacheReadTokens": float(r[5] or 0),
            "coldInputTokens": float(r[6] or 0),
            "aiCredits": float(r[7] or 0),
            "maxContextPct": float(r[8] or 0),
            "toolCalls": float(r[9] or 0),
            "errors": float(r[10] or 0),
        }
        for r in snapshot_rows
    ],
}
snapshot_file = pathlib.Path(snapshot_path)
snapshot_file.parent.mkdir(parents=True, exist_ok=True)
tmp_file = snapshot_file.with_suffix(".tmp")
tmp_file.write_text(json.dumps(snapshot, separators=(",", ":")), encoding="utf-8")
tmp_file.replace(snapshot_file)

summary = con.execute(
    """
    SELECT
      count(*) AS rows_inserted,
      sum(sessions) AS sessions,
      sum(input_tokens) AS input_tokens,
      sum(aiu) AS aiu,
      avg(cache_read_share) AS avg_cache_read_share,
      avg(cold_context_share) AS avg_cold_context_share,
      max(max_context_pct) AS max_context_pct
    FROM developer_daily_rollup
    WHERE ingested_at = ?
    """,
    [now],
).fetchone()
con.close()

print(json.dumps({
    "db_path": db_path,
    "snapshot_path": snapshot_path,
    "snapshot_days": len({entry["day"] for entry in snapshot["entries"]}),
    "period": period,
    "repositories": len(rows),
    "rows_inserted": int(summary[0] or 0),
    "sessions": float(summary[1] or 0),
    "input_tokens": float(summary[2] or 0),
    "aiu": float(summary[3] or 0),
    "avg_cache_read_share": float(summary[4] or 0),
    "avg_cold_context_share": float(summary[5] or 0),
    "max_context_pct": float(summary[6] or 0),
}, indent=2))
PY
