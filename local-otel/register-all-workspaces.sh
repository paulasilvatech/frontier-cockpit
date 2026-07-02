#!/usr/bin/env zsh
# register-all-workspaces.sh
#
# Register every local Git repository in the Frontier Cockpit Local workspace
# registry so the materializer can attribute GitHub Copilot sessions to the correct
# workspace for ALL workspaces at once.
#
# Why this exists:
#   macOS launchd holds a single global OTEL_RESOURCE_ATTRIBUTES, so GUI-launched
#   VS Code windows cannot each carry their own workspace identity through the
#   environment. GitHub Copilot does emit the per-window HEAD commit hash, so this
#   script records the HEAD commit of every local branch for every repository. The
#   materializer (materialize-copilot-sessions.sh) matches a session's per-window
#   commit back to the repository here and attributes repo, branch, and workspace
#   name correctly, independent of how VS Code was launched.
#
# macOS TCC and the cache:
#   LaunchAgents do not get Full Disk Access, so a launchd-triggered run cannot read
#   repositories under protected folders such as ~/Documents. Discovery therefore
#   writes a rich per-repository cache (workspaces/registry-cache.tsv) and MERGES into
#   it: a run updates the repositories it can see and preserves the rest. The publish
#   phase only reads that cache (never the repositories), so the LaunchAgent can keep
#   every workspace registered even when it cannot reach the repositories directly.
#   Populate the full cache once from an interactive shell (which has
#   Full Disk Access): ./register-all-workspaces.sh --rescan
#
# Configuration (environment variables):
#   FRONTIER_WORKSPACE_ROOTS         Space-separated roots to scan. Default: $HOME
#   FRONTIER_WORKSPACE_MAXDEPTH      find -maxdepth for .git discovery. Default: 5
#   FRONTIER_WORKSPACE_DISCOVERY_TTL Seconds before discovery rescans. Default: 3600
#   FRONTIER_WORKSPACE_RETENTION     Days before an unseen repo ages out. Default: 60
#   OTEL_EXPORTER_OTLP_ENDPOINT      OTLP/HTTP base endpoint. Default: http://localhost:4318
#
# The script emits metadata only (no prompts, code, or file content). It posts one
# OTLP payload describing all cached repositories as gauge data points.

set -euo pipefail

script_dir="${0:A:h}"
force_rescan="false"
[[ "${1:-}" == "--rescan" ]] && force_rescan="true"

roots_raw="${FRONTIER_WORKSPACE_ROOTS:-$HOME}"
max_depth="${FRONTIER_WORKSPACE_MAXDEPTH:-5}"
discovery_ttl="${FRONTIER_WORKSPACE_DISCOVERY_TTL:-3600}"
retention_days="${FRONTIER_WORKSPACE_RETENTION:-60}"
otlp_endpoint="${OTEL_EXPORTER_OTLP_ENDPOINT:-http://localhost:4318}"
metrics_url="${otlp_endpoint%/}/v1/metrics"

state_dir="${script_dir}/workspaces"
registry_cache="${state_dir}/registry-cache.tsv"
lock_dir="${state_dir}/.discovery.lock"
mkdir -p "$state_dir"

# Directories that never contain workspaces worth attributing and are expensive to walk.
# Do not list .git here: discovery searches for .git entries.
typeset -a prune_names
prune_names=(Library node_modules .Trash .cache Caches .npm .cargo .rustup .gradle .m2 Applications)

