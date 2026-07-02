---
title: "Frontier Cockpit Local Links Guide"
description: "Local endpoint and dashboard guide for Frontier Cockpit Local, including Aspire, Grafana, Prometheus, Tempo, Loki, and developer insight dashboards."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["frontier-cockpit", "github-copilot", "local", "links", "aspire", "grafana", "prometheus", "tempo", "loki"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Local Links Guide

This guide lists the local links used by **Frontier Cockpit Local** and explains what each endpoint or dashboard shows. All endpoints bind to `127.0.0.1` only. Grafana requires a login: user `admin` with the generated password stored in `local-otel/stack/grafana-admin.env`.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-19 | Frontier Cockpit Team | Initial local endpoint and dashboard guide. |

## Table of Contents

- [1. Quick Start Links](#1-quick-start-links)
- [2. Primary Developer Views](#2-primary-developer-views)
- [3. Local Backend Endpoints](#3-local-backend-endpoints)
- [4. Recommended Daily Flow](#4-recommended-daily-flow)
- [5. Troubleshooting Links](#5-troubleshooting-links)
- [6. Data And Privacy Notes](#6-data-and-privacy-notes)
- [References](#references)

## 1. Quick Start Links

| Link | What It Is | Use It For |
| --- | --- | --- |
| [Frontier Cockpit Local Home](http://localhost:3000/d/copilot-agent-local/frontier-cockpit-local-home) | Local Grafana home dashboard | Start here for local GitHub Copilot telemetry and links to deeper dashboards. |
| [Aspire Dashboard](http://localhost:18888) | Live local GenAI trace viewer | Inspect live traces, spans, tool calls, logs, metrics, and GenAI visualization. |
| [Grafana Home](http://localhost:3000) | Local dashboard portal | Browse all local dashboards under the GitHub Copilot folder. |

## 2. Primary Developer Views

### 2.1 Frontier Cockpit Local Home

[http://localhost:3000/d/copilot-agent-local/frontier-cockpit-local-home](http://localhost:3000/d/copilot-agent-local/frontier-cockpit-local-home)

This is the local entry point for Frontier Cockpit Local. It is the friendly landing page for developers. Use it to orient yourself before opening deeper dashboards.

It should answer:

- Is the local telemetry stack running?
- Where do I go for live traces?
- Where do I go for context, token, AIU, and data-quality views?
- Which local tools are part of the cockpit?

### 2.2 Aspire Dashboard, Live GenAI Traces

[http://localhost:18888](http://localhost:18888)

Aspire is the live debug surface. Use it during or immediately after a GitHub Copilot Chat or agent session.

Use it to inspect:

- `invoke_agent` traces;
- `chat` spans;
- `execute_tool` spans;
- tool arguments and results when local content capture is enabled;
- structured logs;
- live metrics;
- GenAI telemetry visualization.

Aspire is local and trusted-only. Do not expose it publicly.

### 2.3 GitHub Copilot Context And Cost

[http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local](http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local)

This dashboard is the main view for context and cost-awareness signals.

Use it to inspect:

- input tokens;
- output tokens;
- cache-read tokens;
- cache-creation tokens;
- cold input tokens;
- hot/warm/cold context behavior;
- context-window utilization;
- AIU reported through local telemetry;
- model labels emitted by GitHub Copilot telemetry.

Use this dashboard when asking: "Am I using too much context?" or "Was this session too expensive for the task?"

### 2.4 GitHub Copilot Real Workspace Usage

[http://localhost:3000/d/copilot-real-workspace-usage-local/github-copilot-real-workspace-usage-local](http://localhost:3000/d/copilot-real-workspace-usage-local/github-copilot-real-workspace-usage-local)

This dashboard shows only real workspace-attributed sessions.

Use it to inspect:

- repository attribution;
- branch attribution;
- session counts;
- token behavior by repo and branch;
- tool-call patterns;
- content-capture metadata volume.

Use this dashboard when asking: "Which repo or branch generated this usage?"

### 2.5 GitHub Copilot Developer Coach

[http://localhost:3000/d/copilot-developer-coach-local/github-copilot-developer-coach-local](http://localhost:3000/d/copilot-developer-coach-local/github-copilot-developer-coach-local)

This dashboard is the coaching view for developer improvement.

Use it to identify:

- broad prompts that create high context use;
- repeated tool calls;
- high AIU sessions;
- low cache-read share;
- high cold context ratio;
- validation gaps;
- possible prompt improvements.

Use this dashboard when asking: "How can I work better with GitHub Copilot?"

### 2.6 GitHub Copilot Data Quality

[http://localhost:3000/d/copilot-data-quality-local/github-copilot-data-quality-local](http://localhost:3000/d/copilot-data-quality-local/github-copilot-data-quality-local)

This dashboard explains whether the data is safe to interpret.

Use it to distinguish:

- `workspace_real` data;
- `non_workspace_real` data;
- synthetic validation spans;
- not-yet-observed signals;
- GitHub API availability status;
- telemetry coverage.

Use this dashboard before presenting any metric as an insight.

### 2.7 GitHub Copilot OTel Coverage

[http://localhost:3000/d/copilot-otel-coverage-local/github-copilot-otel-coverage-local](http://localhost:3000/d/copilot-otel-coverage-local/github-copilot-otel-coverage-local)

This dashboard shows which OpenTelemetry signals have appeared locally and which have not appeared yet.

Use it to inspect:

- observed GitHub Copilot OTel signals;
- missing but expected signals;
- synthetic validation coverage;
- readiness for demos and workshops.

### 2.8 GitHub Copilot Sessions And Model Labels

[http://localhost:3000/d/copilot-sessions-models-local/github-copilot-sessions-and-model-labels-local](http://localhost:3000/d/copilot-sessions-models-local/github-copilot-sessions-and-model-labels-local)

This dashboard helps inspect individual sessions and model labels.

Use it to inspect:

- emitted model labels;
- session-level input and output tokens;
- model usage patterns;
- session trace IDs;
- data labels such as repo, branch, and usage scope.

Model labels are telemetry labels, not official billing model names.

### 2.9 VS Code Process Memory

[http://localhost:3000/d/vscode-process-memory-local/vs-code-process-memory-local](http://localhost:3000/d/vscode-process-memory-local/vs-code-process-memory-local)

This dashboard shows local OS process memory for VS Code and related Electron processes.

Use it to inspect:

- VS Code process count;
- resident memory usage;
- local resource pressure during agent work.

This is not model context memory.

## 3. Local Backend Endpoints

| Link | Component | Purpose |
| --- | --- | --- |
| [http://localhost:4318](http://localhost:4318) | OpenTelemetry Collector, HTTP | OTLP HTTP ingest endpoint for GitHub Copilot and local tools. |
| [http://localhost:4317](http://localhost:4317) | OpenTelemetry Collector, gRPC | OTLP gRPC ingest endpoint for SDKs and tools that use gRPC. |
| [http://localhost:9090](http://localhost:9090) | Prometheus | Required local metrics store and PromQL query surface. |
| [http://localhost:3200](http://localhost:3200) | Tempo | Local trace history backend used by Grafana Explore. |
| [http://localhost:3100](http://localhost:3100) | Loki | Local log and content-capture metadata backend. |
| [http://localhost:3000](http://localhost:3000) | Grafana OSS | Required friendly dashboard UX. |
| [http://localhost:18888](http://localhost:18888) | Aspire Dashboard | Required live trace and GenAI viewer. |

## 4. Recommended Daily Flow

1. Start the local stack from the root of the cloned repository:

   ```bash
   local-otel/start-full-stack.sh
   ```

2. Validate the local stack:

   ```bash
   local-otel/check-workshop-local.sh
   ```

3. Reload VS Code Insiders.
4. Run a real GitHub Copilot Chat or agent session.
5. Open Aspire to inspect the live trace.
6. Materialization runs automatically inside the Docker `copilot-otel-jobs` container. Run it manually when needed:

   ```bash
   local-otel/materialize-copilot-sessions.sh
   ```

7. Open the Frontier Cockpit Local Home dashboard.
8. Use Context and Cost, Real Workspace Usage, and Developer Coach to improve the next prompt.
9. The daily rollup also runs automatically inside the Docker `copilot-otel-jobs` container. Run it manually when needed:

   ```bash
   local-otel/daily-rollup.sh
   ```

The daily rollup also updates the local DuckDB insight store when `local-otel/frontier-local-insights.sh` is available.

## 5. Troubleshooting Links

| Symptom | Link Or Command | What To Check |
| --- | --- | --- |
| No traces in Aspire | [Aspire Dashboard](http://localhost:18888) | Confirm VS Code was reloaded after OTel settings changed. |
| No metrics in Grafana | [Prometheus](http://localhost:9090) | Confirm `copilot_real_session_*` metrics exist. |
| No historical traces | [Tempo](http://localhost:3200) | Confirm the Collector exports traces to Tempo. |
| No logs | [Loki](http://localhost:3100) | Confirm the Collector exports logs to Loki. |
| Dashboard empty | [Data Quality](http://localhost:3000/d/copilot-data-quality-local/github-copilot-data-quality-local) | Confirm data is real and workspace-attributed. |
| Local stack status unknown | `local-otel/check-workshop-local.sh` | Confirm all containers and settings are ready. |
| DuckDB insight store missing | `local-otel/frontier-local-insights.sh` | Run the local insight store manually. |

## 6. Data And Privacy Notes

- Frontier Cockpit Local is local-first and private to the developer machine.
- Content capture is disabled by default (`FRONTIER_ENABLE_CONTENT_CAPTURE=false`); Aspire can display sensitive data only when a developer opts in.
- Raw prompts, tool arguments, and tool results stay local by default.
- Frontier Cockpit Hybrid receives sanitized rollups and telemetry.
- Prometheus and Grafana are required for the complete local dashboard experience.
- DuckDB or SQLite can store derived local insights, but they do not replace Prometheus or Grafana.
- Official billing and GitHub Copilot usage metrics require GitHub-provided usage or billing sources.

## References

- [Frontier Cockpit Local Developer Guide](FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Frontier Cockpit Local Python And Aspire Local Architecture](FrontierCockpit_PythonAspireLocalArchitecture_v1_0_0_2026-06-18_en.md)
- [Frontier Cockpit Operations Runbook](FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Aspire Dashboard security considerations](https://aspire.dev/dashboard/security-considerations/)
- [Grafana dashboards documentation](https://grafana.com/docs/grafana/latest/dashboards/)
- [Grafana panels and visualizations](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/)
- [OpenTelemetry Generative AI Observability project](https://github.com/open-telemetry/community/blob/5125996b5d159ff9aaa906f9a25226a821dc7bed/projects/gen-ai.md)
