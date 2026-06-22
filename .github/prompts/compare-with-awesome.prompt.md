---
description: "Compare this repository's GitHub Copilot agents, skills, prompts, and instructions with the Awesome GitHub Copilot catalog, then produce a curated adopt/adapt/defer/reject intake plan with validation gates."
agent: agent
argument-hint: "optional focus area, for example security, onboarding, testing, or all primitives"
---

# Compare With Awesome GitHub Copilot

Compare `${input:focus:the optional focus area, for example security, onboarding, testing, or all primitives}` against the HQ repository's local GitHub Copilot primitives and the public Awesome GitHub Copilot catalog.

## First step, always

Load these skills before comparing or recommending changes: `suggest-awesome-github-copilot-agents`, `suggest-awesome-github-copilot-skills`, `suggest-awesome-github-copilot-prompts`, and `suggest-awesome-github-copilot-instructions`. If one of them is unavailable, continue with the local workflow in this prompt and report the missing skill as a blocker for full automation.

## Steps

1. Inventory local primitives under `.github/agents/`, `.github/skills/`, `.github/prompts/`, and `.github/instructions/`.
2. Read `https://awesome-copilot.github.com/llms.txt` or the `github/awesome-copilot` repository catalog when web access is available.
3. Compare by purpose, trigger, expected artifact, validation requirement, and overlap with existing HQ assets.
4. Classify each candidate as `adopt`, `adapt`, `defer`, or `reject`.
5. For `adopt` or `adapt`, list expected files, provenance metadata, validation gates, and implementation risk.
6. Do not install, copy, overwrite, or delete any primitive unless the user explicitly asks to implement the selected items.

## Rules

- Preserve Frontier Cockpit conventions from `.github/copilot-instructions.md`.
- Prefer small, high-value imports over broad catalog mirroring.
- Keep Microsoft identity, telemetry privacy, and source integrity rules intact.
- Never fabricate metrics, prices, benchmarks, or source claims.
- External content must pass `audit-external-content.sh` after implementation.

## Output

Output concisely: return only the comparison summary, recommendation table, implementation order, validation gates, and blockers. Do not narrate the process steps.
