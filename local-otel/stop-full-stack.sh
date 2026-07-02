#!/usr/bin/env zsh
set -euo pipefail

# Stop the full local observability stack without deleting data. Named volumes are
# preserved, so trace, metric, and log history and Grafana configuration survive a restart.
# Pass --reset to also delete the data volumes (destructive, removes all local history).

script_dir="${0:A:h}"
stack_dir="$script_dir/stack"
reset=0

for arg in "$@"; do
  case "$arg" in
    --reset) reset=1 ;;
    *) print -u2 "Unknown argument: $arg"; exit 2 ;;
  esac
done

if ! command -v docker >/dev/null 2>&1; then
  print -u2 "Docker CLI was not found."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  print -u2 "Docker daemon is not running. Nothing to stop."
  exit 0
fi

cd "$stack_dir"

if [[ "$reset" -eq 1 ]]; then
  print "Stopping the stack and DELETING all local history volumes (traces, metrics, logs, Grafana, Postgres)."
  docker compose -f docker-compose.yml -f docker-compose.azure.yaml down -v
  print "Stack stopped and local history volumes removed."
else
  print "Stopping the stack and preserving all data volumes."
  docker compose -f docker-compose.yml -f docker-compose.azure.yaml down
  print "Stack stopped. History is preserved. Start again with $script_dir/start-full-stack.sh"
fi
