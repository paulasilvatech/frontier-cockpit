---
title: "Frontier Cockpit Hybrid Azure Enterprise Guide"
description: "Implementation guide for Frontier Cockpit Hybrid, the Azure enterprise experience for sanitized GitHub Copilot telemetry, daily workspace rollups, GitHub Enterprise signals, cost, governance, and leadership dashboards."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "azure", "application-insights", "log-analytics", "managed-grafana", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Hybrid Azure Enterprise Guide

This guide explains how **Frontier Cockpit Hybrid** is implemented, validated, and operated as the centralized Azure side of Frontier Cockpit.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial Azure enterprise implementation guide. |

## Table of Contents

- [1. Purpose](#1-purpose)
- [2. Deployed Resources](#2-deployed-resources)
- [3. Data Flow](#3-data-flow)
- [4. Deployment Commands](#4-deployment-commands)
- [5. Hybrid Forwarding](#5-hybrid-forwarding)
- [6. Customer Deployment Parameters](#6-customer-deployment-parameters)
- [7. Azure Data Model](#7-azure-data-model)
- [8. Dashboard Import](#8-dashboard-import)
- [9. Validation](#9-validation)
- [10. Redaction Strategy](#10-redaction-strategy)
- [11. Cost And Teardown](#11-cost-and-teardown)
- [References](#references)

## 1. Purpose

Frontier Cockpit Hybrid receives sanitized GitHub Copilot telemetry and daily rollups from developer machines. It provides central history, team and platform dashboards, cost and ROI views, governance views, Fleet Overview, and GitHub API enrichment.

## 2. Deployed Resources

| Resource | Name | Purpose |
| --- | --- | --- |
| Resource group | `rg-agentobs-dev-eus-001` | Enterprise observability boundary |
| Container App | `ca-otelcol-dev-eus-001` | Cloud OpenTelemetry Collector |
| Container Apps environment | `cae-agentobs-dev-eus-001` | Runtime environment |
| Application Insights | `appi-agentobs-dev-eus-001` | Application telemetry resource |
| Log Analytics | `log-agentobs-dev-eus-001` | Workspace-backed telemetry storage |
| Azure Monitor workspace | `amw-agentobs-dev-eus-001` | Managed Prometheus integration |
| Azure Managed Grafana | `amg-agentobs-dev-eus01` | Enterprise dashboards |
| Managed identity | `id-agentobs-dev-eus-001` | Azure resource identity |

Subscription:

```text
your-subscription-name
00000000-0000-0000-0000-000000000000
```

Region:

```text
eastus
```

## 3. Data Flow

```text
Local Collector
  full local pipelines remain local
  sanitized Azure pipelines forward to cloud Collector
        |
        v
Azure Container Apps Collector
        |
        v
Application Insights and Log Analytics
        |
        v
Azure Managed Grafana
```

The Azure Collector receives OTLP/HTTP over HTTPS with bearer token authentication. It exports to Azure Monitor through the `azuremonitor` exporter.

## 4. Deployment Commands

### 4.1 Validate

Run all commands in this guide from the root of the cloned repository.

```bash
local-otel/azure/validate.sh
```

For customer environments, override deployment parameters before validation:

```bash
export AZURE_LOCATION=eastus
export AZURE_WORKLOAD=agentobs
export AZURE_ENVIRONMENT_NAME=dev
export AZURE_REGION_ABBR=eus
export AZURE_INSTANCE=001
local-otel/azure/validate.sh
```

### 4.2 Deploy

```bash
az account set --subscription "your-subscription-name"
local-otel/azure/deploy.sh
```

`deploy.sh` preserves the dev defaults, but accepts the same `AZURE_LOCATION`, `AZURE_WORKLOAD`, `AZURE_ENVIRONMENT_NAME`, `AZURE_REGION_ABBR`, `AZURE_INSTANCE`, `AZURE_COLLECTOR_MIN_REPLICAS`, and `AZURE_COLLECTOR_MAX_REPLICAS` overrides. It writes those values plus the generated collector endpoint and token to `local-otel/azure/.env`.

### 4.3 Destroy

```bash
local-otel/azure/destroy.sh
```

The destroy script deletes `rg-agentobs-dev-eus-001` and stops the Azure cost for this environment.

## 5. Hybrid Forwarding

The local hybrid file is:

```text
local-otel/azure/.env
```

It contains:

```text
AZURE_OTLP_ENDPOINT=https://ca-otelcol-dev-eus-001.<generated-suffix>.eastus.azurecontainerapps.io
AZURE_OTLP_TOKEN=<redacted>
```

Start hybrid forwarding:

```bash
local-otel/start-full-stack.sh --hybrid
```

## 6. Customer Deployment Parameters

The resource names and subscription in this guide describe the implemented Frontier Cockpit Team dev and workshop environment. Customer deployments should parameterize these values before running the scripts.

| Parameter | Dev Value | Customer Guidance |
| --- | --- | --- |
| Azure subscription | `your-subscription-name` | Use the customer's approved subscription or landing zone subscription. |
| Region | `eastus` | Select a region that matches residency, latency, and Azure Monitor availability requirements. |
| Resource group | `rg-agentobs-dev-eus-001` | Use the customer's naming standard and environment suffix. |
| Workload token | `agentobs` | Keep or replace with the customer's workload abbreviation. |
| Environment | `dev` | Use `dev`, `test`, `prod`, or the customer's approved environment taxonomy. |
| Collector bearer token | Generated by `deploy.sh` | Store and rotate according to enterprise secret management policy. |

Do not commit `.env` files, tokens, SAS values, raw GitHub API exports, or local runtime state. The repository `.gitignore` excludes these paths for the current package.

## 7. Azure Data Model

Workspace-based Application Insights writes to Log Analytics tables.

| Table | Contents |
| --- | --- |
| `AppTraces` | Trace logs, sanitized content-capture records, daily rollups |
| `AppMetrics` | GenAI metrics, tool metrics, token metrics, rollup metrics |
| `AppDependencies` | Dependency-style telemetry |

`AppGenAIContent` was checked and is not available in this environment. The implemented dashboards therefore use `AppTraces` and `AppMetrics`.

## 8. Dashboard Import

Azure Managed Grafana endpoint:

```text
https://your-grafana-workspace.grafana.azure.com
```

Dashboard:

```text
/d/agentobs-azure-copilot-overview/github-copilot-agent-observability-azure
```

Import command:

```bash
az grafana dashboard import \
  -g rg-agentobs-dev-eus-001 \
  -n amg-agentobs-dev-eus01 \
  --folder "GitHub Copilot" \
  --definition local-otel/azure/agentobs-azure-grafana-dashboard.json \
  --overwrite true
```

## 9. Validation

### 9.1 Resource Validation

```bash
az resource list -g rg-agentobs-dev-eus-001 -o table
```

### 9.2 Container App Validation

```bash
az containerapp show \
  -g rg-agentobs-dev-eus-001 \
  -n ca-otelcol-dev-eus-001 \
  --query '{fqdn:properties.configuration.ingress.fqdn,runningStatus:properties.runningStatus,provisioningState:properties.provisioningState}' \
  -o json
```

### 9.3 Log Analytics Validation

```bash
az monitor log-analytics query \
  -w $(az monitor log-analytics workspace show -g rg-agentobs-dev-eus-001 -n log-agentobs-dev-eus-001 --query customerId -o tsv) \
  --analytics-query 'AppTraces | summarize Count=count() by AppRoleName | order by Count desc'
```

### 9.4 Metrics Validation

```bash
az monitor log-analytics query \
  -w $(az monitor log-analytics workspace show -g rg-agentobs-dev-eus-001 -n log-agentobs-dev-eus-001 --query customerId -o tsv) \
  --analytics-query 'AppMetrics | summarize Count=count(), Sum=sum(Sum) by Name | order by Count desc | take 20'
```

### 9.5 Runtime Validation Script

Run the read-only Azure runtime gate after deployment or before a customer demo:

```bash
local-otel/azure/check-azure-runtime.sh
```

The script checks the resource group, Container App running state, Log Analytics workspace queries, and Azure Managed Grafana readability. It does not deploy, delete, or rotate secrets.

## 10. Redaction Strategy

The Azure forwarding pipeline removes large or sensitive content attributes before sending data to Azure.

Redacted attributes include:

- `gen_ai.input.messages`
- `gen_ai.output.messages`
- `gen_ai.system_instructions`
- `gen_ai.tool.definitions`
- `gen_ai.tool.call.arguments`
- `gen_ai.tool.call.result`
- `copilot_chat.user_request`
- `copilot_chat.reasoning_content`
- `copilot_chat.hook_input`
- `copilot_chat.hook_output`
- `copilot_chat.request.shape`
- `github.copilot.tool.parameters.command`
- `toolDefinitions`

Local Aspire, Tempo, and Loki retain full fidelity for trusted debugging.

## 11. Cost And Teardown

Azure resources incur cost while deployed. Delete the resource group when the environment is not needed:

```bash
local-otel/azure/destroy.sh
```

Do not rely on local telemetry for official billing reconciliation. Official cost and AI Credits require GitHub billing or usage exports.

## References

- [Azure Monitor documentation](https://learn.microsoft.com/azure/azure-monitor/)
- [Application Insights documentation](https://learn.microsoft.com/azure/azure-monitor/app/app-insights-overview)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
- [Azure Container Apps documentation](https://learn.microsoft.com/azure/container-apps/)
- [OpenTelemetry Collector Azure Monitor exporter](https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/exporter/azuremonitorexporter)
