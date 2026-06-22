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
| Deck deliverables | [decks/](decks/) | Trilingual presenter HTML decks, previews, vector PDF derivatives, and native editable PPTX derivatives. |
| Architecture diagrams | [diagrams/](diagrams/) | Editable draw.io source and SVG exports for C4, deployment, telemetry flow, and GitHub Enterprise flow. |
| Hands-on workshop | [workshop/](workshop/) | Labs and checklist for participants to build their local cockpit and understand Azure consolidation. |
| GitHub Copilot customization | [.github/](.github/) | Agents, prompts, skills, instructions, workflows, validation scripts, and repository policy. |

## Key Documents

| Document | Purpose |
| --- | --- |
| [Frontier Cockpit Playbook](docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md) | Main implementation map and operating model. |
| [Frontier Cockpit Strategy](docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md) | Offer, architecture, value proposition, and roadmap. |
| [Taxonomy And Platform Layers](docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md) | Final naming, L1 to L6 platform layers, and Fleet Overview. |
| [Python And Aspire Local Architecture](docs/FrontierCockpit_PythonAspireLocalArchitecture_v1_0_0_2026-06-18_en.md) | Python-first local architecture with Aspire, DuckDB or SQLite, Prometheus, and Grafana. |
| [Local Links Guide](docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md) | Localhost links and explanations for Aspire, Grafana dashboards, Prometheus, Tempo, and Loki. |
| [End-to-End Implementation Manual](docs/FrontierCockpit_EndToEndImplementationManual_v1_0_0_2026-06-18_en.md) | Step-by-step record of everything implemented. |
| [Architecture Diagrams](docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md) | Diagram index and validation notes. |
| [Operations Runbook](docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md) | Operations, validation, troubleshooting, security, and teardown. |
| [Workshop README](workshop/README.md) | Hands-on lab entry point. |
| [Deck README](decks/README.md) | Deck source and derivative validation rules. |

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

1. Start with [docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md](docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md).
2. Review [docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md](docs/FrontierCockpit_TaxonomyAndPlatformLayers_v1_0_0_2026-06-18_en.md) to understand the final naming.
3. Open [docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md](docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md) for the visual architecture.
4. Use [local-otel/README.md](local-otel/README.md) to start and validate the local runtime.
5. Use [workshop/README.md](workshop/README.md) to run the hands-on lab.
6. Use [docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md](docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md) for validation and troubleshooting.

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
