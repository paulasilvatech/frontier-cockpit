---
description: "Documentation standards for all Markdown: English, factual integrity, structure, links, and references."
applyTo: "**/*.md"
---

# Documentation Standards

Applies to every Markdown file in the workspace, including READMEs, docs, workshop labs, `.github` content, notes, and generated reports.

## Language And Voice

- Write in English by default. Use another language only when the artifact explicitly requires it.
- Be concise and direct. Prefer short sentences and scannable structure.
- Write "GitHub Copilot", never bare product shorthand.
- Do not use em dashes. Use commas, parentheses, or a shorter sentence.

## Factual Integrity

- Never fabricate metrics, KPIs, ROI, market data, statistics, prices, quotas, or benchmarks.
- Every data claim must cite a credible source with a link, such as GitHub Docs, Microsoft Learn, OpenTelemetry documentation, Aspire documentation, Grafana documentation, Azure documentation, or named analyst firms.
- Treat local OpenTelemetry as operational telemetry, not official billing or adoption truth.
- If no source exists, state the value as an explicit assumption or omit it.
- Documents that present data must end with a **References** section listing the cited sources.

## Structure

- Start with a single H1 title and a one-paragraph summary of purpose.
- Use YAML frontmatter for authored repository documents when the surrounding folder uses it.
- For folder READMEs, include: purpose, a contents table, status, how to run (if applicable), and references.
- Use tables for file listings and structured comparisons.
- Use fenced code blocks for commands.

## Links

- Use workspace-relative links, for example `../docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md`.
- Keep links current when files move or are renamed.
- Link to source documents when citing architecture, runtime, or validation rules.
