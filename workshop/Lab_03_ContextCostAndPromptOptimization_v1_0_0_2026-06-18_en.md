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
- Track AI Credits consumption and use budget controls well.

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

## Step 6, Use AI Credits Well

GitHub Copilot usage-based billing for organizations and enterprises is measured in GitHub AI Credits. The local cockpit helps you understand which prompt, context, cache, model, and token patterns consume more credits.

### How AI Credits are consumed

- AI Credits are based on the model used and the tokens consumed.
- Token classes include input tokens, output tokens, and cached tokens.
- Agentic features can consume more AI Credits because they may perform multiple model calls and process more context inside one task.
- Code completions and next edit suggestions are not billed in AI Credits for paid plans.
- Business and Enterprise AI Credits are pooled at the billing entity level, so heavy usage by one user can draw from the shared pool.

### Read your budget in the mini app

If you completed Lab 06, open the local mini app and read the Credits view:

```text
http://localhost:3300
```

The budget panel shows local AI Credits observed this cycle against the configured credit pool, and the model cost mix panel estimates which model labels are consuming the most AI Credits. The estimate is local operational telemetry and is not official billing.

### Practices that reduce AI Credits consumption

| Practice | Why it helps |
| --- | --- |
| Choose the right model | Use the lowest-cost model that can complete the task, and reserve more expensive models for work that needs stronger reasoning. |
| Set budgets and spending limits | Use GitHub budget controls to monitor or stop additional AI Credits usage when limits are reached. |
| Scope prompts tightly | Smaller prompts and fewer irrelevant files reduce input tokens and model work. |
| Reuse warm context | Cache reuse reduces unnecessary processing compared with repeatedly sending cold context. |
| Avoid retrying large prompts | Fix the root cause first, then retry with a smaller prompt to avoid repeating expensive token use. |
| Monitor usage regularly | Check the mini app for local patterns and use GitHub billing exports, the usage dashboard, or the Copilot usage metrics API for official totals. |

Official AI Credits totals, model prices, and budget behavior are defined by GitHub and can change. Confirm current values in the GitHub Copilot billing documentation.

## Completion Criteria

- [ ] Participant can explain hot/warm/cold context.
- [ ] Participant can find AIU in the dashboard.
- [ ] Participant can identify at least one waste pattern.
- [ ] Participant can rewrite a broad prompt into a scoped prompt.
- [ ] Participant can explain why local AIU is not official billing.
- [ ] Participant can explain how model choice, input tokens, output tokens, cached tokens, and context size affect AI Credits.

## References

- [GitHub Copilot prompt engineering](https://docs.github.com/en/copilot/using-github-copilot/prompt-engineering-for-github-copilot)
- [GitHub Copilot usage-based billing for organizations and enterprises](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-organizations-and-enterprises)
- [GitHub Copilot budget controls](https://docs.github.com/en/copilot/tutorials/budgets/getting-started-with-budget-controls)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Lab 06, Frontier Developer Cockpit Mini App](Lab_06_FrontierDeveloperCockpitMiniApp_v1_0_0_2026-06-30_en.md)
