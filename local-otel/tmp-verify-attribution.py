#!/usr/bin/env python3
"""Temporary verification of per-workspace attribution. Deleted after use."""
import json
import subprocess
import urllib.parse


def q(promql):
    url = "http://localhost:9090/api/v1/query?query=" + \
        urllib.parse.quote(promql)
    out = subprocess.run(["curl", "-s", "--max-time", "8", url],
                         capture_output=True, text=True).stdout
    return json.loads(out).get("data", {}).get("result", [])


rows = q("count by (workspace_name,repo,branch,usage_scope,attribution_source)(copilot_real_session_input_tokens_ratio)")
print("real-session series:", len(rows))
real = 0
for r in sorted(rows, key=lambda x: x["metric"].get("workspace_name", "")):
    m = r["metric"]
    scope = m.get("usage_scope", "")
    if scope == "workspace_real":
        real += 1
    print(
        f"  ws={m.get('workspace_name', ''):28.28} "
        f"repo={m.get('repo', ''):26.26} "
        f"branch={m.get('branch', ''):12.12} "
        f"scope={scope:16.16} src={m.get('attribution_source', '')}"
    )
print(f"\nworkspace_real series: {real}")
