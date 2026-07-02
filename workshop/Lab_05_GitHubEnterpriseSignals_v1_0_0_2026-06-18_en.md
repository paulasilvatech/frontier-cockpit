---
title: "Lab 05, GitHub Enterprise Signals"
description: "Hands-on lab for GitHub Enterprise audit log streaming, organization GitHub Copilot policy status, and GitHub Copilot metrics availability."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github", "enterprise", "audit-log", "copilot", "workshop"]
---

<!-- markdownlint-disable MD025 -->

# Lab 05, GitHub Enterprise Signals

This lab adds GitHub Enterprise and organization API signals to Frontier Cockpit Hybrid.

Estimated duration: 45 minutes (optional).

## Goals

- Understand which GitHub Enterprise data is available.
- Ingest enterprise audit log data.
- Ingest organization GitHub Copilot billing/settings status.
- Understand why the GitHub Copilot Metrics API can return 404.
- Validate audit log streaming to Azure Blob Storage.

## Step 1, Confirm GitHub CLI Scopes

```bash
gh auth status -h github.com
```

Expected scopes include:

```text
admin:enterprise
admin:org
manage_billing:copilot
repo
workflow
```

If scopes are missing:

```bash
gh auth refresh -h github.com \
  -s admin:enterprise \
  -s read:enterprise \
  -s manage_billing:copilot \
  -s read:org
```

## Step 2, Ingest Enterprise Audit Log

Run from the cloned repository root:

```bash
local-otel/ingest-github-enterprise.sh
```

On macOS you can optionally schedule this ingestion as a host-side agent with `local-otel/install-launchagents.sh`, which installs only optional agents for GitHub Enterprise ingestion, audit stream renewal, VS Code memory sampling, and workspace registration.

Current enterprise:

```text
your-enterprise-slug
```

Expected status:

```text
audit_log_status: available
```

## Step 3, Ingest Organization GitHub Copilot Settings

Run from the cloned repository root:

```bash
local-otel/ingest-github-orgs.sh
```

This collects:

| Field | Meaning |
| --- | --- |
| `membership_role` | User role in org |
| `copilot_billing_status` | Whether billing/settings endpoint is readable |
| `plan_type` | `business`, `enterprise`, or `unknown` |
| `ide_chat` | Policy status |
| `cli` | Policy status |
| `platform_chat` | Policy status |
| `copilot_metrics_status` | Metrics API availability |
| `error_status` | API error code when unavailable |

## Step 4, Validate Azure

```bash
ws=$(az monitor log-analytics workspace show \
  -g rg-agentobs-dev-eus-001 \
  -n log-agentobs-dev-eus-001 \
  --query customerId -o tsv)

az monitor log-analytics query -w "$ws" \
  --analytics-query "AppTraces | where AppRoleName in ('github-enterprise-ingestion','github-org-ingestion') | summarize Count=count(), Last=max(TimeGenerated) by AppRoleName, tostring(Properties.record_type)"
```

## Step 5, Validate Audit Log Streaming

Check GitHub stream:

```bash
gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  /enterprises/your-enterprise-slug/audit-log/streams
```

Current expected stream:

```text
stream_id: <your-stream-id>
stream_type: Azure Blob Storage
enabled: true
container: github-audit-log
```

## Step 6, Explain GitHub Copilot Metrics Availability

The GitHub Copilot Metrics API can return 404 even when GitHub Copilot billing/settings are available. This is recorded as real availability status.

Typical causes:

- The GitHub Copilot Metrics policy is not enabled.
- The org does not have at least five active licensed users for the day.
- Metrics are delayed or unavailable for the selected org.
- The current plan or enterprise policy does not expose metrics through the API.

Do not create synthetic usage when metrics are unavailable.

## Completion Criteria

- [ ] Participant can explain enterprise audit log vs GitHub Copilot metrics.
- [ ] Participant can run enterprise ingestion.
- [ ] Participant can run org ingestion.
- [ ] Participant can open the GitHub API ingestion dashboard in Azure.
- [ ] Participant can explain why `404` is a real status, not a failed lab.

## References

- [GitHub Enterprise audit log API](https://docs.github.com/en/rest/enterprise-admin/audit-log)
- [GitHub Copilot user management API](https://docs.github.com/en/rest/copilot/copilot-user-management)
- [GitHub Copilot metrics API](https://docs.github.com/en/rest/copilot/copilot-usage)
- [Data Consolidation Guide](../docs/FrontierCockpit_DataConsolidationGuide_v1_0_0_2026-06-17_en.md)
