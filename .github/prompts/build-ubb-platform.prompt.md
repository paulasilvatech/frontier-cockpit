---
description: "Archived UBB platform planning prompt. Use only when the user supplies audited UBB source folders and asks to build a separate GitHub Copilot billing platform. For Frontier Cockpit work, use the repository playbook and local OpenTelemetry guidance instead."
agent: agent
argument-hint: "the audited UBB source package or the Frontier Cockpit feature to redirect"
---

# Build UBB Platform, Archived Capability

This prompt is retained as a domain capability for future GitHub Copilot billing platform work, but the current repository is **Frontier Cockpit**. Do not assume UBB source folders, audited client workbooks, or a platform app exist in this workspace.

## First Step

Before planning or editing, confirm whether the user is asking for:

1. **Frontier Cockpit work:** local OpenTelemetry, Azure forwarding, dashboards, decks, diagrams, workshop assets, or repository customization. Follow [../copilot-instructions.md](../copilot-instructions.md) and the current docs.
2. **A new UBB platform:** a separate app or package built from user-supplied audited sources. Ask for the source paths and audited data before planning. Do not invent client numbers.

## Rules

- Never fabricate billing, usage, ROI, seat, telemetry, benchmark, or adoption numbers.
- For GitHub Copilot billing or adoption claims, use audited client sources, official GitHub APIs or exports, or clearly labeled assumptions.
- Do not reference historical source folders unless they exist in the current workspace.
- Keep generated apps and documents aligned with the repository's current placement, validation, and copy rules.

## Output

Output concisely: return only the resolved scope, source paths supplied by the user, artifact paths, validation status, and critical blockers. Do not narrate the process steps.