# Rich cache row format (tab-separated, keyed by path_hash):
#   path_hash  name  kind  branch  owner  repo_name  remote  commits  last_seen
emit_repo() {
  local top="$1"
  local out="$2"
  local name="${top:t}"
  local branch remote owner repo_name commits head path_hash now

  branch="$(git -C "$top" branch --show-current 2>/dev/null || true)"
  [[ -z "$branch" ]] && branch="detached"
  remote="$(git -C "$top" config --get remote.origin.url 2>/dev/null || true)"

  owner=""
  repo_name="$name"
  if [[ -n "$remote" ]]; then
    local path_part="${remote%.git}"
    path_part="${path_part##*github.com[:/]}"
    if [[ "$path_part" == */* ]]; then
      owner="${path_part%%/*}"
      repo_name="${path_part##*/}"
    fi
  fi

  commits="$(git -C "$top" for-each-ref --format='%(objectname)' refs/heads 2>/dev/null | sort -u | tr '\n' ' ' | sed -e 's/  */ /g' -e 's/^ //' -e 's/ $//')"
  head="$(git -C "$top" rev-parse HEAD 2>/dev/null || true)"
  if [[ -n "$head" && " $commits " != *" $head "* ]]; then
    commits="$head $commits"
  fi
  [[ -z "$commits" ]] && return 0

  path_hash="$(print -rn -- "$top" | shasum -a 256 | awk '{print $1}')"
  now="$(date +%s)"

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$path_hash" "$name" "git" "$branch" "${owner:-unknown}" "${repo_name:-$name}" "${remote:-unknown}" "$commits" "$now" \
    >> "$out"
}

# Build the find prune expression once, without a trailing -o.
typeset -a find_prune
for n in "${prune_names[@]}"; do
  if (( ${#find_prune} > 0 )); then
    find_prune+=(-o)
  fi
  find_prune+=(-name "$n")
done

# Slow phase: walk roots, gather rich metadata for every reachable repository, then
# merge into the cache by path_hash so repositories this run could not reach (for
# example TCC-protected folders under launchd) are preserved.
discover_and_merge() {
  local seen_tsv top gitentry root
  seen_tsv="$(mktemp -t frontier-workspace-seen.XXXXXX)"
  typeset -A seen_roots
  for root in ${(z)roots_raw}; do
    [[ -d "$root" ]] || continue
    while IFS= read -r gitentry; do
      [[ -z "$gitentry" ]] && continue
      top="$(git -C "${gitentry:h}" rev-parse --show-toplevel 2>/dev/null || true)"
      [[ -z "$top" ]] && continue
      [[ -n "${seen_roots[$top]:-}" ]] && continue
      seen_roots[$top]=1
      emit_repo "$top" "$seen_tsv"
    done < <(find "$root" -maxdepth "$max_depth" \( "${find_prune[@]}" \) -prune -o -name .git -print 2>/dev/null)
  done

  RETENTION_DAYS="$retention_days" python3 - "$registry_cache" "$seen_tsv" <<'PY'
import os
import sys
import time

cache_path, seen_path = sys.argv[1], sys.argv[2]
retention = int(os.environ.get("RETENTION_DAYS", "60")) * 86400
now = int(time.time())


def load(path):
    rows = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle:
                line = line.rstrip("\n")
                if not line:
                    continue
                parts = line.split("\t")
                if len(parts) < 9:
                    continue
                rows[parts[0]] = parts[:9]
    except FileNotFoundError:
        pass
    return rows


merged = load(cache_path)
merged.update(load(seen_path))  # freshly seen repositories win

kept = [row for row in merged.values() if (now - int(row[8] or 0)) <= retention]
kept.sort(key=lambda r: r[1].lower())

tmp = cache_path + ".tmp"
with open(tmp, "w", encoding="utf-8") as handle:
    for row in kept:
        handle.write("\t".join(row) + "\n")
os.replace(tmp, cache_path)
PY
  rm -f "$seen_tsv"
}

needs_discovery() {
  [[ "$force_rescan" == "true" ]] && return 0
  [[ -f "$registry_cache" ]] || return 0
  local mtime now age
  mtime="$(stat -f %m "$registry_cache" 2>/dev/null || echo 0)"
  now="$(date +%s)"
  age=$(( now - mtime ))
  (( age > discovery_ttl ))
}

# Refresh the cache when stale. A lock prevents overlapping scans. A forced rescan or
# a first run with no cache runs in the foreground so the caller sees fresh results;
# otherwise discovery runs in the background so this invocation stays fast.
if needs_discovery; then
  if mkdir "$lock_dir" 2>/dev/null; then
    if [[ "$force_rescan" == "true" || ! -s "$registry_cache" ]]; then
      discover_and_merge || true
      rmdir "$lock_dir" 2>/dev/null || true
    else
      ( discover_and_merge || true; rmdir "$lock_dir" 2>/dev/null || true ) &
      disown 2>/dev/null || true
    fi
  fi
fi

if [[ ! -s "$registry_cache" ]]; then
  print "register-all-workspaces: registry cache is warming up; rerun shortly." >&2
  exit 0
fi

# Publish phase: read the cache only (never the repositories) and post one OTLP
# payload. This is safe to run from launchd because it needs no access to the repos.
payload="$(python3 - "$registry_cache" <<'PY'
import json
import sys
import time

cache_path = sys.argv[1]
now = str(time.time_ns())


def attr(key, value):
    return {"key": key, "value": {"stringValue": value if value else "unknown"}}


resource_metrics = []
with open(cache_path, "r", encoding="utf-8") as handle:
    for line in handle:
        line = line.rstrip("\n")
        if not line:
            continue
        parts = line.split("\t")
        if len(parts) < 9:
            continue
        path_hash, name, kind, branch, owner, repo_name, remote, commits, _seen = parts[:9]
        resource_metrics.append({
            "resource": {
                "attributes": [
                    attr("service.name", "copilot-workspace-registry"),
                    attr("service.version", "1.0.0"),
                    attr("workspace.name", name),
                    attr("workspace.kind", kind),
                    attr("workspace.path_hash", path_hash),
                    attr("git.branch", branch),
                    attr("git.repository.owner", owner),
                    attr("git.repository.name", repo_name),
                    attr("github.copilot.git.repository", remote),
                    attr("git.head_commit", commits),
                ]
            },
            "scopeMetrics": [
                {
                    "scope": {"name": "copilot-otel-workspace-registry"},
                    "metrics": [
                        {
                            "name": "copilot_workspace_registry",
                            "unit": "1",
                            "gauge": {
                                "dataPoints": [
                                    {"timeUnixNano": now, "asInt": "1", "attributes": []}
                                ]
                            },
                        }
                    ],
                }
            ],
        })

print(json.dumps({"resourceMetrics": resource_metrics}, separators=(",", ":")))
PY
)"

repo_count="$(grep -c . "$registry_cache" 2>/dev/null || echo 0)"

http_code="$(printf '%s' "$payload" | curl -s -o /dev/null -w '%{http_code}' \
  -X POST -H 'Content-Type: application/json' --data-binary @- "$metrics_url" 2>/dev/null || echo "000")"

if [[ "$http_code" == "200" || "$http_code" == "202" || "$http_code" == "204" ]]; then
  print "register-all-workspaces: registered ${repo_count} workspace(s) to ${metrics_url} (HTTP ${http_code})."
else
  print "register-all-workspaces: failed to post registry to ${metrics_url} (HTTP ${http_code})." >&2
  exit 1
fi
