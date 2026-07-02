---
title: "Frontier Cockpit"
description: "Root package index for Frontier Cockpit, the GitHub Copilot-focused local developer and enterprise FinOps observability platform."
author: "Frontier Cockpit Team"
date: "2026-06-22"
version: "1.0.1"
status: "approved"
tags: ["frontier-cockpit", "github-copilot", "opentelemetry", "azure", "grafana", "aspire"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit

Frontier Cockpit is the umbrella platform for GitHub Copilot and agentic development observability. It has two coordinated experiences: **Frontier Developer Cockpit** for local developer learning and optimization, and **Frontier FinOps Cockpit** for centralized Azure cost, governance, adoption, and leadership views.

## Contents

| Area | Path | Purpose |
| --- | --- | --- |
| Documentation | [docs/](docs/) | Strategy, playbook, implementation manual, guides, runbooks, taxonomy, and local links. |
| Local OpenTelemetry kit | [local-otel/](local-otel/) | User-level local runtime, Docker stack, Azure forwarding, GitHub Enterprise ingestion, materialization, and demo scripts. |
| Architecture diagrams | [diagrams/](diagrams/) | Editable draw.io source and SVG exports for C4, deployment, telemetry flow, and GitHub Enterprise flow. |
| Hands-on workshop | [workshop/](workshop/) | Labs and checklist for participants to build their local cockpit and understand Azure consolidation. |
| GitHub Copilot customization | [.github/](.github/) | Agents, prompts, skills, instructions, workflows, validation scripts, and repository policy. |

## Product Positioning

Frontier Cockpit is an integrated observability offer for GitHub Copilot and agentic development. It is designed for two connected operating loops:

| Experience | Primary User | Purpose | Data Boundary |
| --- | --- | --- | --- |
| Frontier Developer Cockpit | Developers and team leads | Local learning, prompt improvement, context awareness, tool behavior, model labels, AIU signals, and VS Code process memory. | Full fidelity on the developer machine when content capture is approved. |
| Frontier FinOps Cockpit | Platform engineering, FinOps, security, and leadership | Azure history, governance, rollups, GitHub Enterprise signals, organization policy status, adoption context, and Fleet Overview. | Sanitized telemetry, rollups, and official GitHub sources when available. |

The local experience teaches developers how GitHub Copilot sessions behave. The Azure experience helps organizations govern and analyze aggregated signals without turning local operational telemetry into official billing. Official billing, AI Credits, and adoption claims require GitHub billing exports, usage metrics, or other cited sources.

## Key Documents

| Category | Document | Purpose |
| --- | --- | --- |
| Strategy | [Frontier Cockpit Strategy](docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md) | Offer, architecture, value proposition, operating model, and roadmap. |
| Strategy | [Frontier Cockpit Playbook](docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md) | Main implementation map, operating rhythm, success criteria, and validation gates. |
| Strategy | [Taxonomy And Platform Layers](docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md) | Final naming, L1 to L6 platform layers, GitHub Intelligence Layer, and Fleet Overview. |
| Developer Operations | [Developer Local Guide](docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md) | Day-to-day local cockpit workflow, metrics interpretation, content capture, and prompt improvement. |
| Developer Operations | [Local Links Guide](docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md) | Localhost links and explanations for Aspire, Grafana dashboards, Prometheus, Tempo, and Loki. |
| Developer Operations | [Python And Aspire Local Architecture](docs/FrontierCockpit_PythonAspireLocalArchitecture_v1_0_0_2026-06-18_en.md) | Python-first local architecture with Aspire, DuckDB or SQLite, Prometheus, and Grafana. |
| Enterprise FinOps | [Azure Enterprise Guide](docs/FrontierCockpit_AzureEnterpriseGuide_v1_0_0_2026-06-17_en.md) | Azure deployment, hybrid forwarding, Log Analytics, Azure Managed Grafana, and redaction strategy. |
| Enterprise FinOps | [Data Consolidation Guide](docs/FrontierCockpit_DataConsolidationGuide_v1_0_0_2026-06-17_en.md) | Combining local OpenTelemetry rollups with GitHub APIs, billing exports, repository metadata, and governance signals. |
| Enterprise FinOps | [Enterprise Readiness Checklist](docs/FrontierCockpit_EnterpriseReadinessChecklist_v1_0_0_2026-06-22_en.md) | Package readiness criteria for offer coherence, local runtime, Azure, GitHub Intelligence, dashboards, privacy, validation, and workshops. |
| Enterprise FinOps | [Operations Runbook](docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md) | Operations, validation, troubleshooting, security, retention, and teardown. |
| Architecture | [Architecture Diagrams](docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md) | Draw.io source, exported SVGs, diagram index, and validation notes. |
| Implementation | [End-to-End Implementation Manual](docs/FrontierCockpit_EndToEndImplementationManual_v1_0_0_2026-06-18_en.md) | Step-by-step record of implemented local, Azure, GitHub Enterprise, and dashboard work. |
| Workshop | [Workshop Guide](docs/FrontierCockpit_WorkshopGuide_v1_0_0_2026-06-17_en.md) | Facilitator guidance for teaching the local and Azure cockpit flow. |
| Workshop | [Workshop README](workshop/README.md) | Hands-on lab entry point and participant path. |
| Tooling | [Firecrawl MCP Guide](docs/FrontierCockpit_FirecrawlMCPGuide_v1_0_0_2026-06-18_en.md) | Firecrawl MCP setup and research workflow support. |

## Product Taxonomy

```text
Frontier Cockpit
├── Frontier Developer Cockpit
│   └── Local, private, developer learning and optimization
├── Frontier FinOps Cockpit
│   └── Azure, leadership, cost, ROI, governance and Fleet Overview
└── Frontier Platform Layers
    └── L1-L6 + GitHub Intelligence Layer
```

## Local Architecture Rule

Frontier Developer Cockpit always includes **Prometheus and Grafana** for the complete local developer experience. Aspire is the live GenAI trace and resource viewer. DuckDB or SQLite may be used by Python services for lightweight local insight storage, but they do not replace Prometheus or Grafana.

## How To Use This Package

### Developer Path

1. Read the [Developer Local Guide](docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md) to understand the local learning loop.
2. Use [local-otel/README.md](local-otel/README.md) to start and validate the local runtime.
3. Open the [Local Links Guide](docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md) for Aspire, Grafana, Prometheus, Tempo, Loki, and dashboard links.
4. Use [workshop/README.md](workshop/README.md) when running the hands-on labs.

### FinOps And Platform Path

1. Start with the [Frontier Cockpit Strategy](docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md) and [Frontier Cockpit Playbook](docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md).
2. Review [Taxonomy And Platform Layers](docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md) and [Architecture Diagrams](docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md).
3. Use the [Azure Enterprise Guide](docs/FrontierCockpit_AzureEnterpriseGuide_v1_0_0_2026-06-17_en.md) for hybrid forwarding and enterprise dashboards.
4. Use the [Data Consolidation Guide](docs/FrontierCockpit_DataConsolidationGuide_v1_0_0_2026-06-17_en.md) to plan official GitHub usage, billing, repository, and governance joins.
5. Use the [Enterprise Readiness Checklist](docs/FrontierCockpit_EnterpriseReadinessChecklist_v1_0_0_2026-06-22_en.md) before customer or field delivery.
6. Use the [Operations Runbook](docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md) for validation, troubleshooting, security, retention, and teardown.

## Common Commands

Start the full local stack:

```bash
local-otel/start-full-stack.sh
```

Validate the local runtime:

```bash
local-otel/check-otel-local.sh
```

Prepare for demos:

```bash
local-otel/demo-ready.sh
```

Run repository validation gates:

```bash
bash .github/scripts/audit-primitives.sh
bash .github/scripts/audit-skills.sh
bash .github/scripts/audit-external-content.sh
bash .github/scripts/validate-deliverables.sh
bash .github/scripts/generate-llms-txt.sh --check
```

## Status

The documentation package is current as of 2026-06-22 and reflects the implemented local stack, Azure enterprise resources, GitHub Enterprise audit log ingestion, organization policy status ingestion, audit log streaming to Azure Blob Storage, Firecrawl MCP configuration, deck deliverables, and dashboard naming.

## References

- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [Azure Monitor documentation](https://learn.microsoft.com/azure/azure-monitor/)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
