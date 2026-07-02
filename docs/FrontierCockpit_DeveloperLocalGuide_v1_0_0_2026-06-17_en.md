---
title: "Frontier Cockpit Local Developer Guide"
description: "Developer guide for running and using Frontier Cockpit Local with Aspire, Grafana, Prometheus, Tempo, Loki, and local automation."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "developer", "local", "aspire", "grafana", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Local Developer Guide

This guide explains how a developer uses the Frontier Cockpit Local observability stack to improve prompts, reduce waste, pick better model strategies, understand context-window use, and diagnose agent behavior.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial developer guide for local observability. |

## Table of Contents

- [1. What The Local Cockpit Is For](#1-what-the-local-cockpit-is-for)
- [2. What Runs Locally](#2-what-runs-locally)
- [3. Daily Developer Workflow](#3-daily-developer-workflow)
- [4. Dashboard Guide](#4-dashboard-guide)
- [5. Prompt Improvement Loop](#5-prompt-improvement-loop)
- [6. Interpreting Key Metrics](#6-interpreting-key-metrics)
- [7. Content Capture](#7-content-capture)
- [8. Workspace Attribution](#8-workspace-attribution)
- [9. Troubleshooting](#9-troubleshooting)
- [10. Developer Checklist](#10-developer-checklist)
- [References](#references)

## 1. What The Local Cockpit Is For

Frontier Cockpit Local is for developer learning and day-to-day optimization. It answers questions that help a developer use GitHub Copilot more deliberately:

- Did this session use too much context?
- Did it use the expected model label?
- Did the runtime report AIU usage?
- How much context was hot, warm, or cold?
- Did the agent call too many tools?
- Did the tool loop indicate a weak prompt?
- Was the session attached to the expected repository and branch?
- Did content capture include large prompts, outputs, or tool schemas?

Frontier Cockpit Local is not the official billing system. Official billing and AI Credits reconciliation require GitHub billing exports or GitHub usage metrics.

## 2. What Runs Locally

Prometheus and Grafana are mandatory for the complete Frontier Cockpit Local experience. Aspire is the live trace and GenAI visualization surface. Prometheus and Grafana provide the metrics and dashboard UX required for day-to-day developer insight.

| Component | Endpoint | Developer Use |
| --- | --- | --- |
| Aspire Dashboard | `http://localhost:18888` | Live trace tree and GenAI visualizer |
| Grafana OSS | `http://localhost:3000` | Historical local dashboards |
| Prometheus | `http://localhost:9090` | Local metrics store |
| Tempo | `http://localhost:3200` | Local trace store |
| Loki | `http://localhost:3100` | Local logs and content-capture records |
| OpenTelemetry Collector | `localhost:4318`, `localhost:4317` | Local telemetry ingress and fan-out |
| Grafana embedded SQLite | Docker volume | Grafana metadata |
| DuckDB or SQLite | Local file | Optional Python-first derived insight store |

All stack ports bind to `127.0.0.1` only. Grafana requires a login: user `admin` with the generated password stored in `local-otel/stack/grafana-admin.env`.

For the Python-first local architecture, see [FrontierCockpit_PythonAspireLocalArchitecture_v1_0_0_2026-06-18_en.md](FrontierCockpit_PythonAspireLocalArchitecture_v1_0_0_2026-06-18_en.md).

## 3. Daily Developer Workflow

1. Open the target Git repository in VS Code Insiders.
2. Confirm the local stack is ready, running from the root of the cloned repository:

   ```bash
   local-otel/check-workshop-local.sh
   ```

3. Register the workspace if needed:

   ```bash
   local-otel/register-workspace.sh
   ```

4. Work normally with GitHub Copilot Chat, agent mode, plan mode, or GitHub Copilot CLI.
5. Inspect the live trace in Aspire if something feels slow, expensive, or confusing.
6. Inspect the local Grafana dashboards at the end of the session.
7. Improve the next prompt based on the observed token, tool, context, and AIU behavior.

## 4. Dashboard Guide

| Dashboard | Use It To Answer |
| --- | --- |
| GitHub Copilot Real Workspace Usage (Local) | Which real workspace sessions happened for repo and branch? |
| GitHub Copilot Context and Cost (Local) | How full was the context window? How much AIU was reported? |
| GitHub Copilot Sessions and Model Labels (Local) | Which emitted model labels and sessions were used? |
| GitHub Copilot Data Quality (Local) | Which data is real, auxiliary, synthetic, or not workspace-attributed? |
| GitHub Copilot OTel Coverage (Local) | Which OTel signals have been observed locally? |
| GitHub Copilot Developer Coach (Local) | How should the prompt and workflow improve? |
| VS Code Process Memory (Local) | How much host memory is VS Code using? |

## 5. Prompt Improvement Loop

A developer should use telemetry to improve prompts, not only to inspect numbers.

### 5.1 Prompt Template

```text
Objective:
Scope:
Relevant files or folders:
Non-goals:
Constraints:
Validation:
Stop condition:
Telemetry question:
```

### 5.2 Example

```text
Objective: fix the failing validation for the Azure Collector dashboard.
Scope: only files under local-otel/stack and local-otel/azure.
Non-goals: do not change unrelated repository files.
Validation: run check-workshop-local.sh and query AppTraces/AppMetrics.
Stop condition: if the same error repeats twice, stop and summarize the blocker.
Telemetry question: report whether tool calls, input tokens, AIU, or context utilization looked high.
```

## 6. Interpreting Key Metrics

### 6.1 Context Window

| Metric | Meaning |
| --- | --- |
| `copilot_chat.request.max_prompt_tokens` | Available prompt window reported by the runtime |
| `gen_ai.usage.input_tokens` | Input tokens for the call or session |
| Peak context utilization | Largest turn input divided by `max_prompt_tokens` |

High context utilization means the session may need compaction, stronger scoping, or a split into smaller tasks.

### 6.2 Hot, Warm, And Cold Context

| State | Signal | Interpretation |
| --- | --- | --- |
| Warm or hot | `gen_ai.usage.cache_read.input_tokens` | Tokens read from cache |
| Warming | `gen_ai.usage.cache_creation.input_tokens` | Tokens written into cache |
| Cold | Input tokens minus cache-read minus cache-creation tokens | Tokens processed without cache reuse |

The goal is not always to maximize cache. The goal is to avoid repeatedly sending large cold context when stable instructions or reusable context could be cached.

### 6.3 AIU

| Signal | Meaning |
| --- | --- |
| `copilot_chat.copilot_usage_nano_aiu` | Runtime-reported AIU in nano units |
| AIU | `nano_aiu / 1e9` |

AIU in local telemetry is useful for planning and education. Official billing still requires GitHub billing or usage exports.

### 6.4 Tool Calls

High tool calls can mean:

- healthy agent exploration;
- unclear scope;
- repeated file reads;
- failing commands;
- tool loops caused by vague instructions.

Use Aspire traces to inspect the actual tool sequence.

## 7. Content Capture

Content capture is disabled by default (`FRONTIER_ENABLE_CONTENT_CAPTURE=false`) to keep the setup privacy first. Opt in only for trusted local debugging. When enabled, it can include prompts, responses, tool schemas, tool arguments, and tool results.

Safe inspection:

```bash
local-otel/show-trace-content.sh
```

Raw inspection, local trusted environment only:

```bash
local-otel/show-trace-content.sh --show-content
```

Do not use raw content capture in customer or shared environments unless explicitly approved.

## 8. Workspace Attribution

A session is considered **workspace real** when GitHub Copilot emits repository attributes such as:

- `github.copilot.git.repository`
- `github.copilot.git.branch`
- `github.copilot.git.commit_sha`

Telemetry without these values can still be real, but it should not be assigned to a workspace.

## 9. Troubleshooting

| Symptom | Check | Fix |
| --- | --- | --- |
| No local data | `local-otel/check-workshop-local.sh` | Restart full stack |
| Aspire login prompt | Docker logs for Aspire token | Use login URL or anonymous mode |
| Grafana has no workspace | `register-workspace.sh` | Reopen workspace and register |
| Azure is missing raw content | Expected behavior | Raw content is redacted before Azure |
| Model name looks strange | Treat as telemetry label | Do not map to billing model without official source |
| No Ask/Plan/Agent label | Check Tempo span attributes | Use inferred `mode_bucket`, not official UI mode |

## 10. Developer Checklist

- [ ] Open the correct Git repository.
- [ ] Confirm local stack is ready.
- [ ] Run work normally with GitHub Copilot.
- [ ] Review Aspire trace if behavior is confusing.
- [ ] Review context and AIU dashboard after heavy sessions.
- [ ] Check data quality before presenting any metric.
- [ ] Improve prompt scope and stop conditions.
- [ ] Do not interpret local AIU as official billing.

## References

- [VS Code GitHub Copilot documentation](https://code.visualstudio.com/docs/copilot/overview)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [Inside the LLM Call: GenAI Observability with OpenTelemetry](https://opentelemetry.io/blog/2026/genai-observability/)
