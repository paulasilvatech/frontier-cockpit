---
title: "Frontier Developer Cockpit Workshop Guide"
description: "Workshop guide for teaching developers and platform teams how to use Frontier Developer Cockpit and Frontier FinOps Cockpit for GitHub Copilot agent work."
author: "Frontier Cockpit Team"
date: "2026-06-17"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "workshop", "developer-enablement", "opentelemetry", "aspire", "grafana"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Developer Cockpit Workshop Guide

This guide helps facilitators teach developers and platform teams how to observe, understand, and improve GitHub Copilot Chat and agent work using the Frontier Developer Cockpit and Frontier FinOps Cockpit.

For participant-facing lab navigation, use [../workshop/README.md](../workshop/README.md). This document is the facilitator guide for agenda, talking points, and demo framing.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial workshop guide. |

## Table of Contents

- [1. Workshop Goals](#1-workshop-goals)
- [2. Audience](#2-audience)
- [3. Prerequisites](#3-prerequisites)
- [4. Agenda](#4-agenda)
- [5. Lab 1, Local Live Trace](#5-lab-1-local-live-trace)
- [6. Lab 2, Context And AIU](#6-lab-2-context-and-aiu)
- [7. Lab 3, Prompt Improvement](#7-lab-3-prompt-improvement)
- [8. Lab 4, Azure Enterprise View](#8-lab-4-azure-enterprise-view)
- [9. Discussion Prompts](#9-discussion-prompts)
- [10. Facilitator Checklist](#10-facilitator-checklist)
- [References](#references)

## 1. Workshop Goals

By the end of the workshop, participants should be able to:

- explain how GitHub Copilot emits OpenTelemetry signals;
- use Aspire to inspect live GenAI traces;
- use Grafana to understand context, AIU, cache behavior, tool calls, and workspace attribution;
- distinguish local operational telemetry from official billing and adoption metrics;
- improve prompts and agent workflow based on real telemetry;
- understand the Azure enterprise consolidation pattern.

## 2. Audience

| Audience | Outcome |
| --- | --- |
| Developers | Improve daily GitHub Copilot usage and prompt quality |
| Tech leads | Coach teams and identify high-friction workflows |
| Platform engineers | Understand deployment, governance, and dashboard operations |
| FinOps | Understand where local AIU signals end and official billing begins |
| Security | Understand content capture and Azure redaction boundaries |

## 3. Prerequisites

- VS Code Insiders with GitHub Copilot enabled.
- Docker Desktop running.
- Local stack ready under `~/.copilot-otel`.
- Azure deployment available for enterprise demo.
- A Git repository open in VS Code.
- Consent to use content capture in the local demo environment.

## 4. Agenda

| Time | Topic |
| --- | --- |
| 00:00-00:10 | Architecture and data boundaries |
| 00:10-00:25 | Aspire live GenAI trace walkthrough |
| 00:25-00:45 | Grafana local dashboards and developer coaching |
| 00:45-01:05 | Context, hot/warm/cold, AIU, and model labels |
| 01:05-01:20 | Prompt improvement exercise |
| 01:20-01:35 | Frontier FinOps Cockpit |
| 01:35-01:45 | GitHub API enrichment roadmap |
| 01:45-02:00 | Questions, teardown, and next steps |

## 5. Lab 1, Local Live Trace

### 5.1 Start And Validate

```bash
~/.copilot-otel/check-otel-local.sh
```

### 5.2 Generate A Real Session

Ask GitHub Copilot Chat to perform a scoped, low-risk task in the open repository. Avoid editing audited or sensitive files during a customer demo.

### 5.3 Inspect Aspire

1. Open `http://localhost:18888`.
2. Go to **Traces**.
3. Filter for `copilot-chat`.
4. Open `invoke_agent GitHub Copilot Chat`.
5. Inspect `chat`, `execute_tool`, and `execute_hook` spans.
6. Open the GenAI visualizer for content capture.

## 6. Lab 2, Context And AIU

Open:

```text
http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local
```

Discuss:

- Peak context utilization.
- Hot/warm/cold token split.
- Runtime-reported AIU from `copilot_chat.copilot_usage_nano_aiu`.
- Model labels emitted by telemetry.
- Difference between telemetry labels and billing model names.

## 7. Lab 3, Prompt Improvement

### 7.1 Baseline Prompt

Ask a broad prompt and observe token and tool behavior.

### 7.2 Improved Prompt

Use this pattern:

```text
Objective:
Scope:
Relevant files:
Non-goals:
Validation:
Stop condition:
Telemetry question:
```

### 7.3 Compare

Compare:

- input tokens;
- tool calls;
- context utilization;
- AIU;
- errors;
- quality of final answer.

## 8. Lab 4, Azure Enterprise View

Open Azure Managed Grafana:

```text
https://your-grafana-workspace.grafana.azure.com/d/agentobs-azure-copilot-overview/github-copilot-agent-observability-azure
```

Explain:

- local telemetry is richer;
- Azure telemetry is sanitized and durable;
- Azure shows history, governance, and enterprise rollups;
- GitHub APIs will provide adoption and official billing dimensions.

## 9. Discussion Prompts

- Which prompts produced high cold context?
- Which workflows caused repeated tool calls?
- Which sessions reported high AIU?
- Which model labels appeared, and are they expected?
- Which data is real but not workspace-attributed?
- What should remain local for privacy?
- Which GitHub API data is needed for enterprise adoption and billing views?

## 10. Facilitator Checklist

- [ ] Docker Desktop is running.
- [ ] Local stack is healthy.
- [ ] Aspire opens.
- [ ] Local Grafana opens.
- [ ] A Git repository is open in VS Code.
- [ ] Workspace attribution is visible.
- [ ] Azure Managed Grafana opens.
- [ ] Dashboard data quality is explained before showing metrics.
- [ ] Raw content capture warning is stated.
- [ ] Teardown command is available if needed.

## References

- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
