---
title: "Lab 03, Context Cost And Prompt Optimization"
description: "Hands-on lab for using real context, cache, AIU, tool, and prompt signals to improve GitHub Copilot agent work."
author: "Frontier Cockpit Team"
date: "2026-06-18"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "workshop", "context", "aiu", "prompt-engineering"]
---

<!-- markdownlint-disable MD025 -->

# Lab 03, Context Cost And Prompt Optimization

This lab uses real telemetry to improve prompt shape, context discipline, model routing, and tool behavior.

## Goals

- Read real context-window utilization.
- Interpret hot, warm, and cold context.
- Understand AIU as an operational signal.
- Detect prompt patterns that create waste.
- Produce a better prompt and compare telemetry.
- Track the premium requests included with your plan and use included AI credits well.

## Step 1, Open Context Dashboard

Open:

```text
http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local
```

Review:

| Panel | Meaning |
| --- | --- |
| Peak context window utilization | How full the context window became |
| Context temperature | cache-read, cache-creation, and cold tokens |
| Real cost, AI Units | Runtime-reported AIU from `copilot_chat.copilot_usage_nano_aiu` |
| Per-session table | Trace-level context and cost data |

## Step 2, Interpret Hot, Warm, And Cold

| State | Signal | What It Means |
| --- | --- | --- |
| Warm or hot | `cache_read_tokens` | Stable context was reused from cache |
| Warming | `cache_creation_tokens` | New prompt prefix or context was cached |
| Cold | `cold_input_tokens` | Context was processed without cache reuse |

A high cold-token session is not always wrong, but it should trigger a question: did the prompt send too much new context?

## Step 3, Compare Two Prompts

### Broad Prompt

```text
Analyze this project and improve the architecture documentation.
```

### Scoped Prompt

```text
Objective: improve the architecture documentation for the OTel stack.
Scope: only docs under frontier-cockpit/.
Non-goals: do not edit source code or generated diagrams.
Validation: confirm frontmatter, one H1, References, and local links.
Stop condition: if you need more than five files, summarize what is missing first.
Telemetry question: report whether input tokens, tool calls, or context utilization looked high.
```

Run both prompts in separate sessions when safe, then compare telemetry.

## Step 4, Detect Tool Loops

Open:

```text
http://localhost:3000/d/copilot-developer-coach-local/github-copilot-developer-coach-local
```

Look for:

- repeated file reads;
- repeated terminal commands;
- high tool call count with low useful output;
- errors followed by repeated retries;
- unclear stop conditions.

## Step 5, Improve Model Strategy

The dashboard shows emitted telemetry model labels, not official billing model names. Use them as operational signals.

Recommended routing:

| Work Type | Strategy |
| --- | --- |
| Simple summary | Short prompt, minimal context, fast/default model |
| Focused code edit | Target files, validation command, normal coding model |
| Architecture/security/migration | More context, explicit discovery, stronger reasoning model |
| Repeatable workflow | Skill, prompt file, or MCP-backed automation |

## Step 6, Use Your Included AI Credits Well

Paid GitHub Copilot plans include a monthly allowance of premium requests. Business and Enterprise plans each include a pool that resets on the first day of the month. This step is about spending that allowance well.

### How premium requests are counted

- Each user-initiated request is one premium request, multiplied by the model multiplier for the model you chose.
- Agent mode can make several internal model calls and tool calls for one prompt, but those do not add extra premium requests. The premium request is counted per user prompt, not per internal call.
- Included base models bill at a zero multiplier, so routine work on them does not consume premium requests.
- The monthly allowance resets on the first of each month.

### Read your budget in the mini app

If you completed Lab 06, open the local mini app and read the Credits view:

```text
http://localhost:3300
```

The budget panel estimates premium requests used this cycle against the allowance included with your plan, and the model mix panel shows how much of that allowance goes to premium models versus included models. The estimate is local and is not official billing.

### Practices that stretch included credits

| Practice | Why it helps |
| --- | --- |
| Choose the right model | Reserve high-multiplier premium models for complex reasoning, and use an included base model for routine edits and explanations. |
| Set a budget with alerts | Watch the 75 percent and 90 percent marks so there are no surprises before the cycle resets. |
| Batch related prompts | One prompt is one premium request times the multiplier, so grouping related work into one session is efficient. |
| Reuse warm context | Cache reads are cheaper than cold input and make each premium request go further. |
| Avoid retrying large prompts | Each resend of a large prompt is another premium request. Fix the root cause, then retry once. |
| Monitor usage regularly | Check the mini app, and for official totals use GitHub billing exports or the Copilot usage metrics API. |

Official premium-request totals, AI Credits, and model multipliers are defined by GitHub and can change. Confirm current values in the GitHub Copilot billing documentation.

## Completion Criteria

- [ ] Participant can explain hot/warm/cold context.
- [ ] Participant can find AIU in the dashboard.
- [ ] Participant can identify at least one waste pattern.
- [ ] Participant can rewrite a broad prompt into a scoped prompt.
- [ ] Participant can explain why local AIU is not official billing.
- [ ] Participant can explain how premium requests are counted and how to preserve included allowance.

## References

- [GitHub Copilot prompt engineering](https://docs.github.com/en/copilot/using-github-copilot/prompt-engineering-for-github-copilot)
- [GitHub Copilot request-based billing and model multipliers](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Lab 06, Frontier Developer Cockpit Mini App](Lab_06_FrontierDeveloperCockpitMiniApp_v1_0_0_2026-06-30_en.md)
