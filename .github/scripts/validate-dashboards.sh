#!/usr/bin/env bash
# Validate Grafana dashboard JSON files and cross-dashboard links.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
fail=0

run_python() {
  python3 - "$ROOT" <<'PY'
import json
import re
import sys
from pathlib import Path

root = Path(sys.argv[1])
dashboard_dirs = [
    root / "local-otel" / "stack" / "grafana" / "dashboards",
    root / "local-otel" / "azure",
]
docs_to_scan = [
    root / "README.md",
    root / "docs" / "FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md",
    root / "docs" / "FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md",
    root / "workshop" / "ParticipantChecklist_v1_0_0_2026-06-18_en.md",
]

errors = []
warnings = []
dashboards = {}
files = []
links_to_check = []

for directory in dashboard_dirs:
    if not directory.exists():
        warnings.append(f"dashboard directory missing: {directory.relative_to(root)}")
        continue
    if directory.name == "azure":
        files.extend(sorted(directory.glob("*dashboard*.json")))
    else:
        files.extend(sorted(directory.glob("*.json")))

for path in files:
    rel = path.relative_to(root)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"{rel}: invalid JSON: {exc}")
        continue
    dashboard = payload.get("dashboard", payload)
    uid = dashboard.get("uid")
    title = dashboard.get("title")
    if not uid:
        errors.append(f"{rel}: missing dashboard uid")
        continue
    if not title:
        errors.append(f"{rel}: missing dashboard title")
    if uid in dashboards:
        errors.append(f"{rel}: duplicate uid {uid} also in {dashboards[uid]['file']}")
    dashboards[uid] = {"file": str(rel), "title": title or ""}
    panels = dashboard.get("panels", [])
    if not isinstance(panels, list) or not panels:
        errors.append(f"{rel}: dashboard has no panels")
    if re.search(r"\breal cost\b", title or "", re.IGNORECASE):
        errors.append(f"{rel}: title uses unsafe cost wording: {title}")
    for panel in panels:
        panel_title = panel.get("title", "")
        if re.search(r"\breal cost\b", panel_title, re.IGNORECASE):
            errors.append(f"{rel}: panel {panel.get('id', '?')} uses unsafe cost wording: {panel_title}")
        description = panel.get("description", "")
        text_content = str(panel.get("options", {}).get("content", ""))
        if re.search(r"\bAIU\b|AI Units|billing|invoice", panel_title + " " + description + " " + text_content, re.IGNORECASE):
            if not re.search(r"not official|official billing|operational telemetry|GitHub billing|usage exports|billing exports|usage/billing", description + " " + text_content, re.IGNORECASE):
                warnings.append(f"{rel}: panel {panel.get('id', '?')} references AIU/billing without an explicit caveat")
    for link in dashboard.get("links", []):
        url = link.get("url", "")
        match = re.search(r"/d/([^/]+)/", url)
        if match:
            links_to_check.append((rel, match.group(1)))

for rel, uid in links_to_check:
    if uid not in dashboards:
        warnings.append(f"{rel}: link references unknown dashboard uid {uid}")

known_uids = set(dashboards)
for path in docs_to_scan:
    if not path.exists():
        continue
    rel = path.relative_to(root)
    text = path.read_text(encoding="utf-8")
    for uid in re.findall(r"localhost:3000/d/([^/\s)]+)", text):
        if uid not in known_uids:
            errors.append(f"{rel}: local dashboard URL references unknown uid {uid}")

for uid, info in sorted(dashboards.items()):
    print(f"  PASS  dashboard {uid} ({info['file']})")
for warning in warnings:
    print(f"  WARN  {warning}")
for error in errors:
    print(f"  FAIL  {error}")
raise SystemExit(1 if errors else 0)
PY
}

echo "==> Dashboard validation"
if ! run_python; then
  fail=1
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "All dashboard gates passed."
else
  echo "Some dashboard gates failed. Fix them before shipping."
fi
exit "$fail"
