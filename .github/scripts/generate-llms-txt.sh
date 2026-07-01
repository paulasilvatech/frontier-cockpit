#!/usr/bin/env bash
# Generate the repository llms.txt context index from the current primitive inventory.
# With --check, fail when the committed llms.txt differs from the generated output.
set -u

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/llms.txt"
TMP="${TMPDIR:-/tmp}/frontier-cockpit-llms.$$"
MODE="${1:-write}"

agents_count="$(find "$ROOT/.github/agents" -maxdepth 1 -name '*.agent.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
skills_count="$(find "$ROOT/.github/skills" -maxdepth 2 -name 'SKILL.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
prompts_count="$(find "$ROOT/.github/prompts" -maxdepth 1 -name '*.prompt.md' -type f 2>/dev/null | wc -l | tr -d ' ')"
instructions_count="$(find "$ROOT/.github/instructions" -maxdepth 1 -name '*.instructions.md' -type f 2>/dev/null | wc -l | tr -d ' ')"

{
  printf '# Frontier Cockpit\n\n'
  printf '> GitHub Copilot and agentic development observability workspace for local developer learning and Azure FinOps governance.\n\n'
  printf '## Repository Purpose\n\n'
  printf 'This repository contains Frontier Cockpit, a local-to-enterprise observability package for GitHub Copilot. It combines Frontier Developer Cockpit for local private optimization with Frontier FinOps Cockpit for sanitized Azure rollups, governance, adoption, and leadership views.\n\n'
  printf '## Primitive Inventory\n\n'
  printf '| Primitive | Count | Location |\n'
  printf '| --- | ---: | --- |\n'
  printf '| Agents | %s | `.github/agents/` |\n' "$agents_count"
  printf '| Skills | %s | `.github/skills/` |\n' "$skills_count"
  printf '| Prompts | %s | `.github/prompts/` |\n' "$prompts_count"
  printf '| Instructions | %s | `.github/instructions/` |\n\n' "$instructions_count"
  printf '## Key Entry Points\n\n'
  printf '%s\n' '- `README.md`: repository map and operating overview.'
  printf '%s\n' '- `docs/`: approved strategy, playbook, guides, runbooks, and taxonomy.'
  printf '%s\n' '- `local-otel/`: local OpenTelemetry kit, Docker stack, Azure forwarding, GitHub Enterprise ingestion, and demo scripts.'
  printf '%s\n' '- `decks/`: trilingual HTML deck sources plus PDF, PPTX, previews, and deck assets.'
  printf '%s\n' '- `diagrams/`: editable draw.io architecture source and SVG exports.'
  printf '%s\n' '- `workshop/`: hands-on labs and participant checklist.'
  printf '%s\n' '- `.github/copilot-instructions.md`: repository-wide GitHub Copilot guidance.'
  printf '%s\n' '- `.github/prompts/`: reusable task entry points.'
  printf '%s\n' '- `.github/skills/`: reusable capability packs.'
  printf '%s\n' '- `.github/agents/`: reusable GitHub Copilot personas.'
  printf '%s\n\n' '- `.github/instructions/`: path-scoped repository rules.'
  printf '## Validation\n\n'
  printf 'Run these commands before shipping changes that affect primitives or deliverables:\n\n'
  printf '```bash\n'
  printf 'bash .github/scripts/audit-primitives.sh\n'
  printf 'bash .github/scripts/audit-skills.sh\n'
  printf 'bash .github/scripts/audit-external-content.sh\n'
  printf 'bash .github/scripts/validate-deliverables.sh\n'
  printf 'bash .github/scripts/validate-dashboards.sh\n'
  printf 'bash .github/scripts/generate-llms-txt.sh --check\n'
  printf '```\n\n'
  printf 'For local runtime readiness, run:\n\n'
  printf '```bash\n'
  printf 'local-otel/check-otel-local.sh\n'
  printf 'local-otel/demo-ready.sh\n'
  printf '```\n\n'
  printf '## External Content\n\n'
  printf 'External agents, skills, prompts, and instructions must keep source metadata, pass portability checks, and avoid automatic installation. Curated Awesome GitHub Copilot comparisons use the `suggest-awesome-github-copilot-*` skills.\n\n'
  printf '## Important Documents\n\n'
  printf '%s\n' '- `.github/CONTRIBUTING.md`'
  printf '%s\n' '- `.github/SECURITY.md`'
  printf '%s\n' '- `docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_AzureEnterpriseGuide_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_DataConsolidationGuide_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_EnterpriseReadinessChecklist_v1_0_0_2026-06-22_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_EndToEndImplementationManual_v1_0_0_2026-06-18_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_WorkshopGuide_v1_0_0_2026-06-17_en.md`'
  printf '%s\n' '- `docs/FrontierCockpit_FirecrawlMCPGuide_v1_0_0_2026-06-18_en.md`'
  printf '%s\n' '- `workshop/README.md`'
  printf '%s\n' '- `decks/README.md`'
  printf '%s\n\n' '- `local-otel/README.md`'
  printf '## Primitive Files\n\n'
  printf '### Agents\n\n'
  find "$ROOT/.github/agents" -maxdepth 1 -name '*.agent.md' -type f 2>/dev/null | sed "s#^$ROOT/##" | sort | sed 's#^#- `#; s#$#`#'
  printf '\n### Skills\n\n'
  find "$ROOT/.github/skills" -maxdepth 2 -name 'SKILL.md' -type f 2>/dev/null | sed "s#^$ROOT/##" | sort | sed 's#^#- `#; s#$#`#'
  printf '\n### Prompts\n\n'
  find "$ROOT/.github/prompts" -maxdepth 1 -name '*.prompt.md' -type f 2>/dev/null | sed "s#^$ROOT/##" | sort | sed 's#^#- `#; s#$#`#'
  printf '\n### Instructions\n\n'
  find "$ROOT/.github/instructions" -maxdepth 1 -name '*.instructions.md' -type f 2>/dev/null | sed "s#^$ROOT/##" | sort | sed 's#^#- `#; s#$#`#'
} > "$TMP"

if [ "$MODE" = "--check" ]; then
  if [ ! -f "$OUT" ]; then
    echo "FAIL llms.txt is missing. Run bash .github/scripts/generate-llms-txt.sh"
    rm -f "$TMP"
    exit 1
  fi
  if cmp -s "$TMP" "$OUT"; then
    echo "llms.txt is up to date."
    rm -f "$TMP"
    exit 0
  fi
  echo "FAIL llms.txt is out of date. Run bash .github/scripts/generate-llms-txt.sh"
  rm -f "$TMP"
  exit 1
fi

mv "$TMP" "$OUT"
echo "Generated llms.txt"
