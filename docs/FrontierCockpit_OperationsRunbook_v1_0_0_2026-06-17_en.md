---
title: "Frontier Cockpit Operations Runbook"
description: "Runbook for operating, validating, troubleshooting, and tearing down Frontier Developer Cockpit and Frontier FinOps Cockpit."
author: "Frontier Cockpit Team"
date: "2026-06-17"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "operations", "runbook", "opentelemetry", "azure", "grafana"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Operations Runbook

This runbook provides operational procedures for the Frontier Developer Cockpit and the Frontier FinOps Cockpit.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial operations runbook. |

## Table of Contents

- [1. Daily Health Checks](#1-daily-health-checks)
- [2. Local Operations](#2-local-operations)
- [3. Azure Operations](#3-azure-operations)
- [4. Dashboard Operations](#4-dashboard-operations)
- [5. Troubleshooting](#5-troubleshooting)
- [6. Security Operations](#6-security-operations)
- [7. Teardown](#7-teardown)
- [References](#references)

## 1. Daily Health Checks

### 1.1 Local Readiness

```bash
~/.copilot-otel/check-otel-local.sh
```

Expected outcome:

- Docker daemon running.
- OpenTelemetry Collector running.
- Aspire Dashboard running.
- Tempo, Loki, Prometheus, Grafana, and PostgreSQL running.
- VS Code OTel user settings enabled.
- Launchd user environment configured.
- Versioned LaunchAgent templates present and installed when scheduled automation is expected.

Install user-level scheduled automation from repository templates:

```bash
~/.copilot-otel/install-launchagents.sh
```

Remove scheduled automation:

```bash
~/.copilot-otel/uninstall-launchagents.sh
```

Delete copied plist files too:

```bash
~/.copilot-otel/uninstall-launchagents.sh --delete
```

The scheduled jobs use these cadences:

| Job | Cadence | Purpose |
| --- | --- | --- |
| `com.frontier.copilot-otel-coverage` | Hourly and at load | Refresh OTel coverage metadata for the coverage dashboard. |
| `com.frontier.copilot-otel-materializer` | Every five minutes | Re-materialize recent real GitHub Copilot traces for Grafana. |
| `com.frontier.copilot-otel-vscode-memory` | Every minute | Sample VS Code process memory. |
| `com.frontier.copilot-otel-daily-rollup` | Hourly | Refresh the rolling 24-hour workspace rollup. |
| `com.frontier.copilot-otel-github-enterprise` | Hourly | Refresh GitHub Enterprise audit and metrics availability signals. |
| `com.frontier.copilot-otel-github-orgs` | Hourly | Refresh organization GitHub Copilot billing/settings and metrics availability. |

Hourly jobs keep dashboards populated with current support data, but they do not synthesize events that have not happened. Rare signals remain `not_observed_yet` until GitHub Copilot emits them or the corresponding GitHub API becomes available.

### 1.2 Real Session Materialization

```bash
~/.copilot-otel/materialize-copilot-sessions.sh
```

Expected outcome:

- Real `copilot-chat` traces are summarized.
- `copilot_real_session_*` metrics appear in Prometheus.
- Content-capture metadata appears in Loki.

### 1.3 Daily Rollup

```bash
~/.copilot-otel/daily-rollup.sh
```

Expected outcome:

- `copilot_daily_workspace_*` metrics appear in Prometheus.
- Rollup logs appear in Loki.
- When hybrid mode is enabled, rollups appear in Azure Log Analytics.

The LaunchAgent refreshes this rolling 24-hour summary every hour. The script name remains `daily-rollup.sh` because the aggregation window is 24 hours.

## 2. Local Operations

### 2.1 Start Full Local Stack

```bash
~/.copilot-otel/start-full-stack.sh
```

### 2.2 Start Hybrid Stack

```bash
~/.copilot-otel/start-full-stack.sh --hybrid
```

### 2.3 Stop Full Stack

```bash
~/.copilot-otel/stop-full-stack.sh
```

### 2.4 Reset Local History

This is destructive.

```bash
~/.copilot-otel/stop-full-stack.sh --reset
```

## 3. Azure Operations

### 3.1 Set Subscription

```bash
az account set --subscription "your-subscription-name"
```

### 3.2 Validate Deployment

```bash
~/.copilot-otel/azure/validate.sh
```

For non-dev environments, set the deployment parameters before validation:

```bash
export AZURE_LOCATION=eastus
export AZURE_WORKLOAD=agentobs
export AZURE_ENVIRONMENT_NAME=dev
export AZURE_REGION_ABBR=eus
export AZURE_INSTANCE=001
~/.copilot-otel/azure/validate.sh
```

### 3.3 Deploy

```bash
~/.copilot-otel/azure/deploy.sh
```

### 3.4 List Resources

```bash
az resource list -g rg-agentobs-dev-eus-001 -o table
```

### 3.5 Validate Azure Collector

```bash
az containerapp show \
  -g rg-agentobs-dev-eus-001 \
  -n ca-otelcol-dev-eus-001 \
  --query '{runningStatus:properties.runningStatus,provisioningState:properties.provisioningState,fqdn:properties.configuration.ingress.fqdn}' \
  -o json
```

Run the consolidated read-only runtime gate:

```bash
~/.copilot-otel/azure/check-azure-runtime.sh
```

## 4. Dashboard Operations

### 4.1 Local Dashboards

Open local Grafana:

```bash
open http://localhost:3000
```

### 4.2 Aspire Dashboard

Open Aspire:

```bash
open http://localhost:18888
```

### 4.3 Azure Managed Grafana

Open Azure dashboard:

```bash
open https://your-grafana-workspace.eus.grafana.azure.com/d/agentobs-azure-copilot-overview/github-copilot-agent-observability-azure
```

### 4.4 Reimport Azure Dashboard

```bash
az grafana dashboard import \
  -g rg-agentobs-dev-eus-001 \
  -n amg-agentobs-dev-eus01 \
  --folder "GitHub Copilot" \
  --definition ~/.copilot-otel/azure/agentobs-azure-grafana-dashboard.json \
  --overwrite true
```

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Azure returns 401 | Bearer token mismatch | Regenerate secret and update `~/.copilot-otel/azure/.env` |
| Azure Monitor warns about 8192 chars | Raw content attributes too large | Ensure `transform/azure_redact` is active |
| App Insights query returns empty | Data is in workspace-based Log Analytics tables | Query `AppTraces` and `AppMetrics` in Log Analytics |
| Grafana API returns unauthorized | Missing Grafana role assignment | Assign `Grafana Admin` or `Grafana Viewer` on the Grafana resource |
| Workspace is unknown | GitHub Copilot did not emit repo attributes | Open a Git repo and start a new session |
| Context dashboard is empty | No real workspace-attributed traces | Materialize sessions and run a real agent trace |
| Aspire asks for token | Browser token auth is active | Use container logs or anonymous mode |
| Local Collector has no Azure env | Hybrid mode not started | Start `start-full-stack.sh --hybrid` |

## 6. Security Operations

### 6.1 Content Capture

Local content capture is enabled for trusted debugging. Azure forwarding removes raw content attributes before ingestion.

### 6.2 Aspire Dashboard Security

Aspire Dashboard can display sensitive resource configuration, console logs, structured logs, traces, metrics, prompts, tool arguments, and runtime telemetry. In Frontier Developer Cockpit, Aspire must be treated as a local trusted diagnostic surface.

Security rules:

- Keep Aspire Dashboard bound to the developer machine for local workshops and daily use.
- Do not expose standalone Aspire Dashboard publicly.
- Do not treat Aspire standalone as a durable enterprise store.
- Use the local OpenTelemetry Collector as the stable ingress point for GitHub Copilot and agent telemetry.
- If Aspire standalone must accept telemetry from other processes or machines, secure the OTLP endpoint with an API key and pass it through `OTEL_EXPORTER_OTLP_HEADERS`.
- Keep raw content capture local unless a customer explicitly approves sharing.
- Use telemetry limits to avoid memory exhaustion in long-running local sessions.

### 6.3 Token Rotation

Rotate the Azure Collector bearer token if it may have been exposed:

1. Generate a new token.
2. Update Container App secret `collector-bearer-token`.
3. Restart the Container App revision.
4. Update `~/.copilot-otel/azure/.env`.
5. Restart the local hybrid Collector.

### 6.4 Access Control

Use Azure RBAC for Azure Managed Grafana access. Assign only the required role:

- Grafana Viewer for read-only users.
- Grafana Editor for dashboard authors.
- Grafana Admin for platform owners.

## 7. Teardown

### 7.1 Stop Local Stack

```bash
~/.copilot-otel/stop-full-stack.sh
```

### 7.2 Delete Azure Resources

```bash
~/.copilot-otel/azure/destroy.sh
```

This deletes `rg-agentobs-dev-eus-001` and stops Azure costs.

## References

- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [Aspire Dashboard security considerations](https://aspire.dev/dashboard/security-considerations/)
- [Azure Container Apps documentation](https://learn.microsoft.com/azure/container-apps/)
- [Azure Monitor Logs documentation](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
