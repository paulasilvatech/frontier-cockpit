---
title: "Frontier Cockpit Architecture Diagrams"
description: "C4 and flow diagrams for Frontier Cockpit Local, Frontier Cockpit Hybrid, telemetry flow, and GitHub Enterprise ingestion."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "architecture", "c4", "drawio", "azure", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Architecture Diagrams

This document indexes the editable and rendered architecture diagrams for Frontier Cockpit Local.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial architecture diagram set. |

## Table of Contents

- [1. Diagram Sources](#1-diagram-sources)
- [2. C4 Context](#2-c4-context)
- [3. C4 Container](#3-c4-container)
- [4. Azure Deployment](#4-azure-deployment)
- [5. Telemetry Flow](#5-telemetry-flow)
- [6. GitHub Enterprise Flow](#6-github-enterprise-flow)
- [7. Diagram Validation](#7-diagram-validation)
- [References](#references)

## 1. Diagram Sources

The editable draw.io source is the source of truth:

[diagrams/FrontierCockpit_Architecture_v1_0_0_2026-06-18.drawio](../diagrams/FrontierCockpit_Architecture_v1_0_0_2026-06-18.drawio)

The `.drawio` file contains five pages:

| Page | Purpose |
| --- | --- |
| C4 Context | Executive context for Frontier Cockpit Local and Frontier Cockpit Hybrid |
| C4 Container | Local and Azure component map |
| Azure Deployment | Azure resources and boundaries |
| Telemetry Flow | Full-fidelity local path and sanitized Azure path |
| GitHub Enterprise Flow | GitHub Enterprise APIs, audit stream, org status, and Azure consolidation |

The diagrams use draw.io Azure and GitHub stencil references where product icons apply. Generic shapes are used only for local processes and conceptual boundaries.

## 2. C4 Context

This diagram shows the main actors, Frontier Cockpit Local, Frontier Cockpit Hybrid, and the GitHub Enterprise API/audit-log source.

![C4 context diagram](../diagrams/FrontierCockpit_c4-context_v1_0_0_2026-06-18.svg)

## 3. C4 Container

This diagram breaks the system into local runtime containers and Azure runtime services.

![C4 container diagram](../diagrams/FrontierCockpit_c4-container_v1_0_0_2026-06-18.svg)

## 4. Azure Deployment

This diagram shows the deployed Azure resources in subscription `your-subscription-name`, resource group `rg-agentobs-dev-eus-001`, region `eastus`.

![Azure deployment diagram](../diagrams/FrontierCockpit_azure-deployment_v1_0_0_2026-06-18.svg)

## 5. Telemetry Flow

This diagram shows how local telemetry remains full fidelity while Azure receives sanitized traces, metrics, logs, and daily rollups.

![Telemetry flow diagram](../diagrams/FrontierCockpit_telemetry-flow_v1_0_0_2026-06-18.svg)

## 6. GitHub Enterprise Flow

This diagram shows how GitHub Enterprise audit log APIs, audit log streaming, organization policy checks, and GitHub Copilot metrics availability flow into Azure.

![GitHub Enterprise flow diagram](../diagrams/FrontierCockpit_github-enterprise-flow_v1_0_0_2026-06-18.svg)

## 7. Diagram Validation

Validation command:

```bash
python3 .github/skills/azure-architecture-diagrams/scripts/validate_drawio.py \
  frontier-cockpit/diagrams/FrontierCockpit_Architecture_v1_0_0_2026-06-18.drawio \
  --require-icon \
  --require-edge
```

Validation result:

```text
OK: 5 page(s), 51 vertex node(s), 42 edge(s), 44 icon/generic node style(s)
```

SVG export command pattern:

```bash
drawio -x -f svg --embed-svg-images --embed-svg-fonts true -p <page> -o <output.svg> \
  frontier-cockpit/diagrams/FrontierCockpit_Architecture_v1_0_0_2026-06-18.drawio
```

## References

- [Azure architecture icons](https://learn.microsoft.com/azure/architecture/icons/)
- [GitHub Octicons](https://primer.style/octicons/)
- [Draw.io XML and mxGraph format](https://www.drawio.com/doc/faq/format-of-files)
- [Draw.io Azure shapes](https://www.drawio.com/doc/faq/shapes-azure)
- [C4 model](https://c4model.com/)
