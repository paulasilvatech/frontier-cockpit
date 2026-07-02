---
title: "Frontier Cockpit Taxonomy And Platform Layers"
description: "Final naming, platform taxonomy, L1 to L6 operating layers, and Fleet Overview model for the Frontier Cockpit offer focused on GitHub Copilot."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["frontier-cockpit", "github-copilot", "taxonomy", "platform-layers", "finops", "developer-experience"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Taxonomy And Platform Layers

This document locks the final naming and platform taxonomy for the GitHub Copilot observability and optimization offer.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Rebrand to Frontier Cockpit Local and Hybrid, repository-relative paths, containerized jobs, privacy-first defaults. |
| 1.0.0 | 2026-06-18 | Frontier Cockpit Team | Initial final taxonomy for Frontier Cockpit. |

## Table of Contents

- [1. Final Naming](#1-final-naming)
- [2. Offer Positioning](#2-offer-positioning)
- [3. Two Cockpits, One Platform](#3-two-cockpits-one-platform)
- [4. Platform Layers](#4-platform-layers)
- [5. Fleet Overview](#5-fleet-overview)
- [6. GitHub Copilot Scope](#6-github-copilot-scope)
- [7. Naming Rules](#7-naming-rules)
- [References](#references)

## 1. Final Naming

| Level | Final Name | Meaning |
| --- | --- | --- |
| Umbrella platform | **Frontier Cockpit** | The complete local-to-enterprise platform for GitHub Copilot and agentic development observability. |
| Developer experience | **Frontier Cockpit Local** | The local, private, developer-focused cockpit for learning and optimizing day-to-day GitHub Copilot usage. |
| Enterprise and FinOps experience | **Frontier Cockpit Hybrid** | The centralized Azure cockpit for cost, ROI, governance, adoption, rollups, and leadership insights. |
| Shared platform layer | **Frontier Platform Layers** | The L1 to L6 technical and operational layers that feed both cockpits. |
| Cross-population view | **Fleet Overview** | The aggregate view across developers, repositories, cost centers, orgs, and enterprise scopes. |

## 2. Offer Positioning

**Frontier Cockpit** is a GitHub Copilot-focused observability, learning, FinOps, and governance platform. It helps developers improve how they work with GitHub Copilot and helps leaders understand aggregate usage, cost signals, adoption, and governance.

Short description:

```text
Frontier Cockpit unifies local developer observability and enterprise FinOps governance for GitHub Copilot and agentic development.
```

Tagline:

```text
Local learning for developers. Enterprise control for leaders.
```

## 3. Two Cockpits, One Platform

### 3.1 Frontier Cockpit Local

The **Frontier Cockpit Local** is local and private. It helps developers learn how to work inside the credits and capabilities included with their GitHub Copilot license. It focuses on:

- prompt quality;
- model label awareness;
- context-window use;
- hot, warm, and cold token behavior;
- AIU as an operational signal;
- tool calls and tool loops;
- workspace attribution;
- VS Code process memory;
- opt-in content capture for trusted debugging;
- non-punitive learning and coaching.

This cockpit is for improvement, not surveillance.

### 3.2 Frontier Cockpit Hybrid

The **Frontier Cockpit Hybrid** is centralized in Azure. It helps platform, FinOps, engineering leadership, and governance teams understand aggregate behavior. It focuses on:

- aggregate cost signals;
- ROI and cost per delivery;
- executive rollups;
- allocation by developer, repository, org, team, and cost center when source data is available;
- GitHub Enterprise audit signals;
- GitHub organization policy posture;
- GitHub Copilot API availability;
- governed dashboards and historical analysis;
- sanitized telemetry.

This cockpit is for leadership, governance, and enterprise insight.

## 4. Platform Layers

The same six layers feed both cockpits.

| Layer | Name | Purpose | Feeds |
| --- | --- | --- | --- |
| L1 | Developer Signal Capture | Capture GitHub Copilot Chat, agent mode, CLI, VS Code, tool, token, AIU, and content-capture signals locally. | Frontier Cockpit Local |
| L2 | Local Observability Runtime | Run Aspire, Prometheus, Grafana, Tempo, Loki, and the local OpenTelemetry Collector. Grafana uses its embedded SQLite database for metadata, while DuckDB or SQLite may support Python-first local insights. | Frontier Cockpit Local |
| L3 | Session Intelligence | Materialize real sessions, workspace attribution, model labels, AIU, context utilization, hot/warm/cold tokens, tool behavior, and optional DuckDB/SQLite local analytical state. | Both |
| L4 | Secure Forwarding And Redaction | Separate full-fidelity local data from sanitized enterprise data. Remove raw prompts, tool args, tool outputs, and oversized attributes before Azure. | Frontier Cockpit Hybrid |
| L5 | Azure Consolidation | Store traces, metrics, rollups, and enterprise logs in Application Insights, Log Analytics, Azure Monitor, and Azure Managed Grafana. | Frontier Cockpit Hybrid |
| L6 | GitHub Intelligence Layer | Ingest GitHub Enterprise audit logs, organization GitHub Copilot billing/settings, GitHub Copilot metrics availability, and future official usage/billing exports. | Frontier Cockpit Hybrid |

## 5. Fleet Overview

**Fleet Overview** is the cross-population view built from the platform layers. It is not a separate product; it is an operating view inside Frontier Cockpit Hybrid.

Fleet Overview aggregates:

- developers;
- workspaces;
- repositories;
- branches;
- organizations;
- cost centers;
- teams;
- AIU rollups;
- token behavior;
- context utilization;
- tool calls;
- GitHub Copilot policy posture;
- audit log signals;
- official GitHub usage and billing sources when available.

Fleet Overview should always distinguish:

| Data Type | Meaning |
| --- | --- |
| Local operational telemetry | Real local OTel data from developer machines. |
| GitHub Enterprise metadata | Audit log and organization policy data from GitHub APIs. |
| Official usage metrics | GitHub Copilot usage metrics API data when enabled and available. |
| Official billing data | GitHub billing or AI Credits exports. |
| Availability status | Real API responses such as `404`, `403`, or `422` when a source is unavailable. |

## 6. GitHub Copilot Scope

Frontier Cockpit is focused on GitHub Copilot and agentic development around GitHub Copilot surfaces.

| Area | Supported Scope |
| --- | --- |
| GitHub Copilot Chat | Local OTel traces, metrics, content capture, and session materialization. |
| GitHub Copilot agent mode | Local tool, trace, token, and context visibility. |
| GitHub Copilot CLI | OTel when enabled by environment variables and supported runtime behavior. |
| GitHub Copilot Business | Org-level billing/settings API and local developer telemetry. |
| GitHub Copilot Enterprise | Enterprise audit log, enterprise policy posture, and GitHub Copilot metrics when enabled and available. |
| GitHub Enterprise Cloud repositories | Stronger repository, organization, audit, and policy attribution when repos and orgs live in GHEC. |
| Repositories outside GHEC | Local telemetry can still work, but GitHub Enterprise API enrichment is limited or unavailable. |

## 7. Naming Rules

Use these names consistently:

| Use Case | Correct Name |
| --- | --- |
| Whole offer | Frontier Cockpit |
| Local developer experience | Frontier Cockpit Local |
| Central Azure and leadership view | Frontier Cockpit Hybrid |
| Platform layers | L1 to L6 Frontier Platform Layers |
| Aggregate view | Fleet Overview |
| Product being observed | GitHub Copilot |
| Local debug UI | Aspire Dashboard |
| Local dashboard UI | Grafana OSS |
| Enterprise dashboard UI | Azure Managed Grafana |

Avoid using **Frontier Cockpit Local** as the umbrella name. It is only the local developer-side cockpit.

## References

- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot plans](https://docs.github.com/en/copilot/get-started/plans)
- [GitHub Copilot usage metrics API](https://docs.github.com/en/rest/copilot/copilot-usage)
- [GitHub Copilot user management API](https://docs.github.com/en/rest/copilot/copilot-user-management)
- [GitHub Enterprise audit log API](https://docs.github.com/en/rest/enterprise-admin/audit-log)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
