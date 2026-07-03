---
title: "Frontier Cockpit AI Credits and Planner Guide"
description: "Step-by-step guide to GitHub Copilot AI Credits, per-plan allowances, token-efficiency best practices, and the workspace Planner with overage and frontier-model justification."
author: "Frontier Cockpit Team"
date: "2026-07-03"
version: "1.0.0"
status: "approved"
language: "en"
tags: ["github-copilot", "ai-credits", "planner", "token-efficiency", "local"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit AI Credits and Planner Guide

This is the default English guide. Portuguese (Brazil) and Spanish versions live next to this file: `FrontierCockpit_AiCreditsAndPlannerGuide_v1_0_0_2026-07-03_pt-BR.md` and `FrontierCockpit_AiCreditsAndPlannerGuide_v1_0_0_2026-07-03_es.md`.

This guide is for the individual developer using the local dashboard at `http://localhost:3300`. It explains how GitHub Copilot AI Credits billing works, how to configure your real license in the cockpit, how to work inside your included allowance, and how to use the Planner view to forecast a project and justify an overage request or the use of frontier models.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-07-03 | Frontier Cockpit Team | Initial trilingual guide for AI Credits, token efficiency, and the Planner view. |

## Table of Contents

- [1. How GitHub Copilot Billing Works Now](#1-how-github-copilot-billing-works-now)
- [2. Included AI Credits Per Plan](#2-included-ai-credits-per-plan)
- [3. Step By Step: Configure Your License In The Cockpit](#3-step-by-step-configure-your-license-in-the-cockpit)
- [4. Step By Step: Work Inside Your Included Credits](#4-step-by-step-work-inside-your-included-credits)
- [5. Step By Step: Use The Planner View](#5-step-by-step-use-the-planner-view)
- [6. Step By Step: Justify Overage Or Frontier Models](#6-step-by-step-justify-overage-or-frontier-models)
- [7. Every Configurable Value](#7-every-configurable-value)
- [8. Honesty Rules](#8-honesty-rules)

## 1. How GitHub Copilot Billing Works Now

Since June 1, 2026, every GitHub Copilot plan uses usage-based billing measured in GitHub AI Credits:

1. **1 AI Credit equals US$0.01.**
2. Usage is metered from **tokens** (input, output, and cached) at each model's listed API rate. There are no more premium-request multipliers; the legacy premium request system was retired.
3. **Code completions and next edit suggestions are always included** and never consume AI Credits.
4. **Auto model selection is billed with a 10% discount** on model costs on paid plans. Auto routes each prompt to a capable model, reserving expensive reasoning models for complex problems.
5. Allowances **reset at 00:00 UTC on the first day of each calendar month** and unused credits **do not roll over**.
6. When the included allowance runs out, paid plans can buy **additional usage (overage)** billed at per-model API rates at the end of the cycle. An organization admin must enable overages and can set per-user budgets.

Sources: GitHub Docs — "Plans for GitHub Copilot", "Usage-based billing for individuals", "Usage-based billing for organizations and enterprises", and the GitHub blog post "GitHub Copilot is moving to usage-based billing". Values can change; the cockpit keeps every number configurable for this reason.

## 2. Included AI Credits Per Plan

Reference allowances as published at the time of writing:

| Plan | Price | Included AI Credits / month | Notes |
| --- | --- | --- | --- |
| Free | US$0 | Not published (treated as 0 locally) | Auto model selection only, 2,000 completions |
| Pro | US$10 | 1,500 (1,000 base + 500 flex) | Individual |
| Pro+ | US$39 | 7,000 (3,900 base + 3,100 flex) | Individual |
| Max | US$100 | 20,000 (10,000 base + 10,000 flex) | Individual |
| Business | US$19/user | 1,900 per user, no flex | Organization |
| Enterprise | US$39/user | 3,900 per user, no flex | Organization |

**About the "3,000 credits" you may see:** existing Business and Enterprise customers receive a temporary promotional allowance from June 1 to September 1, 2026 — 3,000 credits per user on Business and 7,000 on Enterprise. It is not the standard allowance. The cockpit only applies it when you explicitly enable `FRONTIER_AI_CREDITS_USE_PROMO=true`, and it automatically falls back to the standard values after the window closes.

The "flex allotment" on individual plans is an additional variable amount on top of base credits, designed to adapt as model pricing evolves.

## 3. Step By Step: Configure Your License In The Cockpit

1. Copy the environment template if you have not yet:

   ```bash
   cp local-otel/workshop.env.example local-otel/workshop.env
   ```

2. Edit `local-otel/workshop.env` and set your real license:

   ```bash
   FRONTIER_COPILOT_PLAN="business"       # free | pro | pro+ | max | business | enterprise
   FRONTIER_COPILOT_SEATS="1"             # per-seat plans multiply the allowance
   FRONTIER_AI_CREDITS_USE_PROMO="false"  # true ONLY if you are an existing Business/Enterprise customer inside the promo window
   FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE="" # blank derives it from plan and seats; set a number to override
   ```

3. Restart the stack so the API picks the values up:

   ```bash
   local-otel/stop-full-stack.sh && local-otel/start-full-stack.sh
   ```

4. Open `http://localhost:3300` → **Credits**. The budget panel now shows your plan, the correct included allowance, and whether the value is `standard`, `promotional`, or an `override`. The plan comparison panel shows all six plans with your configured plan highlighted.

5. Verify from the terminal (real data, not hardcoded):

   ```bash
   curl -s http://localhost:3300/api/plans | python3 -m json.tool
   ```

## 4. Step By Step: Work Inside Your Included Credits

The cockpit computes every tip from your real telemetry against thresholds you control. The documented practices behind the coach rules:

1. **Prefer Auto model selection for routine work.** Auto picks a capable model per prompt and is billed with a 10% discount on paid plans. Reserve a specific frontier model for complex refactoring, architecture, or multi-step debugging. Watch the **Coach** view: the "Try Auto model selection" card appears when frontier-tier models dominate low-complexity sessions.
2. **Keep one model per session.** Switching models mid-session invalidates the prompt cache, so the full context is re-sent and billed as fresh input. The "Cache reuse is low" alert (default threshold: below 35% cache reads) is the signal.
3. **Start a new chat when you change topics.** Old history keeps being reprocessed otherwise. The "Context window is filling up" alert fires at 70% peak utilization (90% critical).
4. **Reference files instead of pasting them, and attach only what the task needs.** The "Cold context is high" alert fires when more than 45% of prompt tokens are uncached cold input; the "Trim oversized prompts" tip fires when input tokens exceed output by 20x.
5. **Give agents small, scoped tasks** with an explicit completion definition. A long agent session with a frontier model across many files costs more than a focused chat question.
6. **Fix root causes before retrying.** The "Sessions reported errors" alert points to failing tool calls in Aspire/Tempo; retry loops burn credits with no result.
7. **Watch your budget pacing.** The budget panel projects month-end consumption from your real daily rate and warns at 75% (critical at 90%) of the included allowance.

Every threshold above is a local planning guardrail — see the **Settings** view for the full table with the exact environment variable for each one.

## 5. Step By Step: Use The Planner View

The Planner answers: *does my project fit in my included credits, and do I need to ask for more?*

1. Open `http://localhost:3300` → **Planner**.
2. Pick the **workspace** with the global workspace selector in the top bar (or keep "All workspaces").
3. Pick the **lookback** (24h, 7d, 14d, 30d) — the window used to measure your real burn rate. Use at least 7d once you have a week of telemetry.
4. Pick the **horizon** (2, 4, 8, or 12 weeks) — how far ahead to project the project's consumption.
5. Read the forecast panel:
   - **Observed in scope**: real AI Credits consumed in the lookback for this workspace.
   - **Daily burn**: observed credits divided by the lookback days.
   - **Next N weeks**: the horizon projection for this workspace.
   - **Projected month (all work)** and **Projected allowance use**: your total monthly trajectory versus the included allowance.
6. The verdict line tells you either "projected usage fits inside the included monthly allowance" or the projected **overage in credits and US$**.
7. Read the **Model strategy** panel: your credits split by price tier (frontier / standard / unpriced), the average tool calls per tier, and the verdict — `frontier justified`, `review frontier use`, `no frontier usage`, or `no data yet`.

The tier classification is data-driven: a model counts as frontier when its registered output price is at or above `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` (default US$20 per 1M output tokens) in the local price registry (`local-otel/seed-model-prices.sh`). Update the registry prices to match your source of truth.

## 6. Step By Step: Justify Overage Or Frontier Models

1. In the **Planner** view, scroll to **Budget justification draft**.
2. Click **Copy markdown**. The draft contains, from real telemetry: your plan and included allowance, observed credits and sessions in scope, the daily burn, the horizon and monthly projections, the projected overage in credits and US$, and the model-strategy rationale.
3. Paste it into your request to your tech lead or organization admin. Two scenarios:
   - **Overage request**: the draft quantifies how many additional credits the cycle needs and reminds the approver that overage is billed at per-model API rates and requires an admin to enable additional usage with a per-user budget.
   - **Frontier model justification**: when frontier sessions are genuinely complex (average tool calls at or above the complexity threshold), the draft argues for keeping frontier models on that work. When they are not, it lists the low-complexity frontier sessions and the credits that could move to Auto — in that case the honest recommendation is to switch routine work to Auto before asking for more budget.
4. The draft always closes with the disclaimer that local telemetry is an operational estimate, and official numbers must come from the GitHub usage dashboard or billing exports. Never remove it — approvers need to know what they are looking at.

## 7. Every Configurable Value

Nothing in the tips, budget, or planner math is hardcoded. Set these on the `frontier-dashboard-api` service (via `workshop.env`/`client.env` or the compose environment) and restart:

| Variable | Default | Controls |
| --- | --- | --- |
| `FRONTIER_COPILOT_PLAN` | `business` | Plan used for the allowance and plan panels |
| `FRONTIER_COPILOT_SEATS` | `1` | Seat multiplier on per-seat plans |
| `FRONTIER_AI_CREDITS_USE_PROMO` | `false` | Opt into the promotional transition allowance |
| `FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE` | derived | Hard override of the monthly credit pool |
| `FRONTIER_AI_CREDITS_PROMO_START` / `_END` | `2026-06-01` / `2026-09-01` | Promotional window dates |
| `AI_CREDIT_USD` | `0.01` | US$ value of one AI Credit |
| `AUTO_MODEL_SELECTION_DISCOUNT` | `0.10` | Auto model selection discount used in what-if savings |
| `THRESHOLD_AI_CREDITS_WARN` / `_CRIT` | `250` / `500` | Range credit alerts |
| `THRESHOLD_INPUT_TOKENS_WARN` / `_CRIT` | `3000000` / `6000000` | Input token alerts |
| `THRESHOLD_CONTEXT_WARN_PCT` / `_CRIT_PCT` | `70` / `90` | Context pressure alerts |
| `THRESHOLD_CACHE_EFFICIENCY_WARN` | `0.35` | Cache reuse floor |
| `THRESHOLD_COLD_RATIO_WARN` | `0.45` | Cold input ceiling |
| `THRESHOLD_AI_CREDITS_BUDGET_WARN_PCT` / `_CRIT_PCT` | `75` / `90` | Budget pacing alerts |
| `THRESHOLD_MODEL_CONCENTRATION` | `0.6` | Model concentration coach card |
| `THRESHOLD_PROMPT_IO_RATIO` | `20` | Oversized prompt coach card |
| `COACH_SCORE_BASE` | `55` | Efficiency score baseline |
| `COACH_SCORE_CACHE_WEIGHT` | `45` | Score reward for cache reuse |
| `COACH_SCORE_COLD_PENALTY` | `30` | Score penalty for cold input |
| `COACH_SCORE_CONTEXT_PENALTY` | `15` | Score penalty for context pressure |
| `COACH_SCORE_ERROR_PENALTY` | `10` | Score penalty for error rate |
| `COACH_COLD_SAVINGS_FACTOR` | `0.5` | Fraction of cold credits counted as savings |
| `COACH_ERROR_SAVINGS_FACTOR` | `0.15` | Fraction of error credits counted as savings |
| `PLANNER_FRONTIER_OUTPUT_PRICE_MIN` | `20` | Frontier tier price floor (US$/1M output tokens) |
| `PLANNER_COMPLEX_SESSION_MIN_TOOL_CALLS` | `5` | Complexity bar for frontier justification |

The **Settings** view renders all of these live, with the value currently in effect.

## 8. Honesty Rules

This dashboard is for the local developer scenario only. It follows three rules so the right audience gets the right data:

1. **Local telemetry is never presented as official billing.** Every credit figure is an operational estimate from OpenTelemetry AIU signals; official totals come from the GitHub usage dashboard, billing exports, or the Copilot usage metrics API.
2. **Reference plan data is labeled with its source and stays configurable**, because GitHub allowances, promotions, and prices change.
3. **The planner never invents precision.** Projections extrapolate the observed burn rate; the justification draft carries the numbers, the method, and the disclaimer together.
