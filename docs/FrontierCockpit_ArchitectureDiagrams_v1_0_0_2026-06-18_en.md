---
title: "Frontier Cockpit Architecture Diagrams"
description: "C4 and flow diagrams for Frontier Cockpit Local, Frontier Cockpit Hybrid, telemetry flow, and GitHub Enterprise ingestion."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.2.0"
status: "approved"
tags: ["github-copilot", "architecture", "c4", "drawio", "azure", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Architecture Diagrams

This document indexes the editable and rendered architecture diagrams for Frontier Cockpit Local.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.2.0 | 2026-07-03 | Frontier Cockpit Team | Added validated Mermaid-as-code diagrams for the current local solution: refreshed C4 context and container, the complete local architecture with per-component roles, and sequence diagrams for the dashboard request path and the persistence pipeline (DuckDB long-term store). |
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
- [8. Mermaid Diagrams (Current Local Solution)](#8-mermaid-diagrams-current-local-solution)
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

## 8. Mermaid Diagrams (Current Local Solution)

The diagrams below are the up-to-date view of the local solution as code. Each block renders natively on GitHub, the sources live in [diagrams/mermaid/](../diagrams/mermaid/), and every diagram is parse-validated with the Mermaid parser before it lands. When the stack changes, update these first; the draw.io set in section 1 remains for the Azure/Hybrid material.

### 8.1 C4 Context

```mermaid
C4Context
    title Frontier Cockpit Local - C4 Context
    Person(dev, "Developer", "Works with GitHub Copilot in VS Code")
    System(cockpit, "Frontier Cockpit Local", "Local observability cockpit: usage, AI Credits, planning, session inspection")
    System_Ext(copilot, "GitHub Copilot", "Chat, agents, completions; emits OpenTelemetry")
    System_Ext(github, "GitHub billing and docs", "Official AI Credits totals, plan reference data")
    System_Ext(azure, "Frontier Cockpit Hybrid (optional)", "Azure forwarding for governed, sanitized telemetry")
    Rel(dev, copilot, "Prompts and sessions")
    Rel(copilot, cockpit, "OTLP telemetry, localhost only")
    Rel(dev, cockpit, "Reads dashboards, planner, inspector")
    Rel(cockpit, azure, "Optional sanitized forwarding")
    Rel(dev, github, "Confirms official billing")
```

### 8.2 C4 Container

```mermaid
C4Container
    title Frontier Cockpit Local - C4 Container
    Person(dev, "Developer")
    System_Boundary(host, "Developer machine - Docker or Podman, 127.0.0.1 only") {
        Container(vscode, "VS Code + Copilot", "Editor", "Emits OTLP for chat, agents, tools")
        Container(collector, "OTel Collector", "otelcol-contrib", "OTLP 4317/4318 ingest, fan-out, Prom exporter 9464")
        Container(aspire, "Aspire Dashboard", "aspire-dashboard 13.4", "Live traces and GenAI visualizer, 18888")
        Container(tempo, "Tempo", "grafana/tempo 2.6.1", "Trace history 30d, 3200")
        Container(loki, "Loki", "grafana/loki 3.3.4", "Log history 30d, 3100")
        Container(prom, "Prometheus", "prom/prometheus v3.1.0", "Metric history 30d, 9090")
        Container(registry, "Registry sidecar", "alpine + zsh", "Re-seeds model prices every 5 min")
        Container(jobs, "Jobs", "python-slim + zsh + duckdb", "Materializer 5 min, daily rollup, coverage audit")
        ContainerDb(analytics, "Analytics volume", "DuckDB + JSON", "developer_daily_rollup, long-term snapshot")
        Container(api, "Dashboard API", "Node 22", "KPIs, planner, inspector, plans, long-term history, 8080")
        Container(web, "Mini app", "React + nginx", "Cockpit UI, 3300")
        Container(grafana, "Grafana", "grafana/grafana 12.4.3", "Historical dashboards, SQLite, 3000")
    }
    Rel(dev, vscode, "Uses")
    Rel(vscode, collector, "OTLP HTTP 4318")
    Rel(collector, aspire, "OTLP")
    Rel(collector, tempo, "Traces")
    Rel(collector, loki, "Logs")
    Rel(prom, collector, "Scrapes 9464")
    Rel(registry, collector, "Price metrics")
    Rel(jobs, tempo, "Reads traces")
    Rel(jobs, collector, "Session metrics")
    Rel(jobs, analytics, "Daily rollup")
    Rel(api, prom, "PromQL")
    Rel(api, tempo, "Inspector trace lookup")
    Rel(api, analytics, "Long-term snapshot")
    Rel(web, api, "/api proxy")
    Rel(dev, web, "localhost:3300")
    Rel(dev, grafana, "localhost:3000")
    Rel(grafana, prom, "Datasource")
```

### 8.3 Complete Local Architecture and Data Flow

What each component does: the **OTel Collector** is the single ingest door (OTLP 4317/4318) and fans out to every backend while exposing metrics on 9464 for Prometheus to scrape. **Aspire Dashboard** is the live view; **Tempo/Loki/Prometheus** keep 30 days of traces/logs/metrics in Docker volumes. The **registry sidecar** republishes model prices every 5 minutes so cost estimates never expire. The **jobs container** materializes Copilot sessions from Tempo into Prometheus metrics every 5 minutes, runs the coverage audit hourly, and once a day persists per-repo aggregates into **DuckDB** in the permanent `analytics` volume, rebuilding the JSON snapshot. The **Dashboard API** computes every KPI, alert, coach card, planner forecast, and inspector timeline from those stores, and the **mini app** renders them in EN/PT-BR/ES. **Grafana** serves the 8 provisioned historical dashboards from its embedded SQLite.

```mermaid
flowchart LR
    subgraph editor["VS Code"]
        copilot["GitHub Copilot Chat + agent hosts<br/>emit OTLP telemetry"]
    end
    subgraph stack["Docker/Podman stack (127.0.0.1 only)"]
        collector["OTel Collector<br/>ingest 4317/4318, fan-out,<br/>Prometheus exporter 9464"]
        aspire["Aspire Dashboard 18888<br/>live traces, GenAI visualizer"]
        tempo["Tempo 3200<br/>traces, 30d"]
        loki["Loki 3100<br/>logs, 30d"]
        prom["Prometheus 9090<br/>metrics, 30d"]
        registry["Registry sidecar<br/>model prices every 5 min"]
        jobs["Jobs container<br/>materializer 5 min, daily rollup,<br/>coverage audit hourly"]
        analytics[("analytics volume<br/>DuckDB rollup + JSON snapshot<br/>permanent")]
        api["Dashboard API 8080<br/>summary, planner, inspector,<br/>plans, long-term history"]
        web["Mini app 3300<br/>10 views, EN/PT/ES"]
        grafana["Grafana 3000<br/>8 dashboards, SQLite"]
    end
    copilot -- "OTLP HTTP" --> collector
    collector --> aspire
    collector -- traces --> tempo
    collector -- logs --> loki
    prom -- scrape --> collector
    registry -- prices --> collector
    jobs -- "read traces" --> tempo
    jobs -- "session metrics" --> collector
    jobs -- "read metrics" --> prom
    jobs -- "daily rollup" --> analytics
    api -- PromQL --> prom
    api -- "trace lookup" --> tempo
    api -- "snapshot (ro)" --> analytics
    web -- "/api" --> api
    grafana -- datasources --> prom
    grafana -.-> tempo
    grafana -.-> loki
```

### 8.4 Sequence: Dashboard Request Path

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant Web as Mini app (3300)
    participant API as Dashboard API
    participant Prom as Prometheus
    participant Tempo as Tempo
    participant Vol as Analytics volume
    Dev->>Web: Open a view (range, workspace)
    Web->>API: GET /api/summary, /api/sessions, /api/coach
    API->>Prom: PromQL (sessions, tokens, credits, prices)
    Prom-->>API: Series
    API-->>Web: KPIs, alerts, coach cards, budget, plans
    Dev->>Web: Open Inspector for a session
    Web->>API: GET /api/inspector?traceId=...
    API->>Tempo: GET /api/traces/{id}
    Tempo-->>API: Raw spans
    API-->>Web: Event log + cache timeline + summary
    Dev->>Web: Open History (long term)
    Web->>API: GET /api/history/long-term
    API->>Vol: Read long-term-history.json
    API-->>Web: Per-day aggregates beyond 30d
```

### 8.5 Sequence: Scheduled Jobs and Long-Term Persistence

```mermaid
sequenceDiagram
    autonumber
    participant Runner as Jobs runner (zsh)
    participant Mat as materialize-copilot-sessions
    participant Tempo as Tempo
    participant Col as OTel Collector
    participant Roll as daily-rollup
    participant Ins as frontier-local-insights
    participant Prom as Prometheus
    participant Duck as DuckDB (analytics volume)
    loop every 5 minutes
        Runner->>Mat: run
        Mat->>Tempo: search + read Copilot traces
        Mat->>Col: emit copilot_real_session_* metrics
    end
    loop daily (and on first start)
        Runner->>Roll: run
        Roll->>Ins: run
        Ins->>Prom: per-repo daily aggregates
        Ins->>Duck: INSERT developer_daily_rollup
        Ins->>Duck: rebuild long-term-history.json
    end
    loop hourly
        Runner->>Col: coverage audit metrics
    end
```

## References

- [Azure architecture icons](https://learn.microsoft.com/azure/architecture/icons/)
- [GitHub Octicons](https://primer.style/octicons/)
- [Draw.io XML and mxGraph format](https://www.drawio.com/doc/faq/format-of-files)
- [Draw.io Azure shapes](https://www.drawio.com/doc/faq/shapes-azure)
- [C4 model](https://c4model.com/)
