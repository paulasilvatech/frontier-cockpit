---
description: "Specky SDD guidance for GitHub Copilot: scoped spec artifacts, EARS requirements, REQ-ID traceability, companion skill loading, phase flow, and concise artifact-first output."
applyTo: ".specs/**,.sdd-state.json,.github/agents/**"
---

# Specky SDD GitHub Copilot Instructions

This repository can use Spec-Driven Development (SDD) through the Specky pipeline. These rules align Specky with GitHub Copilot customization best practices and the repository primitive checks.

## Core Rules

1. **EARS notation is mandatory.** Every requirement must follow one of the six EARS patterns.
2. **REQ-ID traceability is mandatory.** Every test, task, design decision, and implementation claim traces to a REQ-ID.
3. **Load companion skills first.** Every Specky agent or prompt that depends on a domain skill must load that skill before planning, writing, generating, editing, or validating.
4. **Use orchestrated phase flow.** When `.specs/` and `.sdd-state.json` exist, prefer `@specky-orchestrator` or `/specky-orchestrate` so phase order, artifacts, and gates stay consistent.
5. **Do not assume automatic hooks.** Treat hooks and MCP gates as active only when the configured MCP server, VS Code tasks, or CI validation proves they are running.
6. **Keep outputs concise.** Return artifact paths, validation status, next required action, and critical blockers. Do not narrate process steps.
7. **Respect repository editing rules.** Do not create branches, commits, or pull requests unless the user explicitly asks.
8. **Never fabricate metrics.** Cite sources or state assumptions. For Frontier Cockpit telemetry, distinguish operational local OpenTelemetry from official GitHub billing or adoption data.

## Specky Artifacts

Specky artifacts live under `.specs/NNN-feature/`:

- `CONSTITUTION.md`
- `RESEARCH.md`
- `SPECIFICATION.md`
- `DESIGN.md`
- `TASKS.md`
- `VERIFICATION.md`
- `ANALYSIS.md`

## Recommended Work Modes

- **Full pipeline:** Use `@specky-orchestrator` or `/specky-orchestrate` for end-to-end SDD work.
- **Onboarding:** Use `@specky-onboarding` or `/specky-onboarding` to choose between greenfield, brownfield, migration, or API flows.
- **Phase-specific work:** Use phase agents only when the pipeline state, branch, and prerequisite artifacts are clear.
- **Direct MCP tools:** Use direct `sdd_*` tools only when the user asks for low-level control or when diagnosing a pipeline issue.

## Available Agents

- `@specky-onboarding`: interactive wizard and default entry point.
- `@specky-orchestrator`: full pipeline coordinator.
- `@sdd-init`: pipeline initialization.
- `@requirements-engineer`: FRD and NFRD requirements.
- `@research-analyst`: technical research.
- `@spec-engineer`: `SPECIFICATION.md` with EARS requirements.
- `@sdd-clarify`: ambiguity resolution.
- `@design-architect`: `DESIGN.md` and diagrams.
- `@task-planner`: `TASKS.md` and checklist.
- `@quality-reviewer`: completeness and compliance review.
- `@implementer`: implementation scaffolding.
- `@test-verifier`: coverage and verification.
- `@release-engineer`: release preparation.

## Available Prompts

Use these in GitHub Copilot Chat with `@workspace /prompt-name`:

- **Quick start:** `/specky-onboarding`, `/specky-orchestrate`, `/specky-greenfield`, `/specky-brownfield`, `/specky-migration`, `/specky-api`
- **Pipeline:** `/specky-research`, `/specky-clarify`, `/specky-specify`, `/specky-design`, `/specky-tasks`, `/specky-implement`, `/specky-verify`, `/specky-release`, `/specky-deploy`
- **Special:** `/specky-from-figma`, `/specky-from-meeting`, `/specky-check-drift`, `/specky-resolve-conflict`
- **Debug:** `/specky-debug-hook`, `/specky-pipeline-status`, `/specky-reset-phase`

## EARS Patterns

| Pattern | Format |
| --- | --- |
| Ubiquitous | The system shall... |
| Event-driven | When [event], the system shall... |
| State-driven | While [state], the system shall... |
| Optional | Where [condition], the system shall... |
| Unwanted | If [condition], then the system shall... |
| Complex | While [state], when [event], the system shall... |

## Output Contract

For Specky prompts and agents, output concisely:

- Artifact path(s) created or updated.
- Validation status and failed gates, if any.
- Next required action.
- Critical blockers only.

Do not include step-by-step process narration unless the user asks for an audit trail.
