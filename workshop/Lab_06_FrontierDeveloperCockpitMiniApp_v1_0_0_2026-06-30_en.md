---
title: "Lab 06 Frontier Developer Cockpit Mini App"
description: "Hands-on lab where each participant runs the local Frontier Developer Cockpit mini app from the template, sets their own identity, and reads token efficiency and AI credit signals."
author: "Frontier Cockpit Team"
date: "2026-06-30"
version: "1.0.0"
status: "approved"
tags: ["github-copilot", "workshop", "cockpit", "tokens", "ai-credits", "local"]
---

<!-- markdownlint-disable MD025 -->

# Lab 06 Frontier Developer Cockpit Mini App

In this lab each participant runs the local Frontier Developer Cockpit mini app from the template, sets their own name and role, generates real GitHub Copilot telemetry, and uses the dashboard to understand token usage, cache behavior, AI credits, and token efficiency.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-30 | Frontier Cockpit Team | Initial mini app lab with per-participant identity, token efficiency, the Credits view with premium-request budget and included model routing, and a trilingual UI. |

## Table of Contents

- [1. Goal](#1-goal)
- [2. Prerequisites](#2-prerequisites)
- [3. Set Your Identity](#3-set-your-identity)
- [4. Start The Cockpit](#4-start-the-cockpit)
- [5. Generate Real Telemetry](#5-generate-real-telemetry)
- [6. Explore The Views](#6-explore-the-views)
- [7. Read The Token Efficiency Coach](#7-read-the-token-efficiency-coach)
- [8. Read The Credits And Budget View](#8-read-the-credits-and-budget-view)
- [9. Optional Customization](#9-optional-customization)
- [10. How This Connects To A Customer Backend](#10-how-this-connects-to-a-customer-backend)
- [11. Checklist](#11-checklist)
- [References](#references)

## 1. Goal

By the end of this lab you will have your own local cockpit at `http://localhost:3300` that shows your name and role, your real workspace sessions, your token and cache usage, your local AI credits, your included premium-request budget, and coaching for token efficiency and economy.

The user interface is available in English, Portuguese, and Spanish. Use the language switch in the sidebar to change it. English is the default.

This dashboard is a template. It is a starting point that a customer can later customize and integrate with a central backend. The local values are operational telemetry, not official GitHub billing.

## 2. Prerequisites

- Docker Desktop installed and running.
- VS Code Insiders with GitHub Copilot.
- The repository cloned locally.
- A Git repository open as your VS Code workspace, so usage is attributed to a project.

## 3. Set Your Identity

The cockpit is per participant. Copy the template environment file and set your own name and role.

```bash
cp local-otel/workshop.env.example local-otel/workshop.env
```

Edit `local-otel/workshop.env` and set at least your name and role:

```bash
FRONTIER_PARTICIPANT_NAME="Ana Souza"
FRONTIER_PARTICIPANT_ROLE="Senior Developer"
```

The `workshop.env` file is local only and is ignored by Git, so your identity stays on your machine. If you skip this step, the cockpit uses your Git `user.name`, and finally a generic default.

## 4. Start The Cockpit

Run the one command setup from the repository root. It is local only and never forwards data to Azure.

```bash
local-otel/workshop-ready.sh
```

This enables the local OpenTelemetry environment, starts the full Docker Desktop stack, resolves your identity, registers your Git workspace, materializes recent sessions, and runs the workshop validation gate.

Open the cockpit:

```bash
open http://localhost:3300
```

Confirm your name and role appear in the sidebar and in the top bar.

## 5. Generate Real Telemetry

If the Overview shows the Workshop first run panel, you have no attributed sessions yet.

1. Open a Git repository in VS Code Insiders.
2. Ask GitHub Copilot Chat to explain, edit, or test a small file.
3. Refresh the local telemetry:

```bash
local-otel/workshop-ready.sh
```

Then click Refresh in the mini app. Your session now appears.

## 6. Explore The Views

Use the left navigation to open each view:

| View | What it shows |
| --- | --- |
| Overview | Alerts, AI credits, input, output, cached and cold tokens, cache efficiency, context peak, token composition, a premium-request budget summary, history, top workspaces, stack health. |
| Credits | Premium-request budget for your plan, included versus premium model mix, developer experience latency, outcome signals, and a best-practice playbook for the AI credits included with your license. |
| Sessions | Each session by trace, with model, mode, credits, tokens, cache efficiency, tool calls, and a copyable trace id for Aspire or Tempo. |
| Workspaces | Every observed Git workspace, so you can compare projects. |
| Coach | Token efficiency score, savings opportunities, dynamic recommendations, and the token efficiency playbook. |
| History | Usage over time for AI credits and token classes. |
| Health | Stack health, data quality, official billing boundary, and drill down links. |
| Settings | Alert thresholds and how to change them. |

## 7. Read The Token Efficiency Coach

Open the Coach view and review:

- The efficiency score from 0 to 100. It rewards cache reuse and penalizes cold context, context pressure, and tool errors.
- The savings opportunities, which quantify local AI credit estimates for reducing cold context and avoiding tool error loops.
- The dynamic recommendations, which react to your real usage.
- The token efficiency playbook, which lists durable best practices.

Try to improve one signal:

1. Note your current cache efficiency and cold ratio.
2. Run a focused GitHub Copilot session that stays on one task in one file.
3. Refresh and materialize again.
4. Compare cache efficiency and the efficiency score.

## 8. Read The Credits And Budget View

Open the Credits view. It focuses on the premium requests and AI credits that are included with your GitHub Copilot plan, and how to get the most from them.

### 8.1 Premium-request budget

The budget panel estimates how many premium requests you have used this billing cycle against the monthly allowance included with your plan.

- One user prompt equals one premium request, multiplied by the model multiplier. Agent tool calls and internal model calls do not add extra premium requests.
- The allowance resets on the first day of each month.
- Included base models bill at a zero multiplier, so routine work on them does not consume your allowance.
- The estimate is local. It scales your user prompts by the call-weighted average model multiplier for the cycle. Official premium-request totals require GitHub billing exports or the Copilot usage metrics API.

Read the utilization percentage and the projected month end. The warning and critical marks on the bar default to 75 percent and 90 percent, which follow the budget alert points recommended by GitHub. If you are pacing above these marks, the Coach view suggests how to slow the burn.

Set your plan and allowance so the budget matches your license. Add these to `local-otel/workshop.env`, then run `local-otel/workshop-ready.sh` again:

```bash
FRONTIER_COPILOT_PLAN="business"
FRONTIER_PREMIUM_REQUEST_ALLOWANCE="300"
```

The defaults follow the documented monthly premium-request allowances for paid plans, for example Business at 300 and Enterprise at 1000. Confirm the current values for your plan in the GitHub Copilot billing documentation, because they can change.

### 8.2 Included versus premium models

The model mix panel splits your model calls into included models, which bill at a zero multiplier, and premium models, which consume allowance. Use it to see where your premium allowance goes.

To get more from the credits included in your license:

- Prefer an included base model for routine edits, explanations, and boilerplate.
- Reserve premium models for complex reasoning and large refactors.
- Batch related prompts into one session so you spend fewer premium requests.
- Reuse warm context, because cache reads stretch each premium request further.
- Avoid resending large prompts, because each resend is another premium request.

### 8.3 Developer experience and outcomes

The Credits view also shows developer-experience latency, such as average time to first token, and outcome signals, such as accepted edits and edits that were kept without a revert. These help you judge whether the model choice is delivering value for the credits it uses. Outcome signals are editor-level and are not attributed to a single workspace.

## 9. Optional Customization

This is a template, so you can customize it:

- Identity: set team and customer in `workshop.env` with `FRONTIER_PARTICIPANT_TEAM` and `FRONTIER_CUSTOMER_NAME`.
- Title: override `FRONTIER_DASHBOARD_TITLE`.
- Thresholds: set `THRESHOLD_*` variables to change when alerts fire. See the Settings view.

After changing `workshop.env`, run `local-otel/workshop-ready.sh` again to apply.

## 10. How This Connects To A Customer Backend

The local cockpit is phase one. It is full fidelity for the developer and stays on the machine. Phase two is optional and governed: a customer can synchronize sanitized rollups and metrics to a central backend, for example Azure Monitor, Azure Managed Grafana, or an existing observability stack. Raw prompts and tool results stay local by default, and official billing and AI Credit totals require GitHub billing exports or the Copilot usage metrics API.

## 11. Checklist

- [ ] `workshop.env` created with your name and role.
- [ ] `local-otel/workshop-ready.sh` completed and reported ready.
- [ ] `http://localhost:3300` shows your name and role.
- [ ] At least one real workspace session appears.
- [ ] Coach shows an efficiency score and recommendations.
- [ ] Credits view shows your premium-request budget and model mix.
- [ ] You explored all eight views.
- [ ] You switched the interface language at least once.

## References

- [Frontier Developer Cockpit Local OpenTelemetry Kit](../local-otel/README.md)
- [Frontier Cockpit Local Links Guide](../docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/)
