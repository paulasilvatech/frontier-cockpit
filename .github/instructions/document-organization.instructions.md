---
description: "How generated or saved Frontier Cockpit documents, diagrams, and workshop assets must be placed, versioned, archived, and validated."
applyTo: "docs/**,workshop/**,diagrams/**,README.md"
---

# Document Organization

These rules apply whenever GitHub Copilot generates, saves, updates, or reorganizes a document or deliverable in this repository. The root map lives in [../../README.md](../../README.md).

## Placement

- Root `README.md` is the package index and stays at the repository root.
- Markdown strategy, guide, runbook, and architecture index documents live under `docs/`.
- Hands-on lab Markdown and participant material live under `workshop/`.
- Editable architecture diagram sources and SVG exports live under `diagrams/`.
- Runtime files under `local-otel/` are operational state, not authored deliverables. Keep logs, state, secrets, DuckDB files, and generated exports out of git.

## Versioning And Archive

- Use `Name_vMAJOR_MINOR_PATCH_YYYY-MM-DD_lang.ext` for authored versioned deliverables when the existing family uses that pattern.
- Keep only the latest version of a logical document in the active folder.
- Move superseded versions or duplicate downloads into that folder's `archive/` directory when an archive exists or when you create a new version.
- Keep files that are genuinely different documents in the active folder. Ask before archiving if the difference is unclear.
- Keep the original names of external source files (vendor PDFs, arXiv papers).

## Validate In Place

Before considering a generated or changed artifact done:

1. Confirm the file is in the correct repository folder.
2. Confirm superseded versions are archived when applicable.
3. For architecture diagrams, validate the draw.io source and confirm exported SVGs render.
4. If a new logical document was added, update [../../README.md](../../README.md) or the relevant folder README.

## Copy rules

- Documentation is written in English unless an artifact explicitly requires another language.
- Write "GitHub Copilot", never bare product shorthand.
- Do not use em dashes.
- Never fabricate metrics. Cite GitHub Docs, Microsoft Learn, OpenTelemetry documentation, Grafana or Aspire documentation, named analyst sources, or clearly state assumptions.
