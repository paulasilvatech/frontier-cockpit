---
title: "Frontier Cockpit Enterprise Readiness Checklist"
description: "Readiness checklist for packaging Frontier Cockpit as a coherent enterprise offer across local developer telemetry, Azure FinOps consolidation, governance, privacy, validation, and workshop delivery."
author: "Frontier Cockpit Team"
date: "2026-06-22"
version: "1.0.0"
status: "approved"
tags: ["frontier-cockpit", "enterprise-readiness", "github-copilot", "opentelemetry", "azure", "governance"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Enterprise Readiness Checklist

This checklist defines what must be true before presenting Frontier Cockpit as a coherent enterprise offer. It separates the package-ready baseline from advanced enterprise hardening so teams can ship a professional experience without confusing local operational telemetry with official billing or adoption sources.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.0 | 2026-06-22 | Frontier Cockpit Team | Initial enterprise readiness checklist for the integrated Frontier Cockpit offer. |

## Table of Contents

- [1. Offer Coherence](#1-offer-coherence)
- [2. Local Runtime](#2-local-runtime)
- [3. Azure Enterprise](#3-azure-enterprise)
- [4. GitHub Intelligence](#4-github-intelligence)
- [5. Dashboards](#5-dashboards)
- [6. Privacy And Security](#6-privacy-and-security)
- [7. Validation Gates](#7-validation-gates)
- [8. Workshop Delivery](#8-workshop-delivery)
- [9. Advanced Enterprise Hardening](#9-advanced-enterprise-hardening)
- [References](#references)

## 1. Offer Coherence

| Check | Required State | Status |
| --- | --- | --- |
| Product taxonomy | Frontier Cockpit, Frontier Developer Cockpit, Frontier FinOps Cockpit, Frontier Platform Layers, GitHub Intelligence Layer, and Fleet Overview are consistently named. | Required |
| Developer path | Developers can find how to start the local runtime, inspect Aspire, use Grafana, and improve prompts. | Required |
| Platform path | Platform and FinOps teams can find Azure deployment, data consolidation, operations, and governance guidance. | Required |
| Official sources | Local OpenTelemetry is described as operational telemetry. Official billing, AI Credits, and adoption require GitHub-provided sources. | Required |
| Deliverables | Documentation, diagrams, decks, and workshop labs are discoverable from the root README. | Required |

## 2. Local Runtime

| Check | Required State | Status |
| --- | --- | --- |
| Collector | Local OpenTelemetry Collector accepts OTLP HTTP on `4318` and OTLP gRPC on `4317`. | Required |
| Live trace view | Aspire Dashboard opens at `http://localhost:18888`. | Required |
| Durable local history | Prometheus, Tempo, Loki, Grafana, and PostgreSQL run through Docker Compose. | Required |
| Grafana dashboards | Local dashboards are provisioned from source-controlled JSON. | Required |
| Materialization | Real `copilot-chat` traces are summarized into `copilot_real_session_*` metrics. | Required |
| Daily rollup | `copilot_daily_workspace_*` metrics and logs are emitted from real workspace telemetry. | Required |
| LaunchAgents | Versioned templates exist and can be installed or removed with repository scripts. | Required |
| Hourly dashboard data refresh | Coverage metadata, rolling 24-hour workspace rollups, GitHub Enterprise ingestion, and organization status ingestion refresh at least hourly while the local stack and credentials are available. | Required |
| Local insights | DuckDB local insight store is optional and documented as complementary to Prometheus and Grafana. | Recommended |

## 3. Azure Enterprise

| Check | Required State | Status |
| --- | --- | --- |
| Azure resources | Container Apps Collector, Application Insights, Log Analytics, Azure Monitor workspace, Azure Managed Grafana, and managed identity are deployable with Bicep. | Required |
| Hybrid forwarding | Local Collector can forward sanitized traces, metrics, and logs to Azure. | Required |
| Customer parameters | Subscription, region, resource group, workload token, and environment are documented as customer-specific values. | Required |
| Runtime validation | `~/.copilot-otel/azure/check-azure-runtime.sh` can verify deployed Azure resources and Log Analytics queries without changing resources. | Required |
| Dashboard import | Azure Managed Grafana dashboard import command is documented. | Required |
| Teardown | Azure resource teardown is documented and explicit. | Required |

## 4. GitHub Intelligence

| Check | Required State | Status |
| --- | --- | --- |
| Enterprise audit log | Enterprise audit log API ingestion records availability and bounded events when permitted. | Required |
| Audit streaming | Azure Blob Storage audit stream renewal is documented and automated through LaunchAgent templates. | Required |
| Organization status | Organization GitHub Copilot billing/settings and metrics availability are recorded as real status signals. | Required |
| API failures | `404`, `403`, and `422` API outcomes are treated as availability data, not synthetic usage gaps. | Required |
| Official usage | GitHub Copilot usage metrics and billing exports remain roadmap items until approved sources are connected. | Required |

## 5. Dashboards

| Check | Required State | Status |
| --- | --- | --- |
| Home dashboard | Frontier Developer Cockpit Home provides starting context and drill-down links. | Required |
| Context dashboard | Context, cache behavior, cold tokens, and operational AIU are shown without implying official billing. | Required |
| Real workspace dashboard | Real workspace-attributed sessions are separated from non-workspace telemetry. | Required |
| Data quality dashboard | Real, non-workspace, synthetic, unavailable, and not-observed-yet states are clear. | Required |
| Developer coach | Prompt improvement and workflow interpretation are tied to real local telemetry. | Required |
| Coverage dashboard | Expected signals are tracked as observed or not observed yet. | Required |
| Dashboard gate | Dashboard JSON, UIDs, links, and unsafe cost wording are validated. | Required |

## 6. Privacy And Security

| Check | Required State | Status |
| --- | --- | --- |
| Raw content boundary | Raw prompts, responses, tool arguments, and tool results stay local unless explicitly approved. | Required |
| Azure redaction | Azure forwarding removes sensitive and oversized content attributes. | Required |
| Secrets hygiene | `.env`, SAS values, tokens, runtime logs, local state, DuckDB files, and GitHub API exports are not committed. | Required |
| Local warning | Content capture risks are explained before workshops or customer demos. | Required |
| Billing boundary | Dashboards and documents do not infer official spend or AI Credits from local token counts. | Required |

## 7. Validation Gates

| Gate | Command | Required State |
| --- | --- | --- |
| Primitive audit | `bash .github/scripts/audit-primitives.sh` | Passes |
| Skill audit | `bash .github/scripts/audit-skills.sh` | Passes |
| External content audit | `bash .github/scripts/audit-external-content.sh` | Passes |
| Deliverable gate | `bash .github/scripts/validate-deliverables.sh` | Passes |
| Dashboard gate | `bash .github/scripts/validate-dashboards.sh` | Passes |
| llms index | `bash .github/scripts/generate-llms-txt.sh --check` | Passes |
| Local runtime | `local-otel/check-otel-local.sh` | Passes when the runtime is expected to be active |
| Demo readiness | `local-otel/demo-ready.sh` | Passes before demos |

## 8. Workshop Delivery

| Check | Required State | Status |
| --- | --- | --- |
| Participant path | Workshop README and participant checklist link to the local dashboards. | Required |
| Facilitator path | Workshop guide explains demo framing, data boundaries, and discussion prompts. | Required |
| Safety briefing | Content capture, Azure redaction, and billing source boundaries are stated before demos. | Required |
| Completion evidence | Participants can show Aspire traces, Grafana dashboards, materialized session metrics, and one prompt improvement. | Required |

## 9. Advanced Enterprise Hardening

These items are not required for the package-ready baseline, but they are recommended for production enterprise rollout.

| Hardening Item | Purpose | Status |
| --- | --- | --- |
| Azure API Management gateway | Govern and rate-limit enterprise ingestion or future tool/model APIs. | Optional advanced track |
| Azure Key Vault | Centralize secret storage and rotation for enterprise deployments. | Optional advanced track |
| Multi-region deployment | Support regional redundancy and data residency patterns. | Optional advanced track |
| Image digest pinning | Strengthen container supply-chain control. | Optional advanced track |
| Azure alerts | Monitor ingestion lag, Collector health, and GitHub API availability. | Optional advanced track |
| Immutable audit storage | Strengthen audit log retention and compliance posture. | Optional advanced track |

## References

- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [GitHub Copilot usage metrics API](https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/analyzing-usage-over-time-with-the-copilot-metrics-api)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Azure Monitor documentation](https://learn.microsoft.com/azure/azure-monitor/)
- [Azure Managed Grafana documentation](https://learn.microsoft.com/azure/managed-grafana/)
