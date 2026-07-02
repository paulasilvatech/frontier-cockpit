---
title: "Frontier Cockpit End-to-End Implementation Manual"
description: "Step-by-step implementation manual for Frontier Developer Cockpit, Frontier FinOps Cockpit, GitHub Enterprise ingestion, audit log streaming, and dashboard validation."
author: "Frontier Cockpit Team"
date: "2026-06-18"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "opentelemetry", "azure", "aspire", "grafana", "implementation"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit End-to-End Implementation Manual

This manual documents the complete implementation sequence for Frontier Cockpit, from Frontier Developer Cockpit setup through Frontier FinOps Cockpit consolidation and GitHub Enterprise audit-log streaming.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial end-to-end implementation manual. |

## Table of Contents

- [1. Implementation Scope](#1-implementation-scope)
- [2. Prerequisites](#2-prerequisites)
- [3. Local Developer Cockpit Setup](#3-local-developer-cockpit-setup)
- [4. Local Data Materialization](#4-local-data-materialization)
- [5. Azure Enterprise Deployment](#5-azure-enterprise-deployment)
- [6. Hybrid Forwarding](#6-hybrid-forwarding)
- [7. GitHub Enterprise And Organization Ingestion](#7-github-enterprise-and-organization-ingestion)
- [8. Audit Log Streaming To Azure Blob Storage](#8-audit-log-streaming-to-azure-blob-storage)
- [9. Dashboard Provisioning](#9-dashboard-provisioning)
- [10. Validation Commands](#10-validation-commands)
- [11. Operational Warnings](#11-operational-warnings)
- [12. Architecture Diagrams](#12-architecture-diagrams)
- [References](#references)

## 1. Implementation Scope

This implementation provides two coordinated layers.

| Layer | Purpose | Implementation Status |
| --- | --- | --- |
| Local developer cockpit | Full fidelity local observability for GitHub Copilot Chat, agent work, context, AIU, tool calls, and content capture | Implemented |
| Frontier FinOps Cockpit | Sanitized enterprise history, rollups, dashboards, GitHub Enterprise API ingestion, and audit-log streaming | Implemented with known API availability limits |

The implementation does not treat local OpenTelemetry values as official billing. Official GitHub Copilot billing and AI Credits still require GitHub billing or usage exports.

## 2. Prerequisites

### 2.1 Local Tools

| Tool | Purpose |
| --- | --- |
| VS Code Insiders | GitHub Copilot Chat and agent work |
| Docker Desktop | Local OpenTelemetry stack |
| Azure CLI | Azure deployment and validation |
| GitHub CLI | GitHub Enterprise and organization API ingestion |
| Python 3 | Script support and GitHub stream encryption |
| Node.js and npm | MCP server runtime support |

### 2.2 Accounts And Permissions

| System | Required Access |
| --- | --- |
| Azure | Contributor or sufficient permission on subscription `your-subscription-name` |
| GitHub | `admin:enterprise`, `admin:org`, `manage_billing:copilot`, `repo`, `workflow` scopes in GitHub CLI |
| Firecrawl | Firecrawl API key supplied through secure MCP input |

## 3. Local Developer Cockpit Setup

### 3.1 User-Level Configuration

The local kit lives in:

```text
~/.copilot-otel
```

Key files:

| File | Purpose |
| --- | --- |
| `env.zsh` | User-level OpenTelemetry environment |
| `enable-user-env.sh` | Loads OTel variables into macOS `launchd` |
| `check-otel-local.sh` | Validates local readiness |
| `start-full-stack.sh` | Starts local or hybrid stack |
| `stop-full-stack.sh` | Stops local stack |
| `auto-start.sh` | Login-time automatic startup |

### 3.2 VS Code Settings

The setup enables:

| Setting | Value |
| --- | --- |
| `github.copilot.chat.otel.enabled` | `true` |
| `github.copilot.chat.otel.exporterType` | `otlp-http` |
| `github.copilot.chat.otel.otlpEndpoint` | `http://localhost:4318` |
| `github.copilot.chat.otel.captureContent` | `true` |
| `github.copilot.chat.otel.maxAttributeSizeChars` | `0` |
| `github.copilot.chat.otel.dbSpanExporter.enabled` | `true` |
| `chat.agentHost.otel.enabled` | `true` |
| `chat.agentHost.otel.captureContent` | `true` |
| `OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT` | `true` |

### 3.3 Local Stack

Start local only:

```bash
~/.copilot-otel/start-full-stack.sh
```

Start hybrid local plus Azure forwarding:

```bash
~/.copilot-otel/start-full-stack.sh --hybrid
```

Validate:

```bash
~/.copilot-otel/check-otel-local.sh
```

## 4. Local Data Materialization

### 4.1 Real Session Materializer

Script:

```text
~/.copilot-otel/materialize-copilot-sessions.sh
```

Purpose:

- reads real `copilot-chat` traces from Tempo;
- separates `workspace_real` from `non_workspace_real`;
- emits `copilot_real_session_*` metrics;
- emits content-capture metadata to Loki;
- never fabricates usage.

### 4.2 Daily Rollup

Script:

```text
~/.copilot-otel/daily-rollup.sh
```

Schedule:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-daily-rollup.plist
```

Daily rollup fields:

| Field | Meaning |
| --- | --- |
| `sessions` | Real workspace session count |
| `input_tokens` | Input tokens |
| `output_tokens` | Output tokens |
| `cache_read_tokens` | Warm or hot cached context |
| `cache_creation_tokens` | Warming context |
| `cold_input_tokens` | Non-cached context |
| `aiu` | Real AIU from telemetry |
| `max_context_pct` | Peak context utilization |
| `tool_calls` | Tool calls |
| `errors` | Error count |
| `content_chars` | Content-capture character volume |

### 4.3 VS Code Process Memory

Script:

```text
~/.copilot-otel/sample-vscode-memory.sh
```

Schedule:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-vscode-memory.plist
```

This samples OS-level process memory. It is not model context memory.

## 5. Azure Enterprise Deployment

### 5.1 Subscription And Resource Group

```text
Subscription: your-subscription-name
Subscription ID: 00000000-0000-0000-0000-000000000000
Resource group: rg-agentobs-dev-eus-001
Region: eastus
```

### 5.2 Resources

| Resource | Name |
| --- | --- |
| Log Analytics | `log-agentobs-dev-eus-001` |
| Application Insights | `appi-agentobs-dev-eus-001` |
| Azure Monitor workspace | `amw-agentobs-dev-eus-001` |
| Managed identity | `id-agentobs-dev-eus-001` |
| Container Apps environment | `cae-agentobs-dev-eus-001` |
| Azure Collector Container App | `ca-otelcol-dev-eus-001` |
| Azure Managed Grafana | `amg-agentobs-dev-eus01` |

### 5.3 Deployment Commands

```bash
az account set --subscription "your-subscription-name"
~/.copilot-otel/azure/validate.sh
~/.copilot-otel/azure/deploy.sh
```

### 5.4 Azure Managed Grafana

Endpoint:

```text
https://your-grafana-workspace.grafana.azure.com
```

Dashboards imported:

| Dashboard | UID |
| --- | --- |
| Frontier Developer Cockpit, Azure | `agentobs-azure-copilot-overview` |
| GitHub API Ingestion, Enterprise and Orgs | `agentobs-github-api-ingestion` |

## 6. Hybrid Forwarding

### 6.1 Local Hybrid Configuration

File:

```text
~/.copilot-otel/azure/.env
```

Contains:

```text
AZURE_OTLP_ENDPOINT=<Azure Collector HTTPS endpoint>
AZURE_OTLP_TOKEN=<redacted bearer token>
```

### 6.2 Sanitization

Local and Azure Collectors redact large and sensitive attributes before Azure Monitor ingestion.

Redacted fields include:

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

## 7. GitHub Enterprise And Organization Ingestion

### 7.1 Enterprise Audit Log And Copilot Metrics Status

Script:

```text
~/.copilot-otel/ingest-github-enterprise.sh
```

Schedule:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-github-enterprise.plist
```

Current enterprise:

```text
your-enterprise-slug
```

Current result:

| Signal | Status |
| --- | --- |
| Enterprise audit log | Available |
| Enterprise Copilot metrics | Not available, API returned 404 |

### 7.2 Organization Policy And Metrics Availability

Script:

```text
~/.copilot-otel/ingest-github-orgs.sh
```

Schedule:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-github-orgs.plist
```

Current result:

| Metric | Value |
| --- | ---: |
| Visible organizations | 32 |
| Admin organizations | 23 |
| Copilot billing/settings visible | 23 |
| Copilot Business organizations | 18 |
| IDE Chat enabled organizations | 23 |
| CLI enabled organizations | 19 |
| Copilot metrics available organizations | 0 |

The API exposes Copilot billing/settings with `GET /orgs/{org}/copilot/billing`. GitHub documentation states that policy changes are made in organization settings on GitHub.com, not through this endpoint.

## 8. Audit Log Streaming To Azure Blob Storage

### 8.1 Storage

| Resource | Value |
| --- | --- |
| Storage account | `yourstorageaccount` |
| Container | `github-audit-log` |
| SAS kind | User Delegation SAS |
| Stream id | `7222` |
| Stream type | `Azure Blob Storage` |
| Stream enabled | `true` |

### 8.2 Why User Delegation SAS

The storage account blocks Shared Key authentication:

```text
allowSharedKeyAccess=false
```

Therefore, account-key SAS is not permitted. The implementation uses User Delegation SAS signed through Entra ID.

### 8.3 GitHub Stream Configuration

Script:

```text
~/.copilot-otel/configure-github-audit-stream.sh
```

Schedule:

```text
~/Library/LaunchAgents/com.frontier.copilot-otel-github-audit-stream-renewal.plist
```

The script:

1. Generates a User Delegation SAS.
2. Validates upload to the target container.
3. Fetches the GitHub Enterprise audit-log stream public key.
4. Encrypts the SAS URL using PyNaCl sealed box encryption.
5. Creates or updates the GitHub audit log stream through the REST API.
6. Stores local state securely.

## 9. Dashboard Provisioning

### 9.1 Local Dashboards

Local dashboards live under:

```text
~/.copilot-otel/stack/grafana/dashboards
```

### 9.2 Azure Dashboards

Azure dashboard JSON files live under:

```text
~/.copilot-otel/azure
```

Import commands:

```bash
az grafana dashboard import \
  -g rg-agentobs-dev-eus-001 \
  -n amg-agentobs-dev-eus01 \
  --folder "GitHub Copilot" \
  --definition ~/.copilot-otel/azure/agentobs-azure-grafana-dashboard.json \
  --overwrite true

az grafana dashboard import \
  -g rg-agentobs-dev-eus-001 \
  -n amg-agentobs-dev-eus01 \
  --folder "GitHub Copilot" \
  --definition ~/.copilot-otel/azure/github-api-ingestion-dashboard.json \
  --overwrite true
```

## 10. Validation Commands

### 10.1 Local

```bash
~/.copilot-otel/check-otel-local.sh
~/.copilot-otel/audit-coverage.sh
~/.copilot-otel/materialize-copilot-sessions.sh
~/.copilot-otel/daily-rollup.sh
```

### 10.2 Azure Telemetry

```bash
ws=$(az monitor log-analytics workspace show \
  -g rg-agentobs-dev-eus-001 \
  -n log-agentobs-dev-eus-001 \
  --query customerId -o tsv)

az monitor log-analytics query -w "$ws" \
  --analytics-query "AppTraces | summarize Count=count(), Last=max(TimeGenerated) by AppRoleName | order by Count desc"

az monitor log-analytics query -w "$ws" \
  --analytics-query "AppMetrics | summarize Count=count(), Last=max(TimeGenerated) by Name | order by Count desc | take 25"
```

### 10.3 GitHub Enterprise Stream

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /enterprises/your-enterprise-slug/audit-log/streams
```

## 11. Operational Warnings

- Do not expose the SAS URL in shared logs.
- User Delegation SAS must be renewed regularly.
- Copilot Metrics API can return 404 even when Copilot billing/settings are available.
- A 404 for Copilot Metrics is recorded as real availability status, not replaced with synthetic data.
- Raw prompt/tool content stays local by default.
- Azure receives sanitized telemetry and rollups.

## 12. Architecture Diagrams

The full editable and rendered diagram set is documented in [FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md](FrontierCockpit_ArchitectureDiagrams_v1_0_0_2026-06-18_en.md).

The draw.io source contains C4 context, C4 container, Azure deployment, telemetry flow, and GitHub Enterprise flow diagrams.

## References

- [GitHub Copilot user management API](https://docs.github.com/en/rest/copilot/copilot-user-management)
- [GitHub Copilot metrics API](https://docs.github.com/en/rest/copilot/copilot-usage)
- [GitHub Enterprise audit log API](https://docs.github.com/en/rest/enterprise-admin/audit-log)
- [Azure Blob Storage user delegation SAS](https://learn.microsoft.com/azure/storage/blobs/storage-blob-user-delegation-sas-create-cli)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
