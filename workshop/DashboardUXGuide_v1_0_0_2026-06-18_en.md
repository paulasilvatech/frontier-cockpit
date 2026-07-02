---
title: "Dashboard UX Guide"
description: "UX strategy for improving Frontier Cockpit Local and Frontier Cockpit Hybrid Grafana dashboards."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["grafana", "dashboard", "ux", "github-copilot", "observability"]
---

<!-- markdownlint-disable MD025 -->

# Dashboard UX Guide

This guide explains how to improve the Grafana dashboard experience so developers can understand their own GitHub Copilot usage and platform teams can read enterprise signals clearly.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local, repository-relative paths, containerized jobs, privacy-first defaults, per-lab durations. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial UX guide for local and Azure dashboards. |

## Table of Contents

- [1. UX Principles](#1-ux-principles)
- [2. Dashboard Personas](#2-dashboard-personas)
- [3. Local Dashboard Improvements](#3-local-dashboard-improvements)
- [4. Azure Dashboard Improvements](#4-azure-dashboard-improvements)
- [5. Recommended Navigation](#5-recommended-navigation)
- [6. Panel Design Standards](#6-panel-design-standards)
- [7. Data Quality Patterns](#7-data-quality-patterns)
- [8. Implementation Backlog](#8-implementation-backlog)
- [References](#references)

## 1. UX Principles

The dashboards should be educational, operational, and explicit about data quality.

Prometheus and Grafana are mandatory for the complete Frontier Cockpit Local dashboard experience. Aspire is the live trace viewer, while Grafana is the primary friendly dashboard surface for cards, tables, drill-down links, thresholds, and coaching panels.

| Principle | Meaning |
| --- | --- |
| Teach first | Explain what a metric means before showing conclusions. |
| Separate local and enterprise | Local full fidelity is different from Azure sanitized history. |
| Prefer questions | Organize panels around developer questions. |
| Show data quality | Mark real, auxiliary, synthetic, unavailable, and not-observed-yet data. |
| Avoid fake precision | Do not show official cost unless sourced from GitHub billing or usage exports. |
| Keep raw content local | Do not place full prompts and tool outputs in Azure dashboards. |

## 2. Dashboard Personas

| Persona | Needs |
| --- | --- |
| Developer | Improve prompts, model choices, context size, tool loops, validation. |
| Team lead | Coach behavior and find repeated friction. |
| Platform engineer | Monitor ingestion health, policy status, dashboards, storage. |
| Security | Understand content capture and redaction. |
| FinOps | Reconcile local operational signals with official billing exports. |
| Executive | See adoption, trends, and business-level outcomes. |

## 3. Local Dashboard Improvements

### 3.1 Home Dashboard

Create a local landing dashboard named **Frontier Cockpit Local Home**.

Sections:

- Start here.
- Current workspace.
- Last real session.
- Context health.
- Cost and AIU signal.
- Tool behavior.
- Data quality.
- Links to detailed dashboards.

Use card-style stat panels for the first row. Grafana stat panels should use clear labels, units, sparklines where useful, value mappings for statuses, and thresholds for risk indicators.

### 3.2 Developer Coach Dashboard

Improve with:

- question-based panel titles;
- threshold colors for context utilization;
- a prompt template panel;
- a tool-loop warning panel;
- a link to Aspire trace detail;
- a link to content capture inspector.

### 3.3 Context And Cost Dashboard

Improve with:

- hot/warm/cold stacked bar;
- AIU per session table;
- max context utilization gauge;
- model label note;
- session drill-down link to Tempo.

### 3.4 Data Quality Dashboard

Improve with:

- separate counts for `workspace_real` and `non_workspace_real`;
- synthetic validation count;
- unavailable GitHub API status;
- missing OTel signal categories;
- a plain-language explanation of what is safe to claim.

## 4. Azure Dashboard Improvements

### 4.1 Enterprise Overview

Create a first-page summary with:

- total traces and metrics ingested;
- daily workspace rollups;
- org GitHub Copilot billing/settings availability;
- enterprise audit log stream status;
- GitHub Copilot metrics availability by org;
- ingestion health and latest timestamp.

### 4.2 Org Policy Dashboard

Use GitHub API data to show:

- plan type;
- seat management setting;
- IDE Chat policy;
- CLI policy;
- platform chat policy;
- public code suggestions policy;
- GitHub Copilot metrics availability.

### 4.3 Audit Log Dashboard

Use audit log streaming and API ingestion to show:

- recent enterprise audit events;
- repository vulnerability alerts;
- workflow events;
- org-level activity;
- actor and repo filters.

## 5. Recommended Navigation

Local Grafana folder:

```text
GitHub Copilot
  01 Frontier Cockpit Local Home
  02 Real Workspace Usage
  03 Context and Cost
  04 Sessions and Model Labels
  05 Developer Coach
  06 Data Quality
  07 OTel Coverage
  08 VS Code Process Memory
```

Azure Managed Grafana folder:

```text
GitHub Copilot
  01 Enterprise Overview
  02 GitHub API Ingestion
  03 Daily Workspace Rollups
  04 Org Policies
  05 Audit Log
  06 Ingestion Health
```

## 6. Panel Design Standards

| Element | Standard |
| --- | --- |
| Title | Phrase as a question when useful. |
| Description | Explain source and caveat. |
| Unit | Always set units for tokens, bytes, percent, seconds, or count. |
| Links | Link from summary panels to drill-down dashboards. |
| Thresholds | Use green, orange, red for actionable states. |
| Tables | Keep column names friendly and sorted by latest or highest value. |
| Raw JSON | Avoid by default, use links to Aspire or Tempo for raw details. |

### 6.1 Visualization Selection

Grafana panels are the basic building blocks of the Frontier Cockpit Local dashboard UX. Use the visualization type that matches the question, not the data source.

| Question | Recommended Grafana visualization | Notes |
| --- | --- | --- |
| What is my current state? | Stat panel card | Use for last session, AIU, token count, context utilization, error count. |
| Am I improving over time? | Time series | Use for input tokens per session, cache-read share, AIU per day, tool calls per day. |
| Which session should I inspect? | Table | Use friendly columns and links to Aspire or Tempo. |
| Which repo or branch is costly? | Bar chart or table | Sort by input tokens, AIU, tool calls, or errors. |
| Is a threshold exceeded? | Gauge or bar gauge | Use for context utilization and cold context ratio. |
| What happened in detail? | Logs or table | Keep raw content out of the default view. Link to Aspire/Tempo for trace detail. |
| Which signals are missing? | Table with value mappings | Use `not_observed_yet`, `api_unavailable`, and `billing_source_required`. |

### 6.2 Card Requirements

The first row of Frontier Cockpit Local Home should be card-based. Each card must have:

- a human-readable title;
- a short panel description explaining the source;
- a unit, such as tokens, percent, count, seconds, bytes, or AIU;
- thresholds with consistent colors;
- value mappings for unavailable or missing data;
- a drill-down link when the card represents a session, repo, branch, or trace.

Recommended card set:

| Card | Source |
| --- | --- |
| Latest real session | Prometheus `copilot_real_session_*` |
| Input tokens per session | Prometheus and DuckDB rollup |
| Cache-read share | Prometheus and DuckDB rollup |
| Cold context ratio | Prometheus and DuckDB rollup |
| AIU per session | Prometheus and DuckDB rollup |
| Tool calls per session | Prometheus and DuckDB rollup |
| Error count | Prometheus and Tempo |
| Data quality status | Prometheus coverage and GitHub API status |

## 7. Data Quality Patterns

Use labels or panels to clarify:

| Status | Meaning |
| --- | --- |
| `workspace_real` | Real session with repository and branch attribution. |
| `non_workspace_real` | Real telemetry without repository attribution. |
| `synthetic_validation` | Test span or pipeline health signal. |
| `not_observed_yet` | Signal exists in reference but has not appeared locally. |
| `api_unavailable` | GitHub API returned real error such as 404, 403, or 422. |
| `billing_source_required` | Official cost requires GitHub billing or usage export. |

## 8. Implementation Backlog

### 8.1 High Priority

- Create the local Frontier Cockpit Local Home dashboard.
- Create Azure Enterprise Overview dashboard.
- Add org policy dashboard to Azure Managed Grafana.
- Add ingestion health dashboard.
- Add links from local dashboards to Aspire and Tempo.

### 8.2 Medium Priority

- Add drill-down variables for repo, branch, trace, session, and org.
- Add dashboard annotations for workshop phases.
- Add a panel that shows the latest GitHub API ingestion status.
- Add a panel that explains why GitHub Copilot metrics may return 404.

### 8.3 Optional

- Create a dashboard JSON generator to keep local and Azure dashboards consistent.
- Add managed dashboard provisioning from source-controlled JSON.
- Add screenshots for workshop materials.

## References

- [Grafana dashboard best practices](https://grafana.com/docs/grafana/latest/dashboards/)
- [Grafana panels and visualizations](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/)
- [Grafana stat visualization](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Data Quality Guide](../docs/FrontierCockpit_DataConsolidationGuide_v1_0_0_2026-06-17_en.md)
