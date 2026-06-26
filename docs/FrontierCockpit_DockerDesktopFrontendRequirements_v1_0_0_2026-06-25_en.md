---
title: "Frontier Cockpit Docker Desktop Frontend Requirements"
description: "Functional, non-functional, architecture, and acceptance requirements for the Docker Desktop hosted Frontier Developer Cockpit frontend."
author: "Frontier Cockpit Team"
date: "2026-06-25"
version: "1.0.0"
status: "approved"
tags: ["frontier-cockpit", "frontier-developer-cockpit", "docker-desktop", "frontend", "requirements", "github-copilot"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Docker Desktop Frontend Requirements

> This document defines the local Docker Desktop frontend requirements for Frontier Developer Cockpit, including datasource boundaries, runtime containers, billing semantics, and validation criteria.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-25 | Frontier Cockpit Team | Initial Docker Desktop frontend requirements. |

## Table of Contents

- [1. Audit Result](#1-audit-result)
- [2. Frontend Data Strategy](#2-frontend-data-strategy)
- [3. Proposed Docker Desktop App](#3-proposed-docker-desktop-app)
- [4. Functional Requirements](#4-functional-requirements)
- [5. Non-Functional Requirements](#5-non-functional-requirements)
- [6. Required ADRs](#6-required-adrs)
- [7. Implementation Backlog](#7-implementation-backlog)
- [8. Acceptance Criteria](#8-acceptance-criteria)
- [References](#references)

## 1. Audit Result

The current local runtime already contains the core observability services. The missing layer is a custom browser-facing application and API boundary that can safely normalize local telemetry sources without exposing secrets, raw content, or internal databases directly to the browser.

| Area | Current State | Gap |
| --- | --- | --- |
| Docker Desktop runtime | OpenTelemetry Collector, Aspire Dashboard, Prometheus, Grafana, Tempo, Loki, and PostgreSQL are defined in [local-otel/stack/docker-compose.yml](../local-otel/stack/docker-compose.yml). | No dedicated frontend app container exists yet. Model and price registry refresh must move fully into Docker when the runtime rule is "all backend services run in Docker Desktop." |
| Data sources | Prometheus, Tempo, Loki, Grafana, Aspire Dashboard, PostgreSQL, and DuckDB files exist in the local architecture. | No single application frontend and API layer normalizes these sources. |
| C4 diagrams | Existing C4 Context and C4 Container diagrams are present in [Frontier Cockpit Architecture Diagrams](./FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md) and [diagrams/](../diagrams/). | The local Docker Desktop deployment view needs to include the frontend, registry sidecar, and frontend API. |
| Additional diagrams | Azure deployment, telemetry flow, and GitHub Enterprise flow diagrams exist. | The local Docker Desktop deployment diagram needs to represent the new application layer. |
| ADRs | ADR authoring support exists in the repository customization package. | Product ADRs for the Docker Desktop runtime boundary, frontend datasource strategy, browser data boundary, billing semantics, and registry sidecar are required under `docs/adr/`. |
| Requirements | Existing guides describe architecture and operations. | A consolidated functional and non-functional requirements document for the Docker Desktop frontend app was missing before this document. |

## 2. Frontend Data Strategy

The frontend must not query every backend directly from browser code. The local cockpit should use Prometheus as the primary live metrics API, while Grafana and Aspire Dashboard remain mature deep-link surfaces for drill-down workflows.

| Source | Use In Frontend | Access Pattern |
| --- | --- | --- |
| Prometheus | Primary metrics source for AIU, tokens, USD what-if estimates, premium-request-equivalent estimates, and stack health. | Through the dashboard API proxy container, not direct browser calls. |
| Grafana | Existing dashboards, Explore views, drill-down, and mature visualization surfaces. | Deep links first, optional metadata API only when needed. |
| Aspire Dashboard | Live trace tree and GenAI visualizer. | Deep links first. API access only through the backend proxy when API key handling is required. |
| Tempo | Trace search and trace detail. | Backend proxy or Grafana Explore links. |
| Loki | Logs and content-capture metadata. | Backend proxy or Grafana Explore links. Raw log content must not be embedded by default. |
| PostgreSQL | Grafana metadata only. | Do not query directly for product analytics. |
| DuckDB | Local analytical rollups. | Backend API only, never browser direct file access. |
| GitHub billing and usage APIs | Official AI Credits, official spend, and official usage. | Future Frontier FinOps Cockpit ingestion path, not local OpenTelemetry inference. |

The frontend can use data from Aspire Dashboard, Grafana, Prometheus, Tempo, Loki, and local stores. The browser must not hold secrets, query internal databases directly, or display raw prompts, responses, file contents, tool arguments, or tool results by default.

## 3. Proposed Docker Desktop App

The target Docker Desktop runtime should include the existing observability backends plus a registry sidecar, API proxy, and static web frontend.

```text
Docker Desktop
  copilot-otel-collector
  copilot-otel-prometheus
  copilot-otel-grafana
  copilot-otel-tempo
  copilot-otel-loki
  copilot-otel-postgres
  aspire-dashboard
  copilot-otel-registry
  frontier-dashboard-api
  frontier-dashboard-web
```

VS Code Insiders and GitHub Copilot remain external telemetry producers running on the developer machine. They are not backend runtime services and should stay outside Docker Desktop.

## 4. Functional Requirements

| ID | Requirement |
| --- | --- |
| FR-001 | The system shall run the complete Frontier Developer Cockpit backend runtime through Docker Compose in Docker Desktop. |
| FR-002 | The system shall expose a single web entry point for the custom Frontier Developer Cockpit frontend. |
| FR-003 | The frontend shall show local stack health for OpenTelemetry Collector, Prometheus, Grafana, Tempo, Loki, PostgreSQL, Aspire Dashboard, the registry sidecar, and the frontend API. |
| FR-004 | The frontend shall show real AIU consumed from `copilot_real_session_nano_aiu_ratio / 1e9`. |
| FR-005 | The frontend shall label AIU as local operational telemetry, not official billing. |
| FR-006 | The frontend shall show token volume by `gen_ai_request_model` and `gen_ai_token_type`. |
| FR-007 | The frontend shall show premium-request-equivalent estimates by multiplying local LLM call counts by `copilot_model_premium_request_multiplier_ratio`. |
| FR-008 | The frontend shall label premium-request-equivalents as a planning estimate because agent mode can make multiple LLM calls per user prompt. |
| FR-009 | The frontend shall show USD what-if estimates by multiplying token counts by `copilot_model_price_usd_per_million_ratio`. |
| FR-010 | The frontend shall label USD values as local planning assumptions unless official GitHub billing data is connected. |
| FR-011 | The frontend shall provide deep links to Grafana dashboards, Aspire Dashboard live traces, Prometheus, Tempo Explore, and Loki or Grafana Explore. |
| FR-012 | The frontend shall show data quality status, including `workspace_real`, `non_workspace_real`, synthetic validation spans, and `not_observed_yet` signals when available. |
| FR-013 | The frontend shall provide model label views and explain that telemetry labels are not necessarily official billing names. |
| FR-014 | The frontend shall support a selected time range, starting with presets such as 1h, 6h, 24h, and 7d. |
| FR-015 | The frontend shall support workspace or repository filtering when repository labels are present. |
| FR-016 | The frontend shall not display raw prompts, responses, file contents, tool arguments, or tool results by default. |
| FR-017 | The frontend shall provide a safe trace drill-down path that opens Aspire Dashboard or Grafana Tempo rather than embedding raw trace content by default. |
| FR-018 | The registry sidecar shall refresh model multipliers and planning prices every 300 seconds inside Docker Desktop. |
| FR-019 | The Docker Compose stack shall not require macOS LaunchAgents for model multiplier or price refresh. |
| FR-020 | The Docker Compose stack shall preserve Prometheus, Tempo, Loki, PostgreSQL, and Grafana data in Docker volumes. |
| FR-021 | The system shall keep VS Code Insiders and GitHub Copilot as external telemetry producers running on the developer machine. |
| FR-022 | The system shall document which local processes remain outside Docker because they are telemetry producers, not backend runtime services. |
| FR-023 | The frontend shall show official billing status as unavailable until GitHub billing exports or usage metrics APIs are connected. |
| FR-024 | The frontend shall distinguish real AIU, premium-request-equivalent estimate, and USD what-if estimate in separate cards. |
| FR-025 | The frontend shall include a "Data Boundary" panel explaining what stays local and what can be forwarded to Azure. |

## 5. Non-Functional Requirements

| ID | Requirement |
| --- | --- |
| NFR-001 | The runtime shall be reproducible with `docker compose up -d --build` from `local-otel/stack`. |
| NFR-002 | The frontend shall be implemented with React, TypeScript, and Vite. |
| NFR-003 | The frontend container shall serve static assets through NGINX or an equivalent small web server. |
| NFR-004 | The frontend API shall act as the only browser-facing query proxy for Prometheus, Tempo, Loki, and optional DuckDB access. |
| NFR-005 | The frontend shall not store API keys or secrets in browser-visible code. |
| NFR-006 | The frontend shall avoid raw content display by default to protect prompts, source snippets, tool inputs, and tool results. |
| NFR-007 | The UI shall be dense, scannable, operational, and aligned with the Microsoft and Azure palette used by the repository. |
| NFR-008 | The UI shall avoid decorative marketing layout and prioritize repeat-use developer workflows. |
| NFR-009 | The frontend shall render correctly on laptop and external monitor widths. |
| NFR-010 | The frontend shall degrade gracefully when any datasource is unavailable. |
| NFR-011 | The frontend shall show explicit freshness timestamps for queried metrics. |
| NFR-012 | The frontend shall avoid fabricated metrics. Missing data shall be displayed as unavailable, not inferred. |
| NFR-013 | The frontend shall keep official billing and adoption claims out of local OpenTelemetry-only views. |
| NFR-014 | The system shall keep local retention aligned with the existing 30-day Prometheus, Tempo, and Loki retention design. |
| NFR-015 | The Docker Desktop app shall expose only required localhost ports. |
| NFR-016 | The registry sidecar shall be restartable and idempotent. Re-emitting gauges must not create duplicate logical state. |
| NFR-017 | The frontend shall use documented APIs: Prometheus `/api/v1/query`, Tempo `/api/search` and `/api/traces`, Loki `/loki/api/v1/query`, and Grafana links or APIs where needed. |
| NFR-018 | The system shall validate dashboards with `bash .github/scripts/validate-dashboards.sh`. |
| NFR-019 | The system shall validate the full workspace with the repository's existing validation task before claiming readiness. |
| NFR-020 | The documentation shall remain in English, use "GitHub Copilot", and avoid unsupported billing claims. |

## 6. Required ADRs

| ADR | Decision |
| --- | --- |
| ADR-0001 | Docker Desktop is the runtime boundary for Frontier Developer Cockpit backend services. |
| ADR-0002 | Prometheus is the primary frontend metric API, with Grafana and Aspire Dashboard as deep-link surfaces. |
| ADR-0003 | Browser code must not query PostgreSQL, DuckDB files, Aspire Dashboard API keys, or raw Loki content directly. |
| ADR-0004 | Local USD values are what-if planning estimates, while official AI Credits and spend require GitHub billing or usage exports. |
| ADR-0005 | Registry refresh for model multipliers and planning prices runs as a Docker sidecar, not macOS LaunchAgents. |

## 7. Implementation Backlog

1. Add `copilot-otel-registry` to [local-otel/stack/docker-compose.yml](../local-otel/stack/docker-compose.yml).
2. Make `register-model-price.sh` and `register-model-multiplier.sh` container-safe by allowing `FRONTIER_SKIP_ENV_ZSH=true`.
3. Remove model and price registry LaunchAgents from the active runtime path.
4. Create `local-otel/frontend` with React, TypeScript, Vite, NGINX, Dockerfile, and a Prometheus proxy.
5. Add frontend API and frontend web services to Docker Compose.
6. Add app health cards for Docker services.
7. Add metrics cards for AIU, tokens, USD what-if, and premium-request-equivalents.
8. Add drill-down links to Grafana, Aspire Dashboard, Prometheus, Tempo, and Loki.
9. Update architecture diagrams to include frontend API and registry sidecars.
10. Add product ADRs under `docs/adr/`.
11. Validate Docker Compose, dashboard JSON, docs, and the full workspace.

## 8. Acceptance Criteria

| ID | Criterion |
| --- | --- |
| AC-001 | `docker compose ps` shows the frontend, API, registry sidecar, and observability services running. |
| AC-002 | Stopping the model and price LaunchAgents does not remove multiplier or price metrics after five minutes. |
| AC-003 | The frontend loads at a localhost URL and shows AIU, token, USD what-if, and premium-request-equivalent cards. |
| AC-004 | The frontend still loads when Tempo or Loki is temporarily unavailable, with visible degraded status. |
| AC-005 | No raw prompt, response, file content, or tool result appears on the frontend by default. |
| AC-006 | Documentation states that official AI Credits and spend require GitHub billing or usage exports. |
| AC-007 | Updated C4 and deployment diagrams include the Docker Desktop frontend, API, and registry sidecar. |
| AC-008 | ADRs exist for runtime boundary, data-source strategy, and billing semantics. |
| AC-009 | `bash .github/scripts/validate-dashboards.sh` passes. |
| AC-010 | The repository validation gate passes or any unrelated pre-existing failures are documented. |

## References

- [Prometheus HTTP API](https://prometheus.io/docs/prometheus/latest/querying/api/)
- [Grafana HTTP API](https://grafana.com/docs/grafana/latest/developers/http_api/)
- [Grafana Tempo HTTP API](https://grafana.com/docs/tempo/latest/api_docs/)
- [Grafana Loki HTTP API](https://grafana.com/docs/loki/latest/reference/loki-http-api/)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [C4 model](https://c4model.com/)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot usage metrics API](https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/analyzing-usage-over-time-with-the-copilot-metrics-api)
- [GitHub model multipliers reference](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans)
