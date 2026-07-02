---
title: "Participant Checklist"
description: "Completion checklist for developers participating in the Frontier Cockpit Local hands-on workshop."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "workshop", "checklist", "developer"]
---

<!-- markdownlint-disable MD025 -->

# Participant Checklist

Use this checklist to confirm each participant leaves the workshop with a working personal Frontier Cockpit Local mini app and understands the local data boundary.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local, repository-relative paths, containerized jobs, privacy-first defaults, per-lab durations. |
| 1.0.2 | 2026-07-02 | Frontier Cockpit Team | Added the cross-platform client bootstrap path for macOS, Linux, and Windows. |
| 1.0.1 | 2026-07-01 | Frontier Cockpit Team | Added mini app template, participant identity, and AI Credits checks. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial participant checklist. |

## Table of Contents

- [Participant Checklist](#participant-checklist)
  - [Change Log](#change-log)
  - [Table of Contents](#table-of-contents)
  - [1. Local Setup](#1-local-setup)
  - [2. Real Telemetry](#2-real-telemetry)
  - [3. Dashboard Understanding](#3-dashboard-understanding)
  - [4. Azure Understanding](#4-azure-understanding)
  - [5. GitHub Enterprise Understanding](#5-github-enterprise-understanding)
  - [6. Prompt Improvement](#6-prompt-improvement)
  - [7. Final Evidence](#7-final-evidence)
  - [References](#references)

## 1. Local Setup

- [ ] Docker Desktop is running.
- [ ] VS Code or VS Code Insiders is open.
- [ ] GitHub Copilot Chat works.
- [ ] Participant repository is open as a Git workspace in VS Code or VS Code Insiders.
- [ ] `local-otel/client.env.example` was copied to `local-otel/client.env`.
- [ ] `local-otel/client.env` contains participant name, customer name, role, plan, seat count, and AI Credits configuration.
- [ ] Bootstrap completed from the repository root with `bash local-otel/client-bootstrap.sh` on macOS or Linux, or `pwsh -ExecutionPolicy Bypass -File local-otel/client-bootstrap.ps1` on Windows. The bootstrap starts the Docker compose stack, and Docker `restart: unless-stopped` brings it back automatically.
- [ ] VS Code or VS Code Insiders was restarted after the bootstrap.
- [ ] `local-otel/check-workshop-local.sh` reports ready. The facilitator can also run `local-otel/workshop-ready.sh` as a convenience wrapper that refreshes and validates a participant machine.
- [ ] The `copilot-otel-jobs` container is running, so the session materializer and daily rollup run automatically on macOS, Linux, and Windows without any LaunchAgents or other host schedulers.
- [ ] Content capture is off unless the facilitator approved opting in with `FRONTIER_ENABLE_CONTENT_CAPTURE=true` in `local-otel/client.env`.
- [ ] Frontier Cockpit Local mini app opens at `http://localhost:3300`.
- [ ] Aspire opens at `http://localhost:18888`.
- [ ] Grafana opens at `http://localhost:3000` with the `admin` login and the generated password from `local-otel/stack/grafana-admin.env`.

## 2. Real Telemetry

- [ ] A real GitHub Copilot Chat or agent session was generated.
- [ ] A GitHub Copilot CLI or GitHub Copilot SDK workload was launched from a terminal that loaded the `OTEL_*` environment, when those tools are part of the workshop scope.
- [ ] A `copilot-chat` trace was found in Aspire.
- [ ] The trace includes `chat` spans.
- [ ] The trace includes tool spans when tools were used.
- [ ] Session metrics were materialized, either automatically by the `copilot-otel-jobs` container or manually with `local-otel/materialize-copilot-sessions.sh`.
- [ ] A real workspace session appears in the mini app and Grafana if repository attribution was emitted.

## 3. Dashboard Understanding

- [ ] Participant can explain Aspire vs Grafana.
- [ ] Participant can explain the mini app as the workshop template dashboard.
- [ ] Participant can switch the mini app between English, Portuguese, and Spanish.
- [ ] Participant opened the mini app Overview at `http://localhost:3300`.
- [ ] Participant opened the mini app Credits view.
- [ ] Participant opened the mini app Coach view.
- [ ] Participant opened Frontier Cockpit Local Home at `http://localhost:3000/d/copilot-agent-local/frontier-cockpit-local-home`.
- [ ] Participant opened GitHub Copilot Real Workspace Usage at `http://localhost:3000/d/copilot-real-workspace-usage-local/github-copilot-real-workspace-usage-local`.
- [ ] Participant opened GitHub Copilot Context and Cost at `http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local`.
- [ ] Participant opened GitHub Copilot Data Quality at `http://localhost:3000/d/copilot-data-quality-local/github-copilot-data-quality-local`.
- [ ] Participant opened GitHub Copilot Developer Coach at `http://localhost:3000/d/copilot-developer-coach-local/github-copilot-developer-coach-local`.
- [ ] Participant can explain input tokens and output tokens.
- [ ] Participant can explain hot/warm/cold context.
- [ ] Participant can explain AIU as an operational signal.
- [ ] Participant can explain AI Credits as the current usage-based billing unit and why local estimates are not official billing.
- [ ] Participant can explain that model choice, input tokens, output tokens, cached tokens, and context size affect AI Credits.
- [ ] Participant can explain why model names are telemetry labels.
- [ ] Participant can explain `workspace_real` vs `non_workspace_real`.
- [ ] Participant can explain that hourly jobs keep support metrics current, but cannot synthesize rare events that have not happened.
- [ ] Participant can identify one prompt improvement from telemetry.

## 4. Azure Understanding

- [ ] Participant understands that Azure sync is optional for the participant path.
- [ ] Participant understands that Azure receives sanitized telemetry only when a governed sync path is enabled.
- [ ] Participant can open the Azure Managed Grafana dashboard if access is available.
- [ ] Participant understands that raw prompts and tool outputs stay local by default.
- [ ] Participant understands that official billing requires GitHub billing or usage exports.

## 5. GitHub Enterprise Understanding

- [ ] Participant can explain enterprise audit log vs GitHub Copilot metrics API.
- [ ] Participant understands that `404` for GitHub Copilot metrics is a real status.
- [ ] Participant understands that some policies must be enabled in GitHub UI.
- [ ] Participant understands that audit log streaming can be configured through GitHub API.

## 6. Prompt Improvement

Participant rewrote a broad prompt into this shape:

```text
Objective:
Scope:
Relevant files:
Non-goals:
Validation:
Stop condition:
Telemetry question:
```

The improved prompt should reduce ambiguity and make telemetry easier to interpret.

## 7. Final Evidence

Collect screenshots or notes for:

- [ ] Mini app Overview.
- [ ] Mini app Credits view.
- [ ] Mini app Coach view.
- [ ] Aspire trace detail.
- [ ] Local Context and Cost dashboard.
- [ ] Local Data Quality dashboard.
- [ ] Local Developer Coach dashboard.
- [ ] Azure dashboard, optional.
- [ ] One before/after prompt example.

## References

- [Workshop README](README.md)
- [Lab 01, Local Developer Cockpit](Lab_01_LocalDeveloperCockpit_v1_0_0_2026-06-18_en.md)
- [Lab 02, Real Telemetry And Session Insights](Lab_02_RealTelemetryAndSessionInsights_v1_0_0_2026-06-18_en.md)
- [Lab 03, Context Cost And Prompt Optimization](Lab_03_ContextCostAndPromptOptimization_v1_0_0_2026-06-18_en.md)
- [Lab 04, Azure Enterprise Sync](Lab_04_AzureEnterpriseSync_v1_0_0_2026-06-18_en.md)
- [Lab 05, GitHub Enterprise Signals](Lab_05_GitHubEnterpriseSignals_v1_0_0_2026-06-18_en.md)
