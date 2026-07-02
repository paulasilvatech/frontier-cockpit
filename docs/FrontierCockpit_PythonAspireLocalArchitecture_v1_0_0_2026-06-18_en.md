---
title: "Frontier Cockpit Local Python And Aspire Local Architecture"
description: "Architecture decision and implementation guide for a Python-based Frontier Cockpit Local local runtime using Aspire, DuckDB or SQLite, Prometheus, Grafana, Tempo, and Loki."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["frontier-cockpit", "python", "aspire", "duckdb", "sqlite", "prometheus", "grafana", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Local Python And Aspire Local Architecture

This document defines the Python-based local architecture for **Frontier Cockpit Local**, using Aspire as the live local telemetry viewer and Prometheus plus Grafana as mandatory dashboard and metrics infrastructure.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial Python and Aspire local architecture guide. |

## Table of Contents

- [1. Decision Summary](#1-decision-summary)
- [2. Why Python Is Supported](#2-why-python-is-supported)
- [3. Required Local Stack](#3-required-local-stack)
- [4. DuckDB And SQLite Role](#4-duckdb-and-sqlite-role)
- [5. Aspire Role](#5-aspire-role)
- [6. Prometheus And Grafana Role](#6-prometheus-and-grafana-role)
- [7. Proposed Python Components](#7-proposed-python-components)
- [8. Data Flow](#8-data-flow)
- [9. Dashboard UX Requirements](#9-dashboard-ux-requirements)
- [10. Future Implementation Structure](#10-future-implementation-structure)
- [11. Validation](#11-validation)
- [References](#references)

## 1. Decision Summary

Frontier Cockpit Local can be implemented with Python. The recommended local architecture is:

```text
Aspire Dashboard + OpenTelemetry Collector + Python materializer + DuckDB or SQLite + Prometheus + Grafana + Tempo + Loki
```

Prometheus and Grafana are not optional in the complete Frontier Cockpit Local experience. Aspire is the live GenAI trace and resource viewer. Prometheus and Grafana are the durable metrics and dashboard experience. DuckDB or SQLite provide lightweight local analytical state and derived insights.

## 2. Why Python Is Supported

Aspire supports polyglot local development. The official Python FastAPI sample demonstrates a TypeScript AppHost with `addUvicornApp`, a Python FastAPI API, and PostgreSQL as an orchestrated resource. The database in the sample is PostgreSQL, but the pattern is not limited to PostgreSQL. A Python materializer can write local insight state to DuckDB or SQLite while Aspire still orchestrates the application and displays OpenTelemetry data.

Key Aspire capabilities relevant to Frontier Cockpit Local:

- run Python apps through Aspire AppHost;
- orchestrate containers and local services;
- configure OpenTelemetry environment variables;
- show logs, traces, metrics, resources, and health in the Dashboard;
- expose runtime data to AI coding agents through Aspire CLI and Aspire MCP;
- support VS Code debugging and resource state through the Aspire VS Code extension.

OpenTelemetry GenAI instrumentation is still evolving. The local Python materializer must therefore treat GenAI fields as optional and schema-versioned. It should store observed fields, preserve the original signal names, and mark missing or not-yet-observed signals explicitly.

## 3. Required Local Stack

The complete Frontier Cockpit Local local stack requires:

| Component | Required | Role |
| --- | --- | --- |
| Aspire Dashboard | Yes | Live trace, logs, metrics, resource view, GenAI visualization |
| OpenTelemetry Collector | Yes | Stable local OTLP ingress and routing |
| Prometheus | Yes | Durable metrics store and PromQL query layer |
| Grafana OSS | Yes | Friendly dashboards, cards, drill-down, panel UX |
| Tempo | Yes | Historical trace store for Grafana Explore and trace links |
| Loki | Yes | Historical logs and content-capture metadata |
| DuckDB or SQLite | Yes for Python insight store | Lightweight local derived insights, rollups, and coaching state |

Grafana stores its own metadata in its embedded SQLite database, so no separate database container is required. DuckDB or SQLite are the right fit for a Python-first lightweight insight database.

## 4. DuckDB And SQLite Role

DuckDB and SQLite do not replace Prometheus or Grafana. They provide lightweight local state and analytics.

| Store | Best Use |
| --- | --- |
| DuckDB | Local analytics, rollups, session summaries, joins, exported datasets |
| SQLite | Configuration, small state, cache, participant lab state |
| Prometheus | Time-series metrics, dashboard queries, thresholds, sparklines |
| Grafana | Human-friendly dashboards and cards |

Recommended default:

```text
DuckDB for local analytics and rollups.
SQLite only for small configuration state if needed.
```

## 5. Aspire Role

Aspire is the local live developer experience. It is best for:

- live GenAI trace visualization;
- fast debugging;
- resource and health views;
- logs and traces while the session is active;
- AI coding agent access to resource status, logs, traces, and docs through Aspire MCP.

Aspire standalone is not the long-term dashboard store for Frontier Cockpit Local. It keeps the live loop simple, while Prometheus, Tempo, Loki, DuckDB, and Grafana carry history and analytical UX.

## 6. Prometheus And Grafana Role

Prometheus and Grafana are mandatory for the complete local developer cockpit.

### 6.1 Prometheus

Prometheus provides:

- time-series history;
- PromQL queries;
- metric aggregation;
- thresholds and alerting patterns;
- a clean datasource for Grafana cards and charts.

### 6.2 Grafana

Grafana provides:

- dashboard cards;
- stat panels;
- tables and drill-down links;
- variables for repo, branch, model label, and session;
- value mappings for status values;
- thresholds for context utilization, AIU, errors, and missing data;
- links to Aspire and Tempo for trace detail.

Grafana is the main UX surface for developers after the live session ends.

## 7. Proposed Python Components

| Component | Purpose |
| --- | --- |
| `frontier_materializer.py` | Reads Tempo and Prometheus APIs, summarizes sessions, writes DuckDB. |
| `frontier_duckdb.py` | Defines DuckDB schema and writes rollups. |
| `frontier_exporter.py` | Exposes derived metrics to Prometheus if needed. |
| `frontier_api.py` | Optional FastAPI local API for dashboard helpers and reports. |
| `frontier_reports.py` | Generates local Markdown or HTML summaries for workshops. |
| `apphost.mts` | Aspire TypeScript AppHost for Python services and local dependencies. |

## 8. Data Flow

```text
GitHub Copilot and VS Code
        |
        v
OpenTelemetry Collector
        |
        +--> Aspire Dashboard, live view
        +--> Tempo, traces
        +--> Prometheus, metrics
        +--> Loki, logs
        +--> Python materializer
                 |
                 +--> DuckDB or SQLite
                 +--> optional Prometheus exporter
                         |
                         v
                       Grafana
```

## 9. Dashboard UX Requirements

The dashboards must be friendly, card-based, and actionable.

Required dashboard UX patterns:

- a home dashboard with cards;
- clear distinction between Frontier Cockpit Local and Frontier Cockpit Hybrid;
- cards for last session, context utilization, AIU, cache-read share, cold context, tool calls, and errors;
- value mappings for available, unavailable, not observed yet, and synthetic validation;
- drill-down links to Aspire, Tempo, and detailed dashboards;
- Prometheus-backed stat panels with sparklines;
- tables with friendly column names;
- thresholds using consistent colors;
- no raw JSON as the default user experience.

Recommended local card groups:

| Group | Cards |
| --- | --- |
| Current Work | Workspace, repo, branch, last session |
| Context Health | context utilization, hot/warm/cold, cache-read tokens |
| Model And Cost Signals | model label, AIU, input/output tokens |
| Tool Behavior | tool calls, errors, repeated tools |
| Data Quality | workspace-real, non-workspace-real, synthetic, not-observed-yet |
| Next Best Action | prompt improvements, scope recommendations, validation reminders |

## 10. Future Implementation Structure

Recommended package structure:

```text
frontier-cockpit/lite/
  apphost.mts
  README.md
  api/
    main.py
    telemetry.py
    frontier_materializer.py
    frontier_duckdb.py
    frontier_exporter.py
    requirements.txt
  data/
    frontier-insights.duckdb
  dashboards/
    frontier-developer-cockpit-home.json
  reports/
```

This structure keeps the Python local cockpit independent from the existing repository `local-otel/` kit while still compatible with it.

## 11. Validation

Validation checklist:

- `aspire --version` works.
- Aspire Dashboard opens.
- OTel Collector receives telemetry.
- Prometheus has `copilot_real_session_*` and `github_*` metrics.
- Grafana opens and renders the home dashboard.
- DuckDB file is created and receives derived session rollups.
- A real GitHub Copilot session produces visible cards.

## References

- [Aspire documentation home](https://aspire.dev/docs/)
- [OpenTelemetry Generative AI Observability project](https://github.com/open-telemetry/community/blob/5125996b5d159ff9aaa906f9a25226a821dc7bed/projects/gen-ai.md)
- [Aspire Python FastAPI and PostgreSQL sample](https://aspire.dev/reference/samples/python-fastapi-postgres/)
- [Aspire telemetry fundamentals](https://aspire.dev/fundamentals/telemetry/)
- [Aspire persistent volumes and bind mounts](https://aspire.dev/fundamentals/persist-data-volumes/)
- [Aspire MCP server for AI coding agents](https://aspire.dev/get-started/aspire-mcp-server/)
- [Aspire skills](https://aspire.dev/get-started/aspire-skills/)
- [Aspire VS Code extension 13.4 developer loop](https://devblogs.microsoft.com/aspire/aspire-vscode-extension-13-4/)
- [Grafana dashboards documentation](https://grafana.com/docs/grafana/latest/dashboards/)
- [Grafana stat visualization](https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/stat/)
