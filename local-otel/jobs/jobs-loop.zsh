#!/usr/bin/env zsh
set -u

# Scheduled jobs runner for the Frontier Cockpit local stack.
# Runs the session materializer on a short interval and the daily rollup on a
# long interval, entirely inside Docker so scheduling works the same on macOS,
# Linux, and Windows hosts. Writes /tmp/frontier-jobs.last-ok for the compose
# healthcheck after each successful materializer pass.

materialize_interval="${JOBS_MATERIALIZE_INTERVAL_SECONDS:-300}"
rollup_interval="${JOBS_ROLLUP_INTERVAL_SECONDS:-86400}"
rollup_marker="${JOBS_ROLLUP_MARKER_FILE:-/state/last-rollup-epoch}"

last_rollup=0
if [[ -f "$rollup_marker" ]]; then
  last_rollup="$(cat "$rollup_marker" 2>/dev/null || print 0)"
  [[ "$last_rollup" == <-> ]] || last_rollup=0
fi

print "==> frontier-jobs started (materialize every ${materialize_interval}s, rollup every ${rollup_interval}s)"

while true; do
  if zsh /app/local-otel/materialize-copilot-sessions.sh; then
    date +%s > /tmp/frontier-jobs.last-ok
  else
    print "WARN materialize-copilot-sessions.sh failed; will retry on the next interval" >&2
  fi

  now="$(date +%s)"
  if (( now - last_rollup >= rollup_interval )); then
    if zsh /app/local-otel/daily-rollup.sh; then
      last_rollup="$now"
      print -r -- "$last_rollup" > "$rollup_marker" 2>/dev/null || true
    else
      print "WARN daily-rollup.sh failed; will retry on the next interval" >&2
    fi
  fi

  sleep "$materialize_interval"
done
