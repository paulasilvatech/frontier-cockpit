#!/usr/bin/env bash
# Validate all deliverables in one shot. Runs every skill's executable gate so
# nobody has to remember to run each one. Two modes:
#
#   1. Default (no argument): regression guard. Confirms all four validators are
#      runnable and that the example assets shipped with the skills still pass
#      their own gate (this is what caught the personal-palette leak before).
#
#   2. With a path: dispatcher. Routes every file under <path> to the matching
#      validator by convention:
#        *_Architecture.md            -> architecture-doc/validate_arch.py
#        *.drawio                     -> azure-architecture-diagrams/validate_drawio.py
#
# Exits non-zero if any gate fails. Used by .vscode/tasks.json and CI.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SK="$ROOT/.github/skills"
ARCH="$SK/architecture-doc/scripts/validate_arch.py"
DRAWIO="$SK/azure-architecture-diagrams/scripts/validate_drawio.py"
DASHBOARDS="$ROOT/.github/scripts/validate-dashboards.sh"
fail=0

run() {  # run <label> <command...>
  local label="$1"; shift
  if "$@" >/tmp/vd_out 2>&1; then
    echo "  PASS  $label"
  else
    echo "  FAIL  $label"
    sed 's/^/        /' /tmp/vd_out
    fail=1
  fi
}

echo "==> Validator scripts are runnable"
for s in "$ARCH" "$DRAWIO"; do
  if [ -f "$s" ]; then
    run "compile $(basename "$s")" python3 -c "import os,py_compile,tempfile; py_compile.compile(r'$s', cfile=os.path.join(tempfile.gettempdir(), '$(basename "$s").pyc'), doraise=True)"
  else
    echo "  FAIL  missing validator: $s"; fail=1
  fi
done

if [ -f "$DASHBOARDS" ]; then
  run "dashboard validator" bash -n "$DASHBOARDS"
else
  echo "  FAIL  missing validator: $DASHBOARDS"; fail=1
fi

dispatch() {  # dispatch <file>
  local f="$1" base; base="$(basename "$f")"
  case "$base" in
    *_Architecture.md|*_architecture.md)
      run "arch  $base" python3 "$ARCH" "$f" ;;
    *.drawio)
      run "drawio $base" python3 "$DRAWIO" "$f" ;;
    *) : ;;  # ignore other file types
  esac
}

if [ "$#" -ge 1 ]; then
  TARGET="$1"
  echo "==> Dispatch deliverables under $TARGET"
  if [ -d "$TARGET" ]; then
    while IFS= read -r f; do dispatch "$f"; done < <(find "$TARGET" -type f \( -name '*_Architecture.md' -o -name '*.drawio' \) | sort)
  elif [ -f "$TARGET" ]; then
    dispatch "$TARGET"
  else
    echo "  FAIL  target not found: $TARGET"; fail=1
  fi
else
  echo "==> Regression guard: committed skill example assets"
  AAD="$SK/azure-architecture-diagrams/assets"
  [ -f "$AAD/example-agentic.drawio" ] && run "drawio example-agentic.drawio" python3 "$DRAWIO" "$AAD/example-agentic.drawio"
  [ -f "$AAD/showcase-diagrams.drawio" ] && run "drawio showcase-diagrams.drawio" python3 "$DRAWIO" "$AAD/showcase-diagrams.drawio"
  run "grafana dashboards" bash "$DASHBOARDS"
fi

rm -f /tmp/vd_out
echo
if [ "$fail" -eq 0 ]; then
  echo "All deliverable gates passed."
else
  echo "Some deliverable gates failed. Fix them before shipping."
fi
exit "$fail"
