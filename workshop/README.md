---
title: "Frontier Developer Cockpit Hands-on Workshop"
description: "Workshop index for building a local Frontier Developer Cockpit observability cockpit from a reusable participant template."
author: "Frontier Cockpit Team"
date: "2026-07-01"
version: "1.0.1"
status: "approved"
tags: ["github-copilot", "workshop", "opentelemetry", "aspire", "grafana", "azure"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Developer Cockpit Hands-on Workshop

This folder contains a complete hands-on workshop where developers build their own local Frontier Developer Cockpit from a reusable template. The default participant path is local only. Azure synchronization is an optional platform module for teams that need a governed enterprise rollup.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.1 | 2026-07-01 | Frontier Cockpit Team | Added the participant quick start for creating a personal local dashboard from the template and aligned the workshop entry point with AI Credits. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial workshop index. |

## Purpose

The workshop helps participants leave with a working Frontier Developer Cockpit that shows real GitHub Copilot and agent telemetry, including sessions, model labels, context use, AIU, AI Credits estimates, hot/warm/cold token behavior, tool calls, content capture, and VS Code process memory. The local dashboard stays on the developer machine by default. Optional labs explain how sanitized rollups can later synchronize to Azure for enterprise history and dashboards.

The complete local cockpit requires Aspire, Prometheus, Grafana, Tempo, Loki, and the local OpenTelemetry Collector. A Python-first implementation can add DuckDB or SQLite for lightweight local analytical state, but Prometheus and Grafana remain mandatory for the dashboard UX.

## Quick Start, Create Your Own Dashboard

Use this path when the goal is for each participant to create and run their own local dashboard from the template.

| Step | Command Or Action | Expected Result |
| --- | --- | --- |
| 1 | Open the participant Git repository in VS Code Insiders. | Git metadata is available for workspace attribution. |
| 2 | `cp local-otel/workshop.env.example local-otel/workshop.env` | A local, gitignored participant configuration file exists. |
| 3 | Edit `local-otel/workshop.env`. | Participant name, role, plan, seat count, and AI Credits pool match the local scenario. |
| 4 | `local-otel/workshop-ready.sh` | Docker Desktop stack starts, the workspace is registered, telemetry is materialized, and validation runs. |
| 5 | Open `http://localhost:3300`. | The mini app shows the participant identity and the eight local views. |
| 6 | Run one real GitHub Copilot Chat or agent session in the Git repository. | Real workspace-attributed telemetry is generated. |
| 7 | Run `local-otel/workshop-ready.sh` again or click Refresh after materialization. | Sessions, tokens, cache, AI Credits estimates, Coach, and Credits views populate. |

The dashboard is a template, not a static artifact. Participants customize it through `local-otel/workshop.env`, local thresholds, and later code changes if they want to extend the React app.

Important boundaries:

- Local telemetry is operational telemetry, not official GitHub billing.
- AI Credits in the cockpit are local estimates from telemetry and configured plan values.
- Official AI Credits, spend, and adoption require GitHub billing exports, the GitHub usage dashboard, or the Copilot usage metrics API.
- Raw prompts, responses, file contents, tool arguments, and tool results stay local by default.

## Contents

| File | Purpose |
| --- | --- |
| [Lab 00, Facilitator Setup](Lab_00_FacilitatorSetup_v1_0_0_2026-06-18_en.md) | Prepare machines, accounts, scripts, and safety boundaries. |
| [Lab 01, Local Cockpit](Lab_01_LocalDeveloperCockpit_v1_0_0_2026-06-18_en.md) | Build and validate the local stack. |
| [Lab 02, Real Telemetry](Lab_02_RealTelemetryAndSessionInsights_v1_0_0_2026-06-18_en.md) | Generate real GitHub Copilot traces and materialized session metrics. |
| [Lab 03, Optimization Loop](Lab_03_ContextCostAndPromptOptimization_v1_0_0_2026-06-18_en.md) | Use dashboards to improve prompts, context, model choices, and cost awareness. |
| [Lab 04, Azure Sync](Lab_04_AzureEnterpriseSync_v1_0_0_2026-06-18_en.md) | Connect the Frontier Developer Cockpit to the Frontier FinOps Cockpit. |
| [Lab 05, GitHub Enterprise Signals](Lab_05_GitHubEnterpriseSignals_v1_0_0_2026-06-18_en.md) | Add GitHub Enterprise audit log, org settings, and Copilot metrics availability. |
| [Lab 06, Frontier Developer Cockpit Mini App](Lab_06_FrontierDeveloperCockpitMiniApp_v1_0_0_2026-06-30_en.md) | Run the local mini app from the template, set your identity, and read token efficiency and AI Credits. |
| [Dashboard UX Guide](DashboardUXGuide_v1_0_0_2026-06-18_en.md) | Improve local and Azure Grafana dashboards for developer usability. |
| [Participant Checklist](ParticipantChecklist_v1_0_0_2026-06-18_en.md) | Confirm each participant leaves with a working setup. |

## Workshop Outcomes

By the end, each participant should be able to:

- run the full local observability stack;
- create a personal local dashboard from `local-otel/workshop.env.example`;
- inspect GitHub Copilot traces in Aspire;
- use the mini app and Grafana to understand context, AIU, AI Credits estimates, cache behavior, and tool calls;
- distinguish real workspace sessions from non-workspace telemetry;
- understand what remains local and what is sent to Azure;
- explain why raw content capture stays local by default;
- explain why official AI Credits and spend require GitHub sources;
- run or understand the optional daily rollup to Azure;
- interpret enterprise and org GitHub API availability status when platform labs are in scope.

## Recommended Duration

| Format | Duration | Scope |
| --- | ---: | --- |
| Executive demo | 45 minutes | Architecture, dashboards, Azure consolidator |
| Developer lab | 2 hours | Local cockpit template, mini app, and prompt optimization |
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

Recommended participant flow:

```bash
cp local-otel/workshop.env.example local-otel/workshop.env
local-otel/workshop-ready.sh
open http://localhost:3300
```

Then generate one real GitHub Copilot Chat or agent session inside the Git repository and refresh the cockpit.

Manual stack commands are still available when you need lower-level control.

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

This workshop is approved for internal and customer-facing demos when content capture risks are explained. The default participant path is local only. Use sanitized Azure forwarding only for enterprise platform demos.

## References

- [Frontier Developer Cockpit Playbook](../docs/FrontierCockpit_Playbook_v1_0_0_2026-06-17_en.md)
- [Frontier Developer Cockpit Strategy](../docs/FrontierCockpit_Strategy_v1_0_0_2026-06-17_en.md)
- [Architecture Diagrams](../docs/FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [VS Code GitHub Copilot documentation](https://code.visualstudio.com/docs/copilot/overview)
