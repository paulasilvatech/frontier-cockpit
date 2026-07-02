# GitHub Copilot Instructions

Repository-wide guidance for GitHub Copilot in the **Frontier Cockpit** workspace. Keep responses aligned with the root README, path-scoped instructions, local runtime docs, validation scripts, agents, prompts, and skills.

## What This Repository Is

Frontier Cockpit is the umbrella platform for GitHub Copilot and agentic development observability. It has two coordinated experiences:

- **Frontier Cockpit Local:** local, private developer learning and optimization.
- **Frontier Cockpit Hybrid:** centralized Azure cost, governance, adoption, ROI, and leadership views.

The platform observes GitHub Copilot Chat, agent mode, tool calls, context use, AIU signals, model labels, workspace attribution, and GitHub Enterprise signals. Local views can be full fidelity. Azure views must be sanitized, governed, and suitable for enterprise history.

## Workspace Map

- `README.md`: root package index and product taxonomy.
- `docs/`: approved strategy, playbook, architecture, guides, runbooks, and taxonomy.
- `diagrams/`: editable draw.io source and SVG architecture exports.
- `local-otel/`: local OpenTelemetry kit, Docker stack, Azure deployment, GitHub Enterprise ingestion, dashboards, materialization, and demo scripts.
- `workshop/`: hands-on labs and participant checklist.
- `.github/`: GitHub Copilot agents, prompts, skills, instructions, validation scripts, workflows, and repository policy.

## Golden Rules

1. Write **GitHub Copilot**, never bare product shorthand, in user-facing copy.
2. Never fabricate metrics, KPIs, ROI, market data, prices, quotas, or benchmarks. Cite official sources or state assumptions.
3. Treat local OpenTelemetry as operational telemetry, not official billing. Official billing and adoption claims require GitHub APIs, billing exports, or cited sources.
4. Keep raw prompts, responses, tool arguments, and tool results local unless an explicit approved workflow says otherwise.
5. Azure forwarding must sanitize raw content and oversized sensitive attributes before enterprise ingestion.
6. Use the locked product names: Frontier Cockpit, Frontier Cockpit Local, Frontier Cockpit Hybrid, Frontier Platform Layers, Fleet Overview.
7. Documentation is English by default. User-facing workshop or app content may be multilingual when the artifact requires it.
8. No em dashes in repository-authored documentation or UI copy.
9. Prefer verified repository scripts and existing patterns over new one-off tooling.
10. Do not run destructive reset, teardown, or secret-rotation commands unless explicitly requested.

## Local Runtime

The local runtime source of truth is `local-otel/`. All commands run from the cloned repository root.

Default endpoints:

- Aspire Dashboard: `http://localhost:18888`
- Grafana OSS: `http://localhost:3000`
- Prometheus: `http://localhost:9090`
- Tempo: `http://localhost:3200`
- Loki: `http://localhost:3100`
- OTLP HTTP: `http://localhost:4318`
- OTLP gRPC: `http://localhost:4317`

The complete Frontier Cockpit Local runs ten containers: OpenTelemetry Collector, Aspire Dashboard, Tempo, Prometheus, Loki, Grafana OSS (embedded SQLite), the model price registry sidecar, the scheduled jobs container, and the dashboard API and web containers. DuckDB may support Python-first local insights, but it does not replace Prometheus or Grafana.

Use `bash local-otel/client-bootstrap.sh` to configure and start the stack. Use `local-otel/check-workshop-local.sh` for readiness. The session materializer and daily rollup run automatically inside the `copilot-otel-jobs` container.

## Azure And GitHub Enterprise

Azure resources are defined under `local-otel/azure/` with Bicep. The current enterprise observability resource group is `rg-agentobs-dev-eus-001` in East US. Use managed identity, least privilege, and private or governed network posture where practical.

GitHub Enterprise and organization signals are ingested through `local-otel/ingest-github-enterprise.sh`, `local-otel/ingest-github-orgs.sh`, and related state under ignored folders. API statuses such as `404`, `403`, and `422` can be real availability signals. Do not synthesize usage when an official GitHub API is unavailable.

## Documentation And Deliverables

- Markdown docs under `docs/` and `workshop/` use YAML frontmatter, versioned filenames, a change log, a table of contents when useful, and a References section for claims.
- Architecture source lives in `diagrams/*.drawio`; exported SVGs live beside it.
- Keep `README.md` and workshop indexes current when adding logical artifacts.

## Development Conventions

- Shell scripts are Bash or zsh as already used in `local-otel/`. Preserve macOS compatibility.
- Avoid writing secrets, tokens, local logs, state JSON, DuckDB files, or generated runtime output to git.
- For zsh scripts, do not use reserved names such as `path` or `status` for variables.
- Dashboard JSON lives under `local-otel/stack/grafana/` for local Grafana and `local-otel/azure/` for Azure Managed Grafana.
- For diagrams, use official Azure, Microsoft, and GitHub icons when product icons are required.

## Customizations

- Path-scoped instructions live under `.github/instructions/`.
- Agents live under `.github/agents/`.
- Prompts live under `.github/prompts/`.
- Skills live under `.github/skills/`.
- External GitHub Copilot primitives must keep provenance metadata and pass external-content validation.

## Validation

Use the VS Code task **Validate workspace** for the full repository gate.

Important individual checks:

```bash
bash .github/scripts/audit-primitives.sh
bash .github/scripts/audit-skills.sh
bash .github/scripts/audit-external-content.sh
bash .github/scripts/validate-deliverables.sh
bash .github/scripts/generate-llms-txt.sh --check
```

For local runtime validation:

```bash
bash local-otel/client-bootstrap.sh
local-otel/check-workshop-local.sh
```

## Repository Hygiene

Do not commit `.DS_Store`, `.playwright-mcp/`, local OpenTelemetry logs, local runtime state, DuckDB files, Azure `.env`, token files, GitHub Enterprise JSON exports, Docker generated data, or `_archive/` contents. These are covered by `.gitignore`.

## Pointers

- Root overview: [../README.md](../README.md)
- Local OpenTelemetry kit: [../local-otel/README.md](../local-otel/README.md)
- Operations runbook: [../docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md](../docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md)
- Local links: [../docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md](../docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md)
- Workshop entry point: [../workshop/README.md](../workshop/README.md)
