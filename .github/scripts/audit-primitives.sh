#!/usr/bin/env bash
# Audit the GitHub Copilot customization primitives (agents, prompts, and
# instructions) under .github/ against the repository conventions. Closes the
# gap left by audit-skills.sh (which only covers skills) and validate-
# deliverables.sh (which only covers rendered outputs).
#
# Checks, per file:
#   - YAML frontmatter starts on line 1.
#   - description present.
#   - agents: name present. prompts: agent and argument-hint present.
#     instructions: applyTo present.
#   - agents: no Claude Code style model fallback metadata or tool names.
#   - prompts: output-economy language present, and skill-loading prompts use
#     a "First step" section before the main workflow.
#   - no em dashes.
#   - "GitHub Copilot" never written as a bare "Copilot" (official product and
#     SKU names such as Copilot Business or Microsoft Copilot are allowed).
#
# Exits non-zero if any check fails. Used by .vscode/tasks.json and CI.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GH="$ROOT/.github"
fail=0

err() { echo "  FAIL [$1] $2"; fail=1; }

check_common() {  # check_common <file> <kind>
  # shellcheck disable=SC2034
  local f="$1" kind="$2" base; base="$(basename "$f")"

  # Frontmatter on line 1.
  [ "$(head -1 "$f")" = "---" ] || err "$base" "frontmatter not on line 1"

  # description present in the frontmatter block.
  awk '/^---$/{c++; next} c==1' "$f" | grep -q '^description:' \
    || err "$base" "missing 'description' in frontmatter"

  # No em dashes.
  if grep -q "\u2014" "$f" 2>/dev/null || grep -q "—" "$f"; then
    err "$base" "em dash found (forbidden)"
  fi

  # Bare "Copilot" without "GitHub Copilot". Consistent with the Python
  # validators: only flag when the file never writes "GitHub Copilot" at all
  # (this avoids false positives on lines that quote the rule itself).
  if grep -qE "(^|[^a-zA-Z/._-])Copilot\b" "$f" && ! grep -q "GitHub Copilot" "$f"; then
    err "$base" "bare 'Copilot' without 'GitHub Copilot'"
  fi
}

echo "==> Agents"
for f in "$GH"/agents/*.agent.md; do
  [ -e "$f" ] || { echo "  (none)"; break; }
  check_common "$f" agent
  frontmatter="$(awk '/^---$/{c++; next} c==1' "$f")"
  awk '/^---$/{c++; next} c==1' "$f" | grep -q '^name:' \
    || err "$(basename "$f")" "missing 'name' in frontmatter"
  if echo "$frontmatter" | grep -qE '^(model_fallback|allowed-tools):'; then
    err "$(basename "$f")" "unsupported Claude Code frontmatter key"
  fi
  if echo "$frontmatter" | grep -qE '"(Read|Glob|Grep|Bash|Task)"'; then
    err "$(basename "$f")" "Claude Code style tool name in tools list"
  fi
done

echo "==> Prompts"
for f in "$GH"/prompts/*.prompt.md; do
  [ -e "$f" ] || { echo "  (none)"; break; }
  check_common "$f" prompt
  base="$(basename "$f")"
  frontmatter="$(awk '/^---$/{c++; next} c==1' "$f")"
  echo "$frontmatter" | grep -q '^agent:' \
    || err "$base" "missing 'agent' in frontmatter"
  echo "$frontmatter" | grep -q '^argument-hint:' \
    || err "$base" "missing 'argument-hint' in frontmatter"
  grep -q 'Output concisely:' "$f" \
    || err "$base" "missing output-economy rule ('Output concisely:')"

  # Skill-backed prompts must load the skill before the main workflow. Keep the
  # check deterministic and high-signal: prompts with an explicit top-level Load
  # directive must have a First step section before Steps, Workflow, Checks,
  # Inputs, Role, Context, or Reference standard.
  if grep -qE '^Load( the)? `[^`]+`|^Use .* Load `[^`]+`|^If the `[^`]+` skill is available, load it' "$f"; then
    first_step_line="$(awk '/^## First step/{print NR; exit}' "$f")"
    workflow_line="$(awk '/^## (Steps|Workflow|Checks|Inputs|Role|Context|Reference standard)/{print NR; exit}' "$f")"
    if [ -z "$first_step_line" ]; then
      err "$base" "skill-loading prompt missing '## First step' section"
    elif [ -n "$workflow_line" ] && [ "$first_step_line" -gt "$workflow_line" ]; then
      err "$base" "'## First step' appears after the main workflow section"
    fi
  fi
done

echo "==> Instructions"
for f in "$GH"/instructions/*.instructions.md; do
  [ -e "$f" ] || { echo "  (none)"; break; }
  check_common "$f" instruction
  awk '/^---$/{c++; next} c==1' "$f" | grep -q '^applyTo:' \
    || err "$(basename "$f")" "missing 'applyTo' in frontmatter"
done

echo
if [ "$fail" -eq 0 ]; then
  echo "All primitive checks passed."
else
  echo "Some primitive checks failed. Fix them before shipping."
fi
exit "$fail"
