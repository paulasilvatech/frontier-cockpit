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
#        *deck*.html / decks          -> ms-presentation-deck/audit.py
#        other identity *.html        -> ms-identity/validate_html.py
#        other *.md                   -> ms-research-report/validate_report.py
#
# Exits non-zero if any gate fails. Used by .vscode/tasks.json and CI.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SK="$ROOT/.github/skills"
ARCH="$SK/architecture-doc/scripts/validate_arch.py"
DRAWIO="$SK/azure-architecture-diagrams/scripts/validate_drawio.py"
DECK="$SK/ms-presentation-deck/scripts/audit.py"
DECK_DERIV="$SK/ms-presentation-deck/scripts/validate_derivatives.py"
DECK_PPTX="$SK/ms-presentation-deck/scripts/build_native_pptx.py"
HTML="$SK/ms-identity/scripts/validate_html.py"
REPORT="$SK/ms-research-report/scripts/validate_report.py"
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
for s in "$ARCH" "$DRAWIO" "$DECK" "$DECK_DERIV" "$DECK_PPTX" "$HTML" "$REPORT"; do
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
    *deck*.html|*Deck*.html)
      run "deck  $base" python3 "$DECK" "$f" ;;
    *.html)
      run "html  $base" python3 "$HTML" "$f" ;;
    *.md)
      run "report $base" python3 "$REPORT" "$f" ;;
    *) : ;;  # ignore other file types
  esac
}

if [ "$#" -ge 1 ]; then
  TARGET="$1"
  echo "==> Dispatch deliverables under $TARGET"
  if [ -d "$TARGET" ]; then
    while IFS= read -r f; do dispatch "$f"; done < <(find "$TARGET" -type f \( -name '*.md' -o -name '*.html' \) | sort)
  elif [ -f "$TARGET" ]; then
    dispatch "$TARGET"
  else
    echo "  FAIL  target not found: $TARGET"; fail=1
  fi
else
  echo "==> Regression guard: committed skill example assets"
  PMS="$SK/ms-identity/assets"
  run "identity landing.html" python3 "$HTML" "$PMS/landing.html"
  run "identity showcase.html" python3 "$HTML" "$PMS/showcase.html"
  run "identity identity-preview.html" python3 "$HTML" "$PMS/ms-identity-identity-preview.html"
  run "identity playbook/index.html" python3 "$HTML" "$PMS/playbook/index.html"
  MPD="$SK/ms-presentation-deck/assets"
  run "deck example_deck_multi.html" python3 "$DECK" "$MPD/example_deck_multi.html"
  run "deck example_deck_public.html" python3 "$DECK" "$MPD/example_deck_public.html"
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
