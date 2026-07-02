---
title: "Frontier Cockpit Strategy"
description: "Offer, architecture, operating model, and documentation strategy for Frontier Cockpit."
author: "Frontier Cockpit Team"
date: "2026-06-17"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "opentelemetry", "aspire", "grafana", "azure-monitor", "developer-productivity"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Strategy

This document defines the offer, architecture, documentation model, and operating strategy for **Frontier Cockpit**, the umbrella platform for GitHub Copilot and agentic development observability.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial approved strategy based on the implemented local and Azure hybrid stack. |

## Table of Contents

- [1. Executive Summary](#1-executive-summary)
- [2. Offer Definition](#2-offer-definition)
- [3. Implemented Architecture](#3-implemented-architecture)
- [4. Developer Local Cockpit](#4-developer-local-cockpit)
- [5. Frontier FinOps Cockpit](#5-frontier-finops-cockpit)
- [6. Data Classification](#6-data-classification)
- [7. Daily Sync And Enterprise History](#7-daily-sync-and-enterprise-history)
- [8. GitHub API Integration Strategy](#8-github-api-integration-strategy)
- [9. Dashboard Strategy](#9-dashboard-strategy)
- [10. Documentation Strategy](#10-documentation-strategy)
- [11. Operating Model](#11-operating-model)
- [12. Security And Privacy](#12-security-and-privacy)
- [13. Roadmap](#13-roadmap)
- [14. Validation Checklist](#14-validation-checklist)
- [References](#references)

## 1. Executive Summary

Frontier Cockpit combines **Frontier Developer Cockpit**, a local and private developer experience, with **Frontier FinOps Cockpit**, a centralized Azure experience for cost, ROI, governance, adoption, and executive insight. The platform is focused on GitHub Copilot and agentic development.

Frontier Developer Cockpit gives developers a local, private, high-fidelity observability cockpit for GitHub Copilot Chat, agent mode, tool calls, context use, token behavior, AIU signals, content capture, and VS Code process memory. Frontier FinOps Cockpit receives sanitized traces, metrics, daily rollups, GitHub Enterprise audit signals, and organization policy data in Azure for enterprise history, governance, executive dashboards, and cross-workspace analysis.

The local layer is intentionally richer than the cloud layer. Local views can include full content capture for trusted debugging. Azure receives governed telemetry, rollups, and sanitized attributes to avoid leaking prompts, source code, tool results, or oversized payloads into enterprise stores.

The OpenTelemetry GenAI ecosystem is evolving through vendor-agnostic semantic conventions and instrumentation work. Frontier Cockpit treats GenAI telemetry as a standards-aligned but evolving signal set: observed signals are used when present, missing signals are labeled as `not_observed_yet`, and official billing or usage claims remain tied to GitHub sources rather than inferred from local telemetry alone.

## 2. Offer Definition

### 2.1 Offer Name

**Frontier Cockpit**.

### 2.2 Product Family

| Product | Role |
| --- | --- |
| **Frontier Cockpit** | Umbrella platform. |
| **Frontier Developer Cockpit** | Local developer cockpit, private and non-punitive. |
| **Frontier FinOps Cockpit** | Centralized Azure cockpit for leadership, cost, ROI, governance, and Fleet Overview. |
| **L1-L6 Frontier Platform Layers** | Shared technical and operating layers feeding both cockpits. |
| **Fleet Overview** | Aggregated view across developers, repositories, cost centers, organizations, and enterprise scopes. |

### 2.3 Target Users

| User | Need | Primary View |
| --- | --- | --- |
| Individual developer | Improve prompts, reduce waste, understand model and context behavior | Local Aspire and local Grafana |
| Team lead | Coach developers and detect repeated expensive patterns | Local Grafana and Azure Managed Grafana |
| Platform engineering | Standardize telemetry, governance, retention, and dashboard templates | Azure Collector, Log Analytics, Azure Managed Grafana |
| FinOps or engineering manager | Understand usage patterns and cost drivers | Azure rollups plus GitHub billing exports |
| Customer workshop audience | Learn how agents consume context, tools, and models | Local demo cockpit plus Azure dashboard |

### 2.4 Value Proposition

The offer helps developers answer operational questions that are not visible in billing reports alone:

- Which workspace, repository, and branch produced the session?
- Which model labels were emitted by the runtime?
- How many input, output, cache-read, cache-creation, reasoning, hot, warm, and cold tokens were involved?
- How much of the context window was used?
- Which tool calls were executed and where did errors happen?
- Which prompts or tool calls were too large?
- Which sessions reported AIU usage?
- Which usage is attributable to a real workspace and which is real but not workspace-attributed?

## 3. Implemented Architecture

### 3.1 Logical Flow

```text
VS Code Insiders / GitHub Copilot Chat / Agent Host / CLI agents
        |
        v
Local OpenTelemetry Collector, localhost:4318 HTTP and 4317 gRPC
        |
        +--> Aspire Dashboard, live GenAI trace visualizer
        +--> Tempo, local trace history
        +--> Prometheus, local metrics history
        +--> Loki, local logs and content-capture records
        +--> Grafana OSS, local developer dashboards
        +--> Azure Collector, sanitized forwarding
                 |
                 +--> Application Insights
                 +--> Log Analytics
                 +--> Azure Managed Grafana
```

### 3.2 Local Stack

The local stack lives under `~/.copilot-otel` and runs with Docker Desktop.

Prometheus and Grafana are required for the complete Frontier Developer Cockpit local experience. Aspire remains the live GenAI trace and resource viewer. DuckDB or SQLite can be added for Python-first local insight storage, but they do not replace Prometheus or Grafana.

| Component | Purpose | Local endpoint |
| --- | --- | --- |
| OpenTelemetry Collector | Local ingress and fan-out | `http://localhost:4318`, `http://localhost:4317` |
| Aspire Dashboard | Live traces and GenAI visualizer | `http://localhost:18888` |
| Tempo | Local trace history | `http://localhost:3200` |
| Prometheus | Local metrics history | `http://localhost:9090` |
| Loki | Local logs and content-capture records | `http://localhost:3100` |
| Grafana OSS | Local dashboards | `http://localhost:3000` |
| PostgreSQL | Grafana local metadata | Docker volume |
| DuckDB or SQLite | Python-first local insight storage, optional implementation detail | Local file |

### 3.3 Azure Stack

The Azure deployment is in subscription `your-subscription-name`, resource group `rg-agentobs-dev-eus-001`, region `eastus`.

| Resource | Name | Purpose |
| --- | --- | --- |
| Resource group | `rg-agentobs-dev-eus-001` | Enterprise observability boundary |
| Container App | `ca-otelcol-dev-eus-001` | Azure OpenTelemetry Collector |
| Container Apps environment | `cae-agentobs-dev-eus-001` | Runtime environment for Collector |
| Application Insights | `appi-agentobs-dev-eus-001` | Application telemetry and query surface |
| Log Analytics | `log-agentobs-dev-eus-001` | Workspace-backed telemetry storage |
| Azure Monitor workspace | `amw-agentobs-dev-eus-001` | Managed Prometheus integration target |
| Azure Managed Grafana | `amg-agentobs-dev-eus01` | Enterprise dashboards |
| Managed identity | `id-agentobs-dev-eus-001` | Identity for Azure resources |

## 4. Developer Local Cockpit

The Frontier Developer Cockpit is valid for developers who want to improve usability, prompt discipline, model selection behavior, and cost awareness.

### 4.1 Local Dashboards

| Dashboard | Purpose |
| --- | --- |
| GitHub Copilot Real Workspace Usage (Local) | Real workspace-attributed sessions only |
| GitHub Copilot Context and Cost (Local) | Context window, AIU, hot/warm/cold, tokens |
| GitHub Copilot Sessions and Model Labels (Local) | Session, model labels, token split, content-capture metadata |
| GitHub Copilot Data Quality (Local) | Real vs auxiliary vs synthetic data classification |
| GitHub Copilot OTel Coverage (Local) | Observed vs not-yet-observed signals from the OTel reference |
| GitHub Copilot Developer Coach (Local) | Educational interpretation and prompt coaching |
| VS Code Process Memory (Local) | OS-level VS Code/Electron memory |

### 4.2 Developer Behaviors Supported

The cockpit supports day-to-day improvement loops:

1. Start or continue work in a Git workspace.
2. Use GitHub Copilot Chat, agent mode, plan mode, CLI, or relevant agent flows.
3. Inspect local dashboards after the session.
4. Identify waste patterns, such as high input tokens, repeated tool calls, low cache reuse, high AIU, or large content capture.
5. Improve the next prompt with clearer scope, constraints, verification, and stop conditions.

### 4.3 Prompt Improvement Pattern

A developer prompt should include:

- Objective.
- Scope.
- Relevant files or folders.
- Non-goals.
- Constraints.
- Validation command.
- Stop condition.
- Telemetry question.

Example:

```text
Objective: fix the failing validation for feature X.
Scope: only src/a.ts and src/b.ts.
Do not change generated files or audited deliverables.
Validation: run npm test -- feature-x.
Stop if you need to read more than five files or repeat the same tool twice, then summarize the blocker.
After completion, tell me whether token use, tool calls, or context utilization looked high.
```

## 5. Frontier FinOps Cockpit

The Azure layer consolidates daily and continuous telemetry for history, governance, and enterprise insight. It is not intended to store raw prompts or full tool outputs by default.

### 5.1 Azure Dashboard

Azure Managed Grafana endpoint:

```text
https://your-grafana-workspace.grafana.azure.com
```

Imported dashboard:

```text
/d/agentobs-azure-copilot-overview/github-copilot-agent-observability-azure
```

### 5.2 Azure Query Tables

The workspace-based Application Insights data appears in Log Analytics tables such as:

| Table | Purpose |
| --- | --- |
| `AppTraces` | Trace logs and sanitized content records |
| `AppMetrics` | Custom metrics, token usage, tool metrics, OTel metrics |
| `AppDependencies` | Dependency-style telemetry |

A separate `AppGenAIContent` table was checked and was not available in this environment. The implementation therefore uses `AppTraces` and `AppMetrics` for dashboards.

## 6. Data Classification

| Data class | Local handling | Azure handling |
| --- | --- | --- |
| Real GitHub Copilot traces | Aspire and Tempo | Application Insights and Log Analytics |
| Real token metrics | Prometheus | AppMetrics |
| Real AIU | Prometheus and Grafana | Rollup metrics/logs |
| Raw content capture | Local only by default | Redacted before forwarding |
| Tool arguments and results | Local only by default | Redacted before forwarding |
| Workspace registry metadata | Local helper metric | Optional rollup context |
| Synthetic test spans | Local validation only | Not used for enterprise usage dashboards |
| Daily rollups | Local and Azure | AppTraces and AppMetrics |

## 7. Daily Sync And Enterprise History

The daily rollup is implemented by `~/.copilot-otel/daily-rollup.sh` and scheduled with this user LaunchAgent:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-daily-rollup.plist
```

The rollup summarizes real workspace-attributed telemetry for the last 24 hours and emits it back through OTLP. When the hybrid stack is active, the Collector forwards those rollups to Azure.

### 7.1 Current Rollup Fields

| Field | Meaning |
| --- | --- |
| `sessions` | Count of real workspace sessions |
| `input_tokens` | Input tokens |
| `output_tokens` | Output tokens |
| `cache_read_tokens` | Warm or hot context tokens |
| `cache_creation_tokens` | Warming context tokens |
| `cold_input_tokens` | Non-cached input tokens |
| `aiu` | Real AIU reported through telemetry |
| `max_context_pct` | Peak context window utilization |
| `tool_calls` | Tool calls |
| `errors` | Error count |
| `content_chars` | Content-capture character volume, not raw content |

## 8. GitHub API Integration Strategy

Frontier FinOps Cockpit should also ingest GitHub APIs and exports. This complements local OTel rather than replacing it.

### 8.1 Data Sources

| Source | Purpose | Target |
| --- | --- | --- |
| GitHub Copilot usage metrics API | Adoption and feature usage | Log Analytics or storage staging |
| GitHub billing or usage exports | AI Credits and billing reconciliation | Storage plus Log Analytics summaries |
| GitHub REST API | Repo metadata, teams, org ownership | Log Analytics reference tables |
| GitHub GraphQL API | Rich repo and org metadata | Log Analytics reference tables |
| GitHub audit log | Enterprise governance events | Log Analytics |
| GitHub Actions API | CI/CD correlation | Log Analytics |

### 8.2 Why GitHub APIs Matter

OpenTelemetry answers operational questions from the developer machine and agent runtime. GitHub APIs answer enterprise and billing questions:

- Which users are active?
- Which features are adopted?
- Which organizations and repos drive usage?
- What is the official billing and AI Credits position?
- Which teams need enablement?

### 8.3 Integration Pattern

Recommended pattern:

```text
GitHub APIs / exports
        |
        v
Scheduled Azure job, Function, Container App job, or GitHub Actions
        |
        v
Storage staging, optional
        |
        v
Log Analytics custom tables
        |
        v
Azure Managed Grafana enterprise dashboards
```

## 9. Dashboard Strategy

### 9.1 Local Dashboard Principles

Local dashboards should:

- help the developer improve behavior;
- preserve full trace fidelity;
- show raw content only in trusted local environments;
- make data quality visible;
- distinguish model labels from official commercial model names;
- separate workspace-attributed sessions from non-workspace telemetry.

### 9.2 Azure Dashboard Principles

Azure dashboards should:

- show trends and rollups;
- avoid raw prompts and tool outputs;
- support team, repo, branch, and time filtering;
- correlate GitHub API usage with local OTel rollups;
- expose coverage and ingestion health;
- support executive and platform views.

### 9.3 Dashboard Families

| Family | Local | Azure |
| --- | --- | --- |
| Developer coaching | Yes | Optional aggregate |
| Real workspace usage | Yes | Yes |
| Context and AIU | Yes | Yes, aggregated |
| Content capture | Local only by default | Metadata only |
| Coverage audit | Yes | Yes, aggregate readiness |
| GitHub adoption | No | Yes, from GitHub APIs |
| Billing reconciliation | No | Yes, from official exports |

## 10. Documentation Strategy

### 10.1 Documentation Set

| Document | Purpose | Audience |
| --- | --- | --- |
| Strategy and offer | Describe the offer and operating model | Leaders, platform, workshop owners |
| Local setup guide | Install and run local stack | Developers |
| Dashboard guide | Explain each local dashboard | Developers and team leads |
| Data quality guide | Explain real, auxiliary, synthetic, and missing data | Everyone |
| Azure deployment guide | Deploy and validate enterprise stack | Platform engineering |
| GitHub API integration guide | Add official usage and billing data | Platform and FinOps |
| Privacy guide | Explain content capture and redaction | Security and compliance |
| Workshop runbook | Step-by-step client demo | Field and enablement |

### 10.2 Documentation Placement

Repository strategy, guide, runbook, and architecture index documents live under `docs/`. Hands-on lab material lives under `workshop/`, editable diagrams and SVG exports live under `diagrams/`, and the local runtime source lives under `local-otel/`. The user-level compatibility path remains `~/.copilot-otel/` because it configures the local machine and can be reused across workspaces.

### 10.3 Documentation Standards

- Use English for repository Markdown.
- Include references for product capabilities.
- Do not fabricate prices, model limits, or billing metrics.
- Distinguish telemetry labels from official billing dimensions.
- Distinguish local debug data from Azure enterprise data.

## 11. Operating Model

### 11.1 Developer Daily Flow

1. Open the Git repository in VS Code Insiders.
2. Work normally with GitHub Copilot Chat, agent mode, plan mode, or CLI.
3. Use Aspire for live trace debugging.
4. Use Grafana local for context, tokens, AIU, hot/warm/cold, and model labels.
5. Use the developer coach dashboard to improve prompts and agent workflow.
6. Daily rollups synchronize to Azure when hybrid mode is active.

### 11.2 Platform Flow

1. Maintain the user-level kit and dashboard templates.
2. Maintain the Azure Bicep deployment.
3. Monitor Log Analytics ingestion.
4. Add GitHub API ingestion jobs.
5. Publish Azure Managed Grafana dashboards.
6. Review privacy and content redaction policies.

## 12. Security And Privacy

### 12.1 Local Privacy

Local content capture is enabled for trusted development and workshop validation. It can include prompts, code snippets, tool schemas, tool arguments, and tool results.

### 12.2 Azure Privacy

Azure forwarding is sanitized. The local Collector removes large and sensitive content attributes before sending to the Azure Collector. Azure receives metrics, traces, rollups, and summaries.

### 12.3 Known Azure Limits

Azure Monitor and Application Insights can reject or truncate attributes that exceed practical limits. The local stack therefore keeps raw content locally and sends summary data to Azure.

## 13. Roadmap

### 13.1 Phase 1, Implemented

- Local OTel Collector.
- Aspire Dashboard with GenAI visualization support.
- Tempo, Prometheus, Loki, Grafana, and PostgreSQL local stack.
- User-level VS Code Insiders OTel settings.
- Content capture enabled locally.
- Workspace registry.
- Session materialization.
- Context and AIU dashboards.
- VS Code memory sampling.
- Azure enterprise resource group and core resources.
- Azure Managed Grafana dashboard.
- Daily local rollup with Azure forwarding.
- Python-first local architecture with Aspire and DuckDB or SQLite documented.

### 13.2 Phase 2, Recommended

- GitHub Copilot usage metrics API ingestion for organizations where the API is available.
- GitHub billing and AI Credits export ingestion from official sources.
- GitHub organization, repository, team, and branch reference tables.
- Azure Managed Grafana enterprise dashboard suite.
- Frontier Developer Cockpit Home dashboard with card-based UX.
- Python materializer using DuckDB for local analytical state.
- Data retention and cost policy.
- Role-based views for developer, team lead, platform, and FinOps.

### 13.3 Phase 3, Advanced

- Azure Functions or Container Apps job for scheduled GitHub API ingestion.
- Storage staging for raw GitHub API responses.
- Log Analytics custom tables for normalized usage.
- Alert rules for high AIU, low cache reuse, repeated tool errors, and missing workspace attribution.
- Exportable customer workshop templates.

## 14. Validation Checklist

| Check | Status |
| --- | --- |
| Local OTel stack is ready | Implemented |
| Aspire Dashboard uses latest image | Implemented |
| GenAI content capture is enabled locally | Implemented |
| Local dashboards are provisioned | Implemented |
| Workspace-attributed sessions are materialized | Implemented |
| Hot/warm/cold context is calculated from real cache attributes | Implemented |
| Real AIU is materialized from `copilot_chat.copilot_usage_nano_aiu` | Implemented |
| VS Code process memory is sampled locally | Implemented |
| Azure resource group exists | Implemented |
| Azure Collector is running | Implemented |
| Application Insights and Log Analytics receive data | Implemented |
| Azure Managed Grafana is created | Implemented |
| Azure dashboard is imported | Implemented |
| Raw content is redacted before Azure forwarding | Implemented |
| GitHub API ingestion is implemented | Planned |
| Official billing and AI Credits reconciliation is implemented | Planned |

## References

- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [OpenTelemetry Generative AI Observability project](https://github.com/open-telemetry/community/blob/5125996b5d159ff9aaa906f9a25226a821dc7bed/projects/gen-ai.md)
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)
- [Aspire Dashboard, GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Aspire Dashboard and AI coding agents](https://aspire.dev/dashboard/ai-coding-agents/)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [VS Code GitHub Copilot documentation](https://code.visualstudio.com/docs/copilot/overview)
- [GitHub Copilot usage metrics documentation](https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/analyzing-usage-over-time-with-the-copilot-metrics-api)
- [GitHub REST API documentation](https://docs.github.com/en/rest)
- [Azure Monitor documentation](https://learn.microsoft.com/azure/azure-monitor/)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
