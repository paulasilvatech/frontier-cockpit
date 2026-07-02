---
title: "Frontier Cockpit Software Requirements Specification"
description: "Functional and non-functional requirements for Frontier Cockpit Local and Frontier Cockpit Hybrid, structured after ISO/IEC/IEEE 29148 with ISO/IEC 25010:2023 quality characteristics."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.0.0"
status: "approved"
tags: ["frontier-cockpit", "requirements", "srs", "iso-29148", "iso-25010"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Software Requirements Specification

This document specifies the functional requirements (FR) and non-functional requirements (NFR) for the Frontier Cockpit product. Its structure follows the software requirements specification guidance of ISO/IEC/IEEE 29148:2018. Non-functional requirements are organized by the nine quality characteristics of the ISO/IEC 25010:2023 product quality model. Requirement statements use EARS-style phrasing (ubiquitous, event-driven, and state-driven forms) so each requirement is singular, verifiable, and traceable.

## 1. Introduction

### 1.1 Purpose

Define what Frontier Cockpit must do and how well it must do it, so that engineering, client delivery, and validation share one testable contract.

### 1.2 Scope

Frontier Cockpit is a client-run observability product for GitHub Copilot Chat and agent activity, delivered in two editions:

- **Frontier Cockpit Local (Developer Edition):** a fully local Docker stack (OpenTelemetry Collector, Aspire Dashboard, Tempo, Prometheus, Loki, Grafana OSS, a scheduled jobs container, a model price registry sidecar, and a dashboard mini app) that receives GitHub Copilot OpenTelemetry signals from VS Code and turns them into developer-facing insight.
- **Frontier Cockpit Hybrid (Enterprise Edition):** the Local edition plus sanitized telemetry forwarding to client-owned Azure resources (Container Apps collector, Application Insights, Log Analytics, Azure Monitor workspace, Azure Managed Grafana) for governed history, FinOps rollups, and leadership views.

Out of scope: official GitHub Copilot billing (owned by GitHub billing exports and the GitHub Copilot usage metrics API), source code analysis, and any modification of GitHub Copilot behavior.

### 1.3 Definitions

| Term | Definition |
| --- | --- |
| AI Credits | GitHub usage-based billing unit for GitHub Copilot, effective 2026-06-01; 1 AI Credit equals 0.01 USD of model usage at listed token rates. |
| AIU | Local "AI usage" estimate computed from observed tokens; operational telemetry, never official billing. |
| Content capture | Optional collection of raw prompts, responses, file paths, tool arguments, and tool results. |
| Materializer | The scheduled job that summarizes real Tempo traces into Prometheus metrics and Loki logs. |
| Sanitized forwarding | The Azure pipeline that deletes raw content attributes before telemetry leaves the machine. |
| Workspace attribution | Labeling telemetry with repository, branch, and workspace identity derived from the local Git context. |

### 1.4 Stakeholders and user classes

| User class | Primary needs |
| --- | --- |
| Developer | Private, immediate feedback on GitHub Copilot usage, cost, cache, and context behavior. |
| Tech lead | Team-level patterns, coaching signals, model mix, and quality trends. |
| Platform engineer | Stack health, ingestion coverage, data quality, upgrade and validation paths. |
| FinOps and leadership | Governed, sanitized rollups in Azure; budget tracking against AI Credits allowances. |
| Security and privacy | Explicit data boundaries, opt-in content capture, secret hygiene, least privilege. |

## 2. Product context and rationale

Why this product exists, and the external evidence behind its design goals:

- AI-assisted development is now near-universal (90 percent adoption in the 2025 DORA report) and correlates with higher throughput but worse delivery stability, which makes measurement and feedback loops a control system rather than a luxury.
- The 2026 DORA publication on the return on investment of AI-assisted development describes a J-curve with a "verification tax" and shows that returns come from the organizational system, not from tools alone; a cockpit that surfaces friction (cold context, retries, context pressure) shortens that curve.
- GitHub moved GitHub Copilot to usage-based billing with AI Credits on 2026-06-01, which turns token behavior (cache reuse, context size, model mix) directly into money and makes local cost telemetry actionable for every developer.
- The FinOps Foundation reports that 98 percent of practitioners now manage AI spend and names AI cost visibility and unit economics as top challenges; the FOCUS 1.4 specification adds virtual-currency (credit and token) lifecycle concepts that map directly onto this product's AI Credits tracking.
- OpenTelemetry GenAI semantic conventions are the emerging industry standard for LLM and agent telemetry, adopted across major vendors, while still marked experimental; the product therefore treats attribute names as versioned inputs.

References for these claims are listed in section 8.

## 3. Functional requirements

Each requirement has an identifier, a statement, and acceptance criteria. Priority: M (must), S (should), C (could).

### 3.1 Telemetry ingestion (Local)

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-01 | M | The system shall receive OTLP traces, metrics, and logs over HTTP (port 4318) and gRPC (port 4317) on the loopback interface only. |
| FR-02 | M | When the client bootstrap runs, the system shall configure VS Code user settings for GitHub Copilot OpenTelemetry (enabled, otlp-http exporter, local endpoint, content capture flag) for each configured VS Code channel, creating a timestamped backup of any existing settings file. |
| FR-03 | M | The system shall fan out received telemetry to Aspire Dashboard (live), Tempo (traces), Prometheus (metrics), and Loki (logs). |
| FR-04 | M | While `FRONTIER_ENABLE_CONTENT_CAPTURE` is false (the default), the system shall not persist raw prompts, responses, tool arguments, or tool results. |
| FR-05 | M | When the bootstrap runs inside a Git repository, the system shall register the workspace (repository, branch, hashed path) so telemetry can be attributed to it. |

### 3.2 Materialization and scheduled jobs

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-06 | M | The system shall run the session materializer on a fixed interval (default 300 seconds) inside the `copilot-otel-jobs` container, summarizing real Tempo traces into per-session Prometheus series (tokens by class, tool calls, errors, context utilization, nano AIU) without synthesizing usage. |
| FR-07 | M | The system shall run the daily rollup on a fixed interval (default 86400 seconds) producing per-repository 24 hour summaries as OTLP metrics and logs. |
| FR-08 | M | The jobs container shall persist materializer state on a Docker volume so container restarts do not duplicate or lose session summaries. |
| FR-09 | M | The system shall expose job liveness through a container healthcheck and through the dashboard API health endpoint (materializer freshness within 30 minutes). |
| FR-10 | S | The registry sidecar shall refresh local model price and planning series at least every 300 seconds, labeled as local planning assumptions. |

### 3.3 Dashboard and metrics

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-11 | M | The dashboard mini app at `http://localhost:3300` shall display: sessions, input/output/cache-read/cache-creation/cold/reasoning tokens, cache efficiency, context utilization (typical and peak), model mix with estimated AI Credits, TTFT and response duration, tool calls, errors, and data quality (workspace attribution coverage). |
| FR-12 | M | The system shall compute a local AI Credits estimate and a monthly budget view (plan, seats, allowance, utilization, projection, alert level) from configured plan defaults or an explicit allowance override, always labeled as an estimate and never as official billing. |
| FR-13 | M | The coach engine shall produce prioritized recommendations from at least ten rules covering cache reuse, cold context, context pressure, errors, attribution, budget pacing, model cost concentration, and prompt input/output balance. |
| FR-14 | M | Grafana shall provision at least eight local dashboards (home, real workspace usage, context and cost, sessions and models, developer coach, data quality, OTel coverage, VS Code memory) from source-controlled JSON. |
| FR-15 | S | The dashboard UI shall support English, Portuguese, and Spanish. |
| FR-16 | M | All health, summary, sessions, and coach data shall be served by the local API from Prometheus queries; when a backend is unreachable the API shall degrade per metric with an explicit `unavailable` status instead of failing the whole response. |

### 3.4 Hybrid forwarding (Azure)

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-17 | M | When hybrid mode is enabled, the local Collector shall forward telemetry to the client-owned Azure collector through dedicated pipelines that delete raw content attributes (prompts, responses, tool arguments, tool results, oversized attributes) before export. |
| FR-18 | M | The Azure collector shall re-apply the same redaction rules before exporting to Application Insights (defense in depth). |
| FR-19 | M | Hybrid ingestion shall require an authentication token; the token shall never be committed to git and shall be stored in a local, permission-restricted env file. |
| FR-20 | M | Infrastructure shall be defined in Bicep with dev, test, and prod parameter files selectable via `AZURE_DEPLOY_ENV`, and tagged with workload, environment, owner, cost center, and data classification. |
| FR-21 | S | The Azure roadmap items (managed identity for ingestion, Key Vault secret references, Azure Monitor workspace remote write with the Monitoring Metrics Publisher role on the data collection rule, private networking) shall be tracked in the enterprise readiness checklist and require a client Azure subscription to implement and verify. |

### 3.5 GitHub Enterprise signals (optional)

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-22 | S | The system shall ingest a bounded page of the GitHub Enterprise audit log and emit availability status metrics when the API is not accessible, treating 403/404/422 as real signals rather than failures. |
| FR-23 | S | The system shall read GitHub Copilot usage metrics through the generally available reports API (`/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day`), which replaced the legacy metrics API sunset on 2026-04-02, and shall record report day and download link count. |
| FR-24 | C | The system shall configure GitHub Enterprise audit log streaming to Azure Blob Storage using a user delegation SAS encrypted with the GitHub stream public key, storing state only in local permission-restricted files. |

### 3.6 Operations and validation

| ID | Priority | Requirement |
| --- | --- | --- |
| FR-25 | M | A single bootstrap per platform (bash for macOS and Linux, PowerShell for Windows) shall configure, start, and validate the stack end to end. |
| FR-26 | M | `check-workshop-local.sh` shall validate Docker, the ten expected containers, all endpoints, workspace registration, and (in strict mode) the presence of real workspace-attributed telemetry. |
| FR-27 | M | The system shall provide documented stop (`stop-full-stack.sh`) and uninstall procedures that remove containers, volumes, VS Code settings changes, and local state. |
| FR-28 | M | Continuous integration shall gate every change on: primitive audits, llms.txt freshness, dashboard JSON validation, shellcheck and zsh syntax checks, TypeScript and Vite builds, docker compose config validation for base and hybrid overlays, sidecar image builds, and secret scanning. |

## 4. Non-functional requirements (ISO/IEC 25010:2023)

### 4.1 Functional suitability

| ID | Requirement |
| --- | --- |
| NFR-01 | Local AIU and AI Credits values shall always be labeled as operational estimates; official billing claims shall reference GitHub billing exports or the GitHub Copilot usage metrics API only. |
| NFR-02 | The system shall never fabricate usage: when a source API is unavailable, availability status is recorded instead of synthetic data. |

### 4.2 Performance efficiency

| ID | Requirement |
| --- | --- |
| NFR-03 | The dashboard API shall respond to `/api/summary` within 6 seconds with all backends healthy (bounded by its per-query timeout of 4 to 6 seconds). |
| NFR-04 | The Collector shall enforce a memory limiter (80 percent soft limit with 25 percent spike headroom) so telemetry bursts degrade gracefully instead of crashing the stack. |
| NFR-05 | Local retention defaults shall be 30 days (Prometheus) and 720 hours (Tempo, Loki) to bound disk usage on developer machines. |

### 4.3 Compatibility

| ID | Requirement |
| --- | --- |
| NFR-06 | The full stack, including scheduled jobs, shall run identically on macOS, Linux, and Windows (Docker Desktop with WSL2), with no host scheduler dependency. |
| NFR-07 | All container images shall be pinned to explicit versions (no `latest`) and shall be multi-architecture (amd64 and arm64). |
| NFR-08 | Telemetry attributes shall follow OpenTelemetry GenAI semantic conventions where available, treating them as experimental and versioned inputs until declared stable. |

### 4.4 Interaction capability

| ID | Requirement |
| --- | --- |
| NFR-09 | A developer shall reach a working cockpit from a fresh clone with at most three commands (copy env example, edit values, run bootstrap). |
| NFR-10 | The dashboard shall present persona-relevant views (developer flow, credits, sessions, workspaces, coach, history, health, settings) in EN, PT, and ES. |

### 4.5 Reliability

| ID | Requirement |
| --- | --- |
| NFR-11 | All services shall restart automatically (`restart: unless-stopped`); Grafana, Prometheus, Tempo, Loki, registry, jobs, API, and web shall expose container healthchecks. |
| NFR-12 | Failure of any single backend shall not prevent the dashboard from rendering the remaining data (per-metric degradation). |

### 4.6 Security

| ID | Requirement |
| --- | --- |
| NFR-13 | No default credentials: the Grafana admin password and the Aspire API key shall be generated per installation and stored only in gitignored, permission-restricted files; anonymous Grafana access shall be disabled. |
| NFR-14 | All published container ports shall bind to 127.0.0.1 only; no service shall listen on external interfaces. |
| NFR-15 | Secrets (Azure OTLP token, SAS URLs, stream state) shall be written with mode 0600 and covered by gitignore; CI shall run secret scanning on every push. |
| NFR-16 | Security reports shall be received through GitHub private vulnerability reporting with a five business day initial response target. |

### 4.7 Maintainability

| ID | Requirement |
| --- | --- |
| NFR-17 | All scripts shall resolve paths relative to their own location so the repository can be cloned anywhere; no script shall assume a home-directory install path. |
| NFR-18 | Shell scripts shall pass shellcheck (bash) or zsh syntax checks in CI; the dashboard app shall build from a clean checkout with `npm ci` and `npm run build`. |
| NFR-19 | The primitive inventory (agents, skills, prompts, instructions) shall be regenerated into `llms.txt` and verified by CI on every change. |

### 4.8 Flexibility

| ID | Requirement |
| --- | --- |
| NFR-20 | Plan allowances, thresholds, retention, intervals, endpoints, and dashboard identity shall be configurable through environment variables with documented defaults. |
| NFR-21 | The Azure deployment shall support dev, test, and prod parameter sets and location and naming overrides without code changes. |

### 4.9 Safety (operational)

| ID | Requirement |
| --- | --- |
| NFR-22 | Destructive operations (teardown, volume removal, secret rotation) shall never run implicitly; they require explicit documented commands. |
| NFR-23 | The bootstrap shall back up VS Code settings before modifying them and shall fail with a clear message rather than writing a corrupt settings file. |

### 4.10 Privacy and data boundary (product-specific)

| ID | Requirement |
| --- | --- |
| NFR-24 | Content capture shall be opt-in (default false) at every layer: VS Code settings, environment variables, materializer, and workshop guidance. |
| NFR-25 | Raw prompts, responses, tool arguments, and tool results shall never leave the machine in hybrid mode; only sanitized, redacted telemetry may be forwarded. |
| NFR-26 | The repository shall contain no personal data, customer identifiers, or authoring-environment leftovers; committed defaults are generic placeholders. |

## 5. Constraints and assumptions

- GitHub Copilot OpenTelemetry support in VS Code (settings under `github.copilot.chat.otel.*`) shipped in VS Code 1.119 (2026-05-06) and remains experimental; setting names and span attributes can change between VS Code releases.
- OpenTelemetry GenAI semantic conventions moved to a dedicated repository in June 2026 and are not yet stable; attribute names are treated as versioned inputs.
- Local AI Credits math assumes the GitHub allowances effective 2026-06-01 (Pro 1,500; Pro+ 7,000; Max 20,000; Business 1,900 per user pooled; Enterprise 3,900 per user pooled; promotional Business 3,000 and Enterprise 7,000 through 2026-09-01) and remains configurable because plans change.
- The GitHub Copilot usage metrics reports API requires at least five active GitHub Copilot licenses and appropriate scopes; smaller organizations will see availability status instead of data.
- Hybrid-mode Azure hardening items in FR-21 require a client Azure subscription for implementation and verification and are tracked as roadmap, not shipped behavior.

## 6. Verification

| Requirement group | Verification method |
| --- | --- |
| FR-01..FR-05, FR-25 | `bash local-otel/client-bootstrap.sh` on each platform, then `local-otel/check-workshop-local.sh`. |
| FR-06..FR-10 | Container healthchecks (`docker ps`), dashboard health view, `check-workshop-local.sh --strict-data` after one real GitHub Copilot session. |
| FR-11..FR-16 | Dashboard walkthrough per workshop Lab 06; API responses for `/api/summary`, `/api/sessions`, `/api/coach`, `/api/health`. |
| FR-17..FR-21 | `local-otel/azure/validate.sh` (what-if), `deploy.sh`, `check-azure-runtime.sh`; redaction inspected via Application Insights queries. |
| FR-22..FR-24 | Ingestion scripts against a test enterprise; status metrics visible in the GitHub API ingestion dashboard. |
| FR-26..FR-28, NFR-11..NFR-19 | CI workflow `validate.yml` (five jobs) plus the repository validation scripts. |
| NFR-13..NFR-15, NFR-24..NFR-26 | Secret scanning in CI, `.gitignore` coverage review, grep audits for personal data, compose port review. |

## 7. Traceability

Requirement identifiers in this document are referenced from the operations runbook, the enterprise readiness checklist, and CI job names. Changes to requirements bump this document's version and add a Change Log row; implementation changes reference the affected FR/NFR identifiers in commit messages where practical.

## 8. References

- ISO/IEC/IEEE 29148:2018 Systems and software engineering, Life cycle processes, Requirements engineering. https://www.iso.org/standard/72089.html
- ISO/IEC 25010:2023 Systems and software quality models. https://www.iso.org/obp/ui/en/#!iso:std:78176:en
- GitHub, "GitHub Copilot is moving to usage-based billing" (2026-04-27). https://github.blog/news-insights/company-news/github-copilot-is-moving-to-usage-based-billing/
- GitHub Docs, "Usage-based billing for GitHub Copilot" (individuals; organizations and enterprises). https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals
- GitHub changelog, "Copilot Metrics is now generally available" (2026-02-27). https://github.blog/changelog/2026-02-27-copilot-metrics-is-now-generally-available/
- GitHub changelog, "Closing down notice of legacy Copilot metrics APIs" (2026-01-29). https://github.blog/changelog/2026-01-29-closing-down-notice-of-legacy-copilot-metrics-apis/
- Visual Studio Code release notes 1.119 and 1.121 (GitHub Copilot OpenTelemetry agent monitoring). https://code.visualstudio.com/updates/v1_119
- VS Code documentation, "Monitor agent usage with OpenTelemetry". https://code.visualstudio.com/docs/agents/guides/monitoring-agents
- OpenTelemetry GenAI semantic conventions repository. https://github.com/open-telemetry/semantic-conventions-genai
- DORA, "State of AI-assisted Software Development" (2025). https://dora.dev/dora-report-2025/
- DORA, "The ROI of AI-assisted Software Development" (2026). https://dora.dev/ai/roi/report/
- FinOps Foundation, "FinOps for AI" working group and State of FinOps 2026. https://www.finops.org/wg/finops-for-ai-overview/ and https://data.finops.org/
- FinOps Open Cost and Usage Specification (FOCUS) 1.4. https://focus.finops.org/
- Ziegler et al., "Measuring GitHub Copilot's Impact on Productivity", CACM (2024). https://cacm.acm.org/research/measuring-github-copilots-impact-on-productivity/
- Microsoft Learn, "Azure Monitor managed service for Prometheus remote write". https://learn.microsoft.com/azure/azure-monitor/metrics/prometheus-remote-write
- Microsoft Learn, "Manage secrets in Azure Container Apps" (Key Vault references). https://learn.microsoft.com/azure/container-apps/manage-secrets

## Change Log

| Version | Date | Description |
| --- | --- | --- |
| 1.0.0 | 2026-07-02 | Initial software requirements specification for Frontier Cockpit Local and Hybrid. |
