---
title: "Frontier FinOps Cockpit Data Consolidation Guide"
description: "Guide for consolidating local OpenTelemetry rollups with GitHub usage, billing, repository, team, audit, and workflow data in Frontier FinOps Cockpit on Azure."
author: "Frontier Cockpit Team"
date: "2026-06-17"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "github-api", "azure-monitor", "log-analytics", "billing", "data-consolidation"]
---

<!-- markdownlint-disable MD025 -->

# Frontier FinOps Cockpit Data Consolidation Guide

This guide defines how Frontier FinOps Cockpit consolidates local GitHub Copilot OpenTelemetry data with GitHub APIs and billing exports in Azure. The goal is to create an enterprise view that combines operational agent telemetry, official adoption metrics, repository context, cost allocation, ROI, and billing data.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial data consolidation guide. |

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Data Sources](#2-data-sources)
- [3. Canonical Data Model](#3-canonical-data-model)
- [4. GitHub API Ingestion](#4-github-api-ingestion)
- [5. Billing And AI Credits Reconciliation](#5-billing-and-ai-credits-reconciliation)
- [6. Azure Storage And Query Model](#6-azure-storage-and-query-model)
- [7. Dashboard Joins](#7-dashboard-joins)
- [8. Data Quality Rules](#8-data-quality-rules)
- [9. Implementation Roadmap](#9-implementation-roadmap)
- [References](#references)

## 1. Purpose

Local OpenTelemetry data explains how agent sessions behave. GitHub APIs explain adoption, billing, users, repositories, and governance. The enterprise consolidation layer should combine both without confusing operational telemetry with official billing.

## 2. Data Sources

| Source | Type | Purpose | Status |
| --- | --- | --- | --- |
| Local OTel rollups | Operational telemetry | Workspace sessions, tokens, AIU, tools, context, errors | Implemented |
| GitHub Copilot usage metrics API | Official adoption metrics | Active users, feature use, editor and language adoption | Roadmap, availability is currently recorded when APIs return 404, 403, or 422. |
| GitHub billing or usage exports | Official cost source | AI Credits, billed usage, plan-level reconciliation | Roadmap, official source required before cost claims. |
| GitHub REST API | Metadata | Repositories, teams, org ownership, workflow runs | Partially implemented for organization policy and metrics availability status. |
| GitHub GraphQL API | Metadata | Rich repository and organization joins | Roadmap. |
| GitHub audit log | Governance | Enterprise security and policy events | Implemented for bounded API ingestion and Azure Blob Storage audit streaming. |
| Azure Resource Graph | Platform metadata | Azure resource inventory and cost joins | Optional |

## 3. Canonical Data Model

### 3.1 Workspace Session Fact

| Field | Source | Notes |
| --- | --- | --- |
| `trace_id` | OTel Tempo/AppTraces | Trace identifier |
| `session_id` | OTel resource attribute | VS Code window/session id |
| `conversation_id` | GenAI attribute | Agent conversation id |
| `repo_url` | `github.copilot.git.repository` | Workspace attribution |
| `branch` | `github.copilot.git.branch` | Branch attribution |
| `commit_sha` | `github.copilot.git.commit_sha` | Commit context |
| `agent_name` | `gen_ai.agent.name` | Agent runtime |
| `mode_bucket` | Local materializer | Inferred from real span attributes |
| `request_model_label` | `gen_ai.request.model` | Telemetry label, not billing model |
| `response_model_label` | `gen_ai.response.model` | Resolved telemetry label |
| `input_tokens` | `gen_ai.usage.input_tokens` | Operational signal |
| `output_tokens` | `gen_ai.usage.output_tokens` | Operational signal |
| `cache_read_tokens` | `gen_ai.usage.cache_read.input_tokens` | Warm or hot context |
| `cache_creation_tokens` | `gen_ai.usage.cache_creation.input_tokens` | Warming context |
| `cold_input_tokens` | Derived | Input minus cache read minus cache creation |
| `aiu` | `copilot_chat.copilot_usage_nano_aiu` | Runtime-reported AIU |
| `tool_calls` | Derived from spans | Tool count |
| `errors` | `error.type` | Error count |

### 3.2 GitHub Adoption Fact

| Field | Source | Notes |
| --- | --- | --- |
| `date` | GitHub usage metrics API | Aggregation date |
| `organization` | GitHub API | Org owner |
| `team` | GitHub API | Optional team mapping |
| `user_hash` | GitHub usage metrics | Use privacy-preserving id if available |
| `feature` | GitHub usage metrics | Chat, completions, PR, CLI, etc. |
| `editor` | GitHub usage metrics | VS Code, JetBrains, etc. |
| `language` | GitHub usage metrics | Language dimension |
| `active_users` | GitHub usage metrics | Official adoption metric |

### 3.3 Billing Fact

| Field | Source | Notes |
| --- | --- | --- |
| `billing_period` | GitHub billing export | Official reconciliation period |
| `sku` | GitHub billing export | Plan or feature SKU |
| `ai_credits` | GitHub billing export | Official credits consumed |
| `amount_usd` | Billing export | Official cost |
| `organization` | Billing export | Org or enterprise dimension |
| `repo_url` | Join when available | Optional attribution |

## 4. GitHub API Ingestion

### 4.1 Recommended Runtime

Use one of the following:

| Runtime | When To Use |
| --- | --- |
| Azure Functions timer trigger | Simple scheduled API pulls |
| Azure Container Apps job | Containerized ingestion with custom dependencies |
| GitHub Actions scheduled workflow | When GitHub-side execution is preferred |

### 4.2 Authentication

Use GitHub App credentials or fine-grained tokens according to enterprise policy. Store secrets in Azure Key Vault or GitHub Actions secrets. Do not store tokens in source files or dashboards.

### 4.3 Ingestion Pattern

```text
GitHub API or export
        |
        v
Scheduled ingestion job
        |
        v
Raw JSON staging, optional
        |
        v
Normalized records
        |
        v
Log Analytics custom table or storage-backed dataset
        |
        v
Azure Managed Grafana dashboard
```

## 5. Billing And AI Credits Reconciliation

Do not use local OTel token counts as official billing. Local OTel gives operational signals. Official reconciliation must use GitHub billing or usage exports.

Recommended reconciliation:

1. Use local OTel to identify high-cost patterns.
2. Use GitHub billing exports to confirm official charges or AI Credits.
3. Use GitHub usage metrics to identify users, teams, and features driving adoption.
4. Use repository metadata to identify enablement targets.

## 6. Azure Storage And Query Model

### 6.1 Current Tables

| Table | Current Use |
| --- | --- |
| `AppTraces` | OTel traces, sanitized content records, rollups |
| `AppMetrics` | OTel custom metrics |
| `AppDependencies` | Dependency telemetry |

### 6.2 Proposed Custom Tables

| Table | Purpose |
| --- | --- |
| `GitHubCopilotUsage_CL` | Copilot usage metrics API results |
| `GitHubCopilotBilling_CL` | Billing and AI Credits exports |
| `GitHubRepoMetadata_CL` | Repo owner, topic, team, business unit |
| `GitHubTeamMetadata_CL` | Team and org hierarchy |
| `GitHubAuditEvents_CL` | Audit and governance events |

## 7. Dashboard Joins

| Join | Purpose |
| --- | --- |
| OTel rollup to repo metadata | Show which teams own high-context sessions |
| OTel AIU to billing exports | Compare operational AIU to official billing |
| Usage metrics to repo metadata | Adoption by team or business unit |
| Audit log to agent activity | Governance and policy analysis |

## 8. Data Quality Rules

- Treat OTel as operational telemetry.
- Treat GitHub usage metrics as adoption source of truth.
- Treat billing exports as cost source of truth.
- Never infer official AI Credits from local token counts alone.
- Keep raw prompts and tool results out of Azure by default.
- Mark all joined data with source and freshness timestamp.

## 9. Implementation Roadmap

The current implementation records real availability and policy signals from GitHub APIs. It does not synthesize official adoption or billing data when those APIs are unavailable. Future work should add official exports and normalized joins only when approved sources are available.

1. Define GitHub App or token scope.
2. Create ingestion runtime in Azure.
3. Store secrets securely.
4. Pull usage metrics and repository metadata daily.
5. Normalize into Log Analytics custom tables.
6. Join with OTel daily rollups.
7. Build Azure Managed Grafana dashboards.
8. Add validation and anomaly checks.

## References

- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot usage metrics API](https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/analyzing-usage-over-time-with-the-copilot-metrics-api)
- [GitHub REST API documentation](https://docs.github.com/en/rest)
- [GitHub GraphQL API documentation](https://docs.github.com/en/graphql)
- [Azure Monitor Logs documentation](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
