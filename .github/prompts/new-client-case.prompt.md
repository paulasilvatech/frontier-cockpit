---
description: "Scaffold a new sourced client or customer package, using audited data and repository placement rules."
agent: agent
argument-hint: "client name, target folder, case type, and audited data source"
---

# New Client Package

Scaffold a new sourced client or customer package in this workspace.

## Inputs

Ask for any that are missing:

- **Client name** and target folder.
- Package type: documentation, deck, report, dashboard export, app, or mixed deliverables.
- The **audited data source** for the client, such as a workbook, GitHub API export, billing export, or approved source document. If none is available yet, scaffold structure only and mark numbers as `TODO (pending audited source)`, do not invent values.

## Steps

1. Read [../copilot-instructions.md](../copilot-instructions.md), [../instructions/document-organization.instructions.md](../instructions/document-organization.instructions.md), and [../instructions/documentation.instructions.md](../instructions/documentation.instructions.md).
2. Create the package folder with a `README.md` covering purpose, contents, status, how to run or review, and references.
3. If a deliverable is requested, use the relevant skill and replace placeholders only with audited or cited data.
4. If an app is requested, use existing repository patterns and verify build/render behavior.
5. Add a context or assumptions file capturing decisions, sources, unresolved gaps, and canonical values when available.
6. Update the root [../../README.md](../../README.md) or relevant folder README if this is a new logical package.

## Rules

- Never fabricate metrics. Use only audited or cited data and cite the source.
- Keep anonymized templates anonymized.
- Documentation is English unless the deliverable explicitly requires another language.
- Write "GitHub Copilot"; no em dashes in UI copy.

## Done when

- The package folder exists with a complete English `README.md`.
- Any generated deliverables or apps validate with the relevant gates.
- The root README or relevant folder README reflects the new package when applicable.

## Output

Output concisely: return only the created artifact path(s), validation status, and any critical findings or blockers. Do not narrate the process steps.
