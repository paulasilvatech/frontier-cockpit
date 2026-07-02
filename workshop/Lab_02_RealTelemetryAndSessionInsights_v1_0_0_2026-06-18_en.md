---
title: "Lab 02, Real Telemetry And Session Insights"
description: "Hands-on lab for generating real GitHub Copilot telemetry, inspecting Aspire traces, and materializing session insights."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "workshop", "telemetry", "session-insights", "opentelemetry"]
---

<!-- markdownlint-disable MD025 -->

# Lab 02, Real Telemetry And Session Insights

This lab generates real GitHub Copilot telemetry and turns it into local session insights.

Estimated duration: 30 minutes.

## Goals

- Generate a real GitHub Copilot Chat or agent session.
- Inspect the trace in Aspire.
- Materialize session metrics.
- Distinguish real workspace sessions from non-workspace telemetry.

## Step 1, Generate A Real Session

In VS Code Insiders, open a Git repository and ask GitHub Copilot to perform a safe, scoped task.

Example:

```text
Explain the architecture of this repository. Use only README files and docs under docs/. Do not edit files. After answering, summarize which files you inspected.
```

For an edit task, use a low-risk file or a throwaway branch.

## Step 2, Inspect In Aspire

Open:

```text
http://localhost:18888
```

Go to **Traces** and filter for:

```text
copilot-chat
```

Open a trace such as:

```text
invoke_agent GitHub Copilot Chat
```

Inspect these spans:

| Span | What To Inspect |
| --- | --- |
| `invoke_agent` | overall agent orchestration |
| `chat` | model label, tokens, finish reason, AIU, prompt window |
| `execute_tool` | tool name, arguments, output metadata |
| `execute_hook` | hook decision and hook duration |

## Step 3, Materialize Sessions

The session materializer runs automatically in the Docker `copilot-otel-jobs` container on macOS, Linux, and Windows. To refresh immediately instead of waiting for the next scheduled run, run from the cloned repository root:

```bash
local-otel/materialize-copilot-sessions.sh
```

The materializer reads real traces from Tempo and emits metrics such as:

| Metric Family | Purpose |
| --- | --- |
| `copilot_real_session_input_tokens` | Session input tokens |
| `copilot_real_session_output_tokens` | Session output tokens |
| `copilot_real_session_cache_read_tokens` | Warm or hot context |
| `copilot_real_session_cache_creation_tokens` | Warming context |
| `copilot_real_session_nano_aiu` | AIU reported by runtime |
| `copilot_real_session_tool_calls` | Tool calls |
| `copilot_real_session_context_utilization_pct` | Context window utilization |

## Step 4, Open Session Dashboards

Open:

```text
http://localhost:3000/d/copilot-real-workspace-usage-local/github-copilot-real-workspace-usage-local
http://localhost:3000/d/copilot-sessions-models-local/github-copilot-sessions-and-model-labels-local
```

Discuss:

- Which sessions are `workspace_real`?
- Which sessions are real but not attributable to a workspace?
- Which model labels appeared?
- Which session consumed the most input tokens?
- Which session used the most tools?

## Step 5, Session Insights And Sync Context

VS Code session features can provide local history and sync capabilities when configured. This stack complements them:

| Capability | Role |
| --- | --- |
| VS Code session insights | Developer-facing local session history and insights |
| VS Code session sync | Cross-device GitHub-backed session sync when enabled |
| OTel local stack | Trace, metrics, tools, tokens, AIU, context, and content capture |
| Azure consolidator | Enterprise-safe history and rollups |

Do not confuse VS Code session sync with Frontier Cockpit Hybrid. They solve different problems.

## Completion Criteria

- [ ] Participant generated a real session.
- [ ] Participant found the trace in Aspire.
- [ ] Participant materialized the session.
- [ ] Participant can explain `workspace_real` vs `non_workspace_real`.
- [ ] Participant can find model labels and token counts.

## References

- [VS Code Session Insights](https://code.visualstudio.com/docs/agents/sessions/session-insights)
- [VS Code Session Sync](https://code.visualstudio.com/docs/agents/sessions/session-sync)
- [Monitoring agents with OpenTelemetry](https://code.visualstudio.com/docs/agents/guides/monitoring-agents)
- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
