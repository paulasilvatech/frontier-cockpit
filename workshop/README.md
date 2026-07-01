---
title: "Frontier Developer Cockpit Hands-on Workshop"
description: "Workshop index for building a local Frontier Developer Cockpit observability cockpit and connecting it to the Frontier FinOps Cockpit."
author: "Frontier Cockpit Team"
date: "2026-06-18"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "workshop", "opentelemetry", "aspire", "grafana", "azure"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Developer Cockpit Hands-on Workshop

This folder contains a complete hands-on workshop where developers build a Frontier Developer Cockpit and connect it to the Frontier FinOps Cockpit.

## Purpose

The workshop helps participants leave with a working Frontier Developer Cockpit that shows real GitHub Copilot and agent telemetry, including sessions, model labels, context use, AIU, hot/warm/cold token behavior, tool calls, content capture, and VS Code process memory. The workshop also explains how the Frontier Developer Cockpit synchronizes sanitized rollups and telemetry to Azure for enterprise history and dashboards.

The complete local cockpit requires Aspire, Prometheus, Grafana, Tempo, Loki, and the local OpenTelemetry Collector. A Python-first implementation can add DuckDB or SQLite for lightweight local analytical state, but Prometheus and Grafana remain mandatory for the dashboard UX.

## Contents

| File | Purpose |
| --- | --- |
| [Lab 00, Facilitator Setup](Lab_00_FacilitatorSetup_v1_0_0_2026-06-18_en.md) | Prepare machines, accounts, scripts, and safety boundaries. |
| [Lab 01, Local Cockpit](Lab_01_LocalDeveloperCockpit_v1_0_0_2026-06-18_en.md) | Build and validate the local stack. |
| [Lab 02, Real Telemetry](Lab_02_RealTelemetryAndSessionInsights_v1_0_0_2026-06-18_en.md) | Generate real GitHub Copilot traces and materialized session metrics. |
| [Lab 03, Optimization Loop](Lab_03_ContextCostAndPromptOptimization_v1_0_0_2026-06-18_en.md) | Use dashboards to improve prompts, context, model choices, and cost awareness. |
| [Lab 04, Azure Sync](Lab_04_AzureEnterpriseSync_v1_0_0_2026-06-18_en.md) | Connect the Frontier Developer Cockpit to the Frontier FinOps Cockpit. |
| [Lab 05, GitHub Enterprise Signals](Lab_05_GitHubEnterpriseSignals_v1_0_0_2026-06-18_en.md) | Add GitHub Enterprise audit log, org settings, and Copilot metrics availability. |
| [Lab 06, Frontier Developer Cockpit Mini App](Lab_06_FrontierDeveloperCockpitMiniApp_v1_0_0_2026-06-30_en.md) | Run the local mini app from the template, set your identity, and read token efficiency and AI credits. |
| [Dashboard UX Guide](DashboardUXGuide_v1_0_0_2026-06-18_en.md) | Improve local and Azure Grafana dashboards for developer usability. |
| [Participant Checklist](ParticipantChecklist_v1_0_0_2026-06-18_en.md) | Confirm each participant leaves with a working setup. |

## Workshop Outcomes

By the end, each participant should be able to:

- run the full local observability stack;
- inspect GitHub Copilot traces in Aspire;
- use Grafana to understand context, AIU, cache behavior, and tool calls;
- distinguish real workspace sessions from non-workspace telemetry;
- understand what remains local and what is sent to Azure;
- explain why raw content capture stays local by default;
- run or understand the daily rollup to Azure;
- interpret enterprise and org GitHub API availability status.

## Recommended Duration

| Format | Duration | Scope |
| --- | ---: | --- |
| Executive demo | 45 minutes | Architecture, dashboards, Azure consolidator |
| Developer lab | 2 hours | Local cockpit and prompt optimization |
| Platform lab | 3 hours | Local cockpit, Azure sync, GitHub APIs |
| Full workshop | 4 hours | All labs, dashboard UX, troubleshooting |

## Workshop Architecture

The workshop follows this architecture:

```text
Developer workstation
  VS Code Insiders and GitHub Copilot
        |
        v
Local OpenTelemetry Collector
        |
        +--> Aspire Dashboard
        +--> Tempo
        +--> Prometheus
        +--> Loki
        +--> Grafana local
        +--> Python materializer, optional DuckDB or SQLite insights
        +--> Azure Collector, sanitized
                 |
                 +--> Application Insights
                 +--> Log Analytics
                 +--> Azure Managed Grafana
                 +--> GitHub API and audit log enrichment
```

## How To Run

Start local stack:

```bash
~/.copilot-otel/start-full-stack.sh
```

Start hybrid local plus Azure forwarding:

```bash
~/.copilot-otel/start-full-stack.sh --hybrid
```

Validate:

```bash
~/.copilot-otel/check-otel-local.sh
```

## Status

This workshop is approved for internal and customer-facing demos when content capture risks are explained. Use sanitized Azure forwarding for enterprise demos.

## References

- [Frontier Developer Cockpit Playbook](../docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md)
- [Frontier Developer Cockpit Strategy](../docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md)
- [Architecture Diagrams](../docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [VS Code GitHub Copilot documentation](https://code.visualstudio.com/docs/copilot/overview)
