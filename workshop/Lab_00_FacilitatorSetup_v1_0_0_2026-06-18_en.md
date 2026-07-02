---
title: "Lab 00, Facilitator Setup"
description: "Preparation checklist for running the Frontier Cockpit Local hands-on workshop."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "workshop", "setup", "facilitator"]
---

<!-- markdownlint-disable MD025 -->

# Lab 00, Facilitator Setup

This lab prepares the facilitator environment and defines safety boundaries for the hands-on workshop.

Estimated duration: 45 minutes.

## Goals

- Confirm local tools are installed.
- Confirm GitHub and Azure authentication.
- Confirm the local observability stack is available.
- Confirm whether Azure enterprise synchronization is in scope.
- Explain privacy boundaries before content capture is used.

## Prerequisites

| Requirement | Validation Command |
| --- | --- |
| VS Code Insiders | Open VS Code Insiders |
| GitHub Copilot access | Run a simple GitHub Copilot Chat prompt |
| Docker Desktop | `docker info` |
| Azure CLI | `az account show` |
| GitHub CLI | `gh auth status -h github.com` |
| Node.js and npm | `node --version && npm --version` |
| Python 3 | `python3 --version` |
| Prometheus and Grafana | Provided by the Docker stack, required for the complete local dashboard experience |

## Setup Validation

Run from the cloned repository root:

```bash
local-otel/check-workshop-local.sh
```

Expected result:

```text
Local OTel setup is ready.
```

If not ready, start the local stack:

```bash
local-otel/start-full-stack.sh
```

For Azure demos, start hybrid mode:

```bash
local-otel/start-full-stack.sh --hybrid
```

The session materializer and daily rollup run automatically in the Docker `copilot-otel-jobs` container on macOS, Linux, and Windows, so no scheduler setup is required on any platform. On macOS, `local-otel/install-launchagents.sh` installs only optional host-side agents for GitHub Enterprise ingestion, audit stream renewal, VS Code memory sampling, and workspace registration.

## Accounts

### GitHub

Check authentication:

```bash
gh auth status -h github.com
```

Recommended scopes for enterprise demos:

```text
admin:enterprise
admin:org
manage_billing:copilot
repo
workflow
```

### Azure

Set the expected subscription:

```bash
az account set --subscription "your-subscription-name"
```

Validate resources:

```bash
az resource list -g rg-agentobs-dev-eus-001 -o table
```

## Safety Briefing

Before a workshop, state these rules:

- Content capture is disabled by default. Participants opt in per workshop by setting `FRONTIER_ENABLE_CONTENT_CAPTURE=true` only when the facilitator approves.
- When enabled, local content capture can include prompts, source code, tool arguments, and tool results.
- Raw content should stay local unless the customer explicitly approves sharing.
- Azure receives sanitized telemetry and rollups.
- Local AIU is an operational signal, not official billing.
- GitHub Copilot usage metrics and billing exports are separate official sources.
- Do not run the workshop on highly sensitive customer repositories without explicit approval.

## Instructor Checklist

- [ ] Local stack starts and all 10 containers, including `copilot-otel-jobs`, are running.
- [ ] Aspire opens at `http://localhost:18888`.
- [ ] Local Grafana opens at `http://localhost:3000` and the `admin` login works with the generated password from `local-otel/stack/grafana-admin.env`. Anonymous access is disabled.
- [ ] Azure Managed Grafana opens if hybrid demo is planned.
- [ ] `local-otel/audit-coverage.sh` runs.
- [ ] GitHub CLI is authenticated.
- [ ] Azure CLI is on the expected subscription.

## References

- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Operations Runbook](../docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
