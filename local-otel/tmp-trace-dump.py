#!/usr/bin/env python3
"""Temporary diagnostic: dump real copilot-chat trace attributes from Tempo.

Shows which attributes are resource-level (from env / launchd, global) vs
span-level (from GitHub Copilot's own per-window folder detection).
"""
import json
import sys
import urllib.parse
import urllib.request

TEMPO = "http://localhost:3200"
INTEREST = ("repo", "workspace", "git", "branch",
            "commit", "file", "copilot", "folder")


def fetch(url):
    with urllib.request.urlopen(url, timeout=15) as r:
        return json.loads(r.read().decode())


def kv_pairs(items):
    out = {}
    for a in items or []:
        k = a.get("key", "")
        v = a.get("value", {})
        if "stringValue" in v:
            out[k] = v["stringValue"]
        elif "intValue" in v:
            out[k] = v["intValue"]
        elif "boolValue" in v:
            out[k] = v["boolValue"]
        else:
            out[k] = json.dumps(v)[:60]
    return out


def interesting(d):
    return {k: v for k, v in d.items() if any(t in k for t in INTEREST)}


def main():
    # Find a few recent traces
    q = urllib.parse.quote('{ resource.service.name="copilot-chat" }')
    search = fetch(f"{TEMPO}/api/search?q={q}&limit=8")
    tids = [t["traceID"] for t in search.get("traces", []) if t.get("traceID")]
    print(f"found {len(tids)} traces")
    res_keys = {}
    span_keys = {}
    for tid in tids:
        try:
            tr = fetch(f"{TEMPO}/api/traces/{tid}")
        except Exception as e:
            print("  fetch fail", tid, e)
            continue
        batches = tr.get("batches") or tr.get("data", {}).get("batches") or []
        for b in batches:
            res = interesting(
                kv_pairs(b.get("resource", {}).get("attributes", [])))
            for k, v in res.items():
                res_keys.setdefault(k, set()).add(str(v)[:80])
            for ss in b.get("scopeSpans", b.get("instrumentationLibrarySpans", [])):
                for sp in ss.get("spans", []):
                    sa = interesting(kv_pairs(sp.get("attributes", [])))
                    for k, v in sa.items():
                        span_keys.setdefault(k, set()).add(str(v)[:80])
    print("\n=== RESOURCE-LEVEL (global, from env/launchd) ===")
    for k in sorted(res_keys):
        print(f"  {k} = {sorted(res_keys[k])}")
    print("\n=== SPAN-LEVEL (per-window, from Copilot folder detection) ===")
    for k in sorted(span_keys):
        print(f"  {k} = {sorted(span_keys[k])[:6]}")


if __name__ == "__main__":
    main()
