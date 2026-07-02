---
title: "Lab 04, Azure Enterprise Sync"
description: "Hands-on lab for connecting the Frontier Developer Cockpit to the Frontier FinOps Cockpit and validating sanitized telemetry."
author: "Frontier Cockpit Team"
date: "2026-06-18"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "workshop", "azure", "log-analytics", "managed-grafana"]
---

<!-- markdownlint-disable MD025 -->

# Lab 04, Azure Enterprise Sync

This lab connects the Frontier Developer Cockpit to Azure and validates enterprise consolidation.

## Goals

- Start the local stack in hybrid mode.
- Verify Azure Collector and Log Analytics ingestion.
- Open Azure Managed Grafana dashboards.
- Explain why Azure receives sanitized data.

## Step 1, Confirm Azure Context

```bash
az account set --subscription "your-subscription-name"
az account show --query '{name:name,id:id,user:user.name}' -o json
```

Expected subscription:

```text
your-subscription-name
```

## Step 2, Validate Azure Resources

```bash
az resource list -g rg-agentobs-dev-eus-001 -o table
```

Expected resources:

| Resource | Name |
| --- | --- |
| Log Analytics | `log-agentobs-dev-eus-001` |
| Application Insights | `appi-agentobs-dev-eus-001` |
| Azure Monitor workspace | `amw-agentobs-dev-eus-001` |
| Container App Collector | `ca-otelcol-dev-eus-001` |
| Azure Managed Grafana | `amg-agentobs-dev-eus01` |

## Step 3, Start Hybrid Mode

```bash
~/.copilot-otel/start-full-stack.sh --hybrid
```

The local Collector sends full data locally and sanitized data to Azure.

## Step 4, Generate Fresh Rollup

```bash
~/.copilot-otel/materialize-copilot-sessions.sh
~/.copilot-otel/daily-rollup.sh
```

## Step 5, Validate Azure Tables

```bash
ws=$(az monitor log-analytics workspace show \
  -g rg-agentobs-dev-eus-001 \
  -n log-agentobs-dev-eus-001 \
  --query customerId -o tsv)

az monitor log-analytics query -w "$ws" \
  --analytics-query "AppTraces | where TimeGenerated > ago(1h) | summarize Count=count(), Last=max(TimeGenerated) by AppRoleName | order by Count desc"

az monitor log-analytics query -w "$ws" \
  --analytics-query "AppMetrics | where TimeGenerated > ago(1h) | summarize Count=count(), Last=max(TimeGenerated) by Name | order by Count desc | take 25"
```

## Step 6, Open Azure Grafana

```text
https://your-grafana-workspace.grafana.azure.com/d/agentobs-azure-copilot-overview/github-copilot-agent-observability-azure
```

Also open:

```text
https://your-grafana-workspace.grafana.azure.com/d/agentobs-github-api-ingestion/github-api-ingestion-enterprise-and-orgs
```

## Step 7, Explain Sanitization

Azure receives sanitized telemetry. Raw prompts, tool arguments, tool results, hook inputs, and large tool definitions stay local.

This protects:

- source code;
- prompts;
- file paths and commands;
- tool output;
- customer-sensitive content;
- Azure Monitor attribute limits.

## Completion Criteria

- [ ] Participant can start hybrid mode.
- [ ] Participant can query `AppTraces` and `AppMetrics`.
- [ ] Participant can open Azure Managed Grafana.
- [ ] Participant can explain local full fidelity vs Azure sanitized history.

## References

- [Azure Enterprise Guide](../docs/FrontierCockpit_AzureEnterpriseGuide_v1_0_0_2026-06-17_en.md)
- [Azure Monitor Logs](https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview)
- [Azure Managed Grafana](https://learn.microsoft.com/azure/managed-grafana/)
