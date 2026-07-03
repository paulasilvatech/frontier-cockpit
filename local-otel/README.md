---
title: "Frontier Cockpit Local OpenTelemetry Kit"
description: "User-level local OpenTelemetry runtime for Frontier Cockpit Local, including Aspire, Grafana, Prometheus, Tempo, Loki, containerized materialization jobs, and Frontier Cockpit Hybrid Azure forwarding."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["frontier-cockpit", "github-copilot", "opentelemetry", "aspire", "grafana", "local-runtime"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Cockpit Local OpenTelemetry Kit

This user-level kit configures the local runtime for Frontier Cockpit Local, the local edition of Frontier Cockpit. It captures GitHub Copilot Chat and agent telemetry in VS Code or VS Code Insiders, routes it through a local OpenTelemetry Collector, and fans out to Aspire Dashboard, Tempo, Prometheus, Loki, Grafana, and optional Frontier Cockpit Hybrid Azure forwarding.

The repository can be cloned anywhere. All scripts resolve their own location, so no fixed install path is required. Commands in this document are shown repository-relative and are run from the repository root.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.1.0 | 2026-07-02 | Frontier Cockpit Team | Documented the 10-container stack with the jobs container, Grafana embedded SQLite, generated Grafana admin credentials, privacy-first content capture defaults, repository-relative paths, and removal of the legacy Aspire-only helper scripts. |
| 1.0.5 | 2026-07-02 | Frontier Cockpit Team | Added cross-platform client bootstrap scripts for macOS, Linux, and Windows. |
| 1.0.4 | 2026-06-30 | Frontier Cockpit Team | Added the local workshop-ready flow, the workshop validation gate, and the Frontier Cockpit Local mini app entry point. |
| 1.0.3 | 2026-06-23 | Frontier Cockpit Team | Enabled full local content materialization by default and increased trace replay coverage across workspaces. |
| 1.0.2 | 2026-06-23 | Frontier Cockpit Team | Standardized local Tempo, Prometheus, and Loki retention to 30 days and clarified the Docker and Azure sync boundary. |
| 1.0.1 | 2026-06-22 | Frontier Cockpit Team | Aligned title, frontmatter, and settings with the Frontier Cockpit Local offer. |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial local OpenTelemetry kit. |

The cross-platform client bootstrap supports macOS, Linux, and Windows. It applies VS Code or VS Code Insiders GitHub Copilot OpenTelemetry settings, exports standard OTel environment variables for terminal-launched dev agents and tools that honor OTLP, starts the Docker Compose stack, registers the current workspace, and sends a synthetic validation span. Windows uses the PowerShell bootstrap through `pwsh`. No host scheduler is required on any platform: the scheduled materializer and rollup jobs run inside the Docker stack.

The kit has two run modes:

- Full local stack: OpenTelemetry Collector + Aspire + Tempo + Prometheus + Loki + Grafana + registry and jobs sidecars + the Frontier Cockpit Local mini app, with local history.
- Frontier Cockpit Hybrid: full local stack plus forwarding to an Azure Container Apps Collector, Application Insights, Log Analytics, Azure Monitor workspace, and Azure Managed Grafana.

The full local stack runs in Docker and keeps trace, metric, and log history locally for 30 days. Hybrid mode does not wait for local retention to expire. It forwards sanitized telemetry while the stack is running, and the scheduled rollup jobs keep the Azure view refreshed with approved summary signals.

## Stack containers and endpoints

The full local stack runs 10 containers. Every published port binds to `127.0.0.1` only, so nothing is reachable from other machines. Healthchecks are configured on Grafana, Prometheus, Tempo, Loki, the registry sidecar, the jobs container, the dashboard API, and the dashboard web app.

| Container | Image | Purpose | Local endpoint |
| --- | --- | --- | --- |
| `aspire-dashboard` | `mcr.microsoft.com/dotnet/aspire-dashboard:13.4` | Live trace, log, and metric viewer with the GenAI visualizer | `http://localhost:18888` |
| `copilot-otel-collector` | `otel/opentelemetry-collector-contrib:0.155.0` | OTLP ingest and fan-out | `http://localhost:4317` (gRPC), `http://localhost:4318` (HTTP), `http://localhost:9464` (collector metrics) |
| `copilot-otel-tempo` | `grafana/tempo:2.6.1` | Local trace history, 30 days | `http://localhost:3200` |
| `copilot-otel-loki` | `grafana/loki:3.3.2` | Local log history, 30 days | `http://localhost:3100` |
| `copilot-otel-prometheus` | `prom/prometheus:v3.1.0` | Local metric history, 30 days | `http://localhost:9090` |
| `copilot-otel-registry` | local build | Model and price registry sidecar, re-seeds every 5 minutes | internal only |
| `copilot-otel-jobs` | local build | Runs `materialize-copilot-sessions.sh` every 5 minutes and `daily-rollup.sh` daily inside Docker, cross-platform | internal only |
| `copilot-otel-grafana` | `grafana/grafana-oss:11.6.5` | Historical dashboards with embedded SQLite metadata storage | `http://localhost:3000` |
| `frontier-dashboard-api` | local build | Mini app API over Prometheus, Tempo, Loki, and Grafana | internal only |
| `frontier-dashboard-web` | local build | Frontier Cockpit Local mini app | `http://localhost:3300` |

GitHub Copilot Chat uses OTLP/HTTP on `4318`. Dev apps or SDKs that require gRPC can use `4317`.

Grafana stores dashboards, datasources, users, and preferences in its embedded SQLite database inside the `grafana-data` Docker volume. There is no separate database container.

## What is configured

VS Code and VS Code Insiders user settings are configured with:

- `github.copilot.chat.otel.enabled`: `true`
- `github.copilot.chat.otel.exporterType`: `otlp-http`
- `github.copilot.chat.otel.otlpEndpoint`: `http://localhost:4318`
- `github.copilot.chat.otel.captureContent`: follows `FRONTIER_ENABLE_CONTENT_CAPTURE`, default `false`
- `github.copilot.chat.otel.maxAttributeSizeChars`: `0`
- `github.copilot.chat.otel.dbSpanExporter.enabled`: `true`

Content capture is opt-in everywhere. `FRONTIER_ENABLE_CONTENT_CAPTURE` defaults to `false` in the client bootstrap, the shell environment, and the jobs container. When it is `false`, the materializer records session metadata without prompt or response content:

- `COPILOT_MATERIALIZE_CONTENT` follows `FRONTIER_ENABLE_CONTENT_CAPTURE`, default `false`
- `COPILOT_MATERIALIZE_TRACE_LIMIT=1000`

Local DuckDB analytical files are also supported:

- `frontier-insights.duckdb` stores derived developer rollups.
- `frontier-otel-export.duckdb` stores local OTel export snapshots from Prometheus, Loki, Tempo, and the VS Code Agent Host SQLite span database when available.
- DuckDB complements Tempo, Prometheus, Loki, and Grafana. It does not replace those backends.

The integrated terminal user environment also receives OTel variables so terminal sessions can inherit the local endpoint.

Terminal-launched apps get these OTLP defaults:

- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
- `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces`
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs`

The cross-platform client bootstrap is configured through:

- `local-otel/client.env.example`
- `local-otel/client.env`, local-only and gitignored
- `local-otel/client-bootstrap.sh`, for macOS and Linux
- `local-otel/client-bootstrap.ps1`, for Windows PowerShell (`pwsh`)

Shell users who prefer sourcing directly from the repository can use:

- `local-otel/env.zsh`
- `local-otel/enable-user-env.sh`
- `local-otel/workspace-tags.zsh`

This covers new terminal sessions, integrated terminals, and GUI apps launched after the user environment is enabled. GitHub Copilot spans still add per-project attributes such as repository, branch, and commit when the workspace is inside a Git repository. The jobs container replays recent traces across all observed workspaces and writes materialized session records to Loki for local debugging.

## Scheduled jobs

The `copilot-otel-jobs` container replaces the earlier host-side schedulers for materialization and rollups. It runs on macOS, Linux, and Windows through Docker:

- `materialize-copilot-sessions.sh` every 5 minutes
- `daily-rollup.sh` daily

The `copilot-otel-registry` sidecar re-seeds model prices and multipliers every 5 minutes so registry metrics do not expire from the collector.

### Optional macOS LaunchAgents

LaunchAgents are macOS-only optional host-side automation for signals that must run on the host, outside Docker. `install-launchagents.sh` refuses to run on non-macOS systems. On Linux and Windows the stack and jobs container need no host scheduler; use cron or Task Scheduler only if you want the optional host-side ingestion scripts on a schedule.

Install from the versioned templates:

```bash
local-otel/install-launchagents.sh
```

Remove the scheduled automation while preserving copied plist files:

```bash
local-otel/uninstall-launchagents.sh
```

Remove the copied plist files too:

```bash
local-otel/uninstall-launchagents.sh --delete
```

The LaunchAgents cover user environment setup, the OTel coverage audit every hour, GitHub Enterprise ingestion every hour, organization status ingestion every hour, workspace registration every five minutes, VS Code process memory sampling every minute, and GitHub Enterprise audit stream renewal. The templates use a path placeholder, so the repository can live at any location. They do not contain secrets. Runtime logs and state are ignored by git.

The materializer, rollup, and model price LaunchAgents no longer exist. The jobs and registry containers replaced them.

The scheduled jobs keep dashboard support data fresh. They cannot create events that have not happened, so rare GitHub Copilot signals can still appear as `not_observed_yet`, but the coverage and data-quality dashboards refresh continuously while the local stack is running.

## Model labels, tokens, AIU, and AI Credits

Frontier Cockpit Local separates three different cost signals so they are never confused:

- **Tokens by model** are real telemetry. Inspect them in the Sessions and Model Labels dashboard. Model labels are telemetry labels, not official billing model names.
- **AIU** is real. GitHub Copilot emits `copilot_chat.copilot_usage_nano_aiu` per session, materialized as `copilot_real_session_nano_aiu` and shown as real AIU in the Context and Cost dashboard. AIU equals `nano_aiu / 1e9`.
- **AI Credits** are the current GitHub Copilot usage-based billing unit. Current GitHub documentation states that GitHub Copilot usage consumes input, output, and cached tokens, priced by model and converted into AI Credits, where 1 AI Credit equals US$0.01. Local AIU and token telemetry are operational estimates, not official billing.

Legacy request-based billing scripts remain in the repository only for historical analysis. They are not used by the current mini app. The current cockpit uses AI Credits, token classes, model labels, cache behavior, and local model price assumptions where available.

### AI Credits and USD in the dashboard

The Sessions and Model Labels dashboard shows both signals directly:

- **Real AIU consumed (AI credits)** is a stat panel backed by `copilot_real_session_nano_aiu_ratio / 1e9`. This is the real AI-Units-equivalent reported by GitHub Copilot for workspace sessions.
- **Estimated local spend by model (USD what-if)** is a table that multiplies token counts by local planning prices.

Seed the local planning prices manually if needed. The registry sidecar re-seeds them automatically every five minutes while the stack is running:

```bash
local-otel/seed-model-prices.sh
```

The prices in `seed-model-prices.sh` are **local planning assumptions** (`price_source=local-planning-assumption`), not official billing and not provider-confirmed for these telemetry labels. Edit that file with your own source-of-truth prices, or override one model:

```bash
local-otel/register-model-price.sh gpt-4o-mini-2024-07-18 0.15 0.60
```

Official spend and AI Credits always require GitHub billing exports or the GitHub Copilot usage metrics reports API.

The `daily-rollup.sh` job also updates DuckDB when available:

- `frontier-local-insights.sh` writes derived workspace rollups to `local-otel/frontier-insights.duckdb`.
- `export-otel-duckdb.sh` writes recent OTel export snapshots to `local-otel/frontier-otel-export.duckdb`, including Agent Host spans from the local SQLite exporter at `~/Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat/agent-traces.db` when present on macOS.

Both files are local runtime state and ignored by git.

## GitHub Enterprise and organization ingestion

Optional host-side ingestion scripts enrich the local dashboards with GitHub API data:

- `local-otel/ingest-github-enterprise.sh` collects the enterprise audit log when permitted and the GitHub Copilot usage metrics report through the GA reports API (`/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day`). The legacy GitHub Copilot metrics API was sunset on 2026-04-02 and is no longer used. Signals that are not available emit an availability status instead of failing.
- `local-otel/ingest-github-orgs.sh` collects organization status signals.
- `local-otel/configure-github-audit-stream.sh` configures or renews GitHub Enterprise audit log streaming to Azure Blob Storage. It is cross-platform: it supports both GNU and BSD `date`, and clipboard integration is optional.

## Workspace tags

GitHub Copilot Chat spans include repository tags when VS Code is open in a Git repository:

- `github.copilot.git.repository`
- `github.copilot.git.branch`
- `github.copilot.git.commit_sha`
- `github.copilot.github.org`, for GitHub remotes

Terminal-launched dev tools and agents also receive dynamic resource attributes from `local-otel/workspace-tags.zsh`:

- `workspace.name`
- `workspace.kind`, either `git` or `directory`
- `workspace.path_hash`
- `git.branch`
- `git.repository.owner`
- `git.repository.name`
- `github.copilot.git.repository`, when a Git remote exists
- `github.copilot.git.branch`, when a branch exists

Use these attributes to filter traces by project in Aspire Dashboard, Application Insights, Grafana, Jaeger, Tempo, or any OTLP backend.

## Security note

Content capture is off by default everywhere. Set `FRONTIER_ENABLE_CONTENT_CAPTURE=true` only for trusted local workshops or explicitly approved demos, because captured content can include prompts, source code, file paths, tool inputs, and tool results. Set it back to `false` afterwards, and never enable it against sensitive customer repositories without explicit approval.

Frontier Cockpit Local telemetry is operational telemetry. It is useful for coaching, debugging, context analysis, and cost-awareness education. Official billing, AI Credits, and adoption reporting require GitHub billing exports, usage metrics, or another approved source.

Access controls:

- All published container ports bind to `127.0.0.1`. Nothing is exposed to the network.
- Grafana requires login. The user is `admin` and the password is generated on first stack start into `local-otel/stack/grafana-admin.env`, which is gitignored. Anonymous access is disabled and there is no default `admin/admin` credential.
- Aspire Dashboard keeps anonymous browser access for local convenience, but it is loopback-only. Do not expose port `18888` publicly. OTLP and Dashboard API ingestion use the generated API key in `local-otel/stack/aspire-api-key.env`.

## Start local backends

Docker Desktop (or a compatible Docker engine on Linux) must be running.

Cross-platform client setup, recommended for customer machines:

macOS or Linux:

```bash
cp local-otel/client.env.example local-otel/client.env
# Edit local-otel/client.env with the participant, customer, plan, and seat values.
bash local-otel/client-bootstrap.sh
```

Windows PowerShell:

```powershell
Copy-Item local-otel/client.env.example local-otel/client.env
# Edit local-otel/client.env with the participant, customer, plan, and seat values.
pwsh -ExecutionPolicy Bypass -File local-otel/client-bootstrap.ps1
```

The bootstrap starts the local Docker Compose stack, updates VS Code and VS Code Insiders user settings, persists `OTEL_*` and `COPILOT_OTEL_*` environment variables for terminal-launched GitHub Copilot CLI and GitHub Copilot SDK workloads, registers the current Git workspace when available, sends validation telemetry, and checks the local endpoints. Restart VS Code after the bootstrap so GitHub Copilot Chat and agent hosts pick up the new settings.

Workshop-ready local setup, run from the participant Git repository:

```bash
local-otel/workshop-ready.sh
```

This command is local-only. It does not enable hybrid mode or forward data to Azure. It enables the local OpenTelemetry environment, starts the full Docker stack, registers the current Git workspace, sends a synthetic validation span, materializes recent GitHub Copilot sessions, refreshes support metrics, and runs the workshop validation gate.

Open the local mini app after setup:

```bash
open http://localhost:3300
```

If the mini app has no workspace-attributed sessions yet, open the repository in VS Code Insiders, run one GitHub Copilot Chat or agent request, then rerun `workshop-ready.sh` or click Refresh after the jobs container materializes the session.

Full local stack, live view plus local history:

```bash
local-otel/start-full-stack.sh
```

On first start the script generates the Grafana admin password into `local-otel/stack/grafana-admin.env` and the Aspire API key into `local-otel/stack/aspire-api-key.env`. Both files are gitignored.

Frontier Cockpit Hybrid, local history plus Azure forwarding:

```bash
local-otel/azure/deploy.sh
local-otel/start-full-stack.sh --hybrid
```

The Azure deploy script creates `rg-agentobs-dev-eus-001` in East US with Bicep and writes `local-otel/azure/.env` for local forwarding.

Open the live trace dashboard:

```bash
open http://localhost:18888
```

Open local Grafana and sign in as `admin` with the password from `local-otel/stack/grafana-admin.env`:

```bash
open http://localhost:3000
```

The OTLP HTTP endpoint is available at:

```text
http://localhost:4318
```

The OTLP/gRPC endpoint is available at:

```text
http://localhost:4317
```

For an SDK or app that specifically requires gRPC, run this in that shell before starting the app:

```bash
source local-otel/use-otlp-grpc.zsh
```

## Validate

Use the workshop validation gate:

```bash
local-otel/check-workshop-local.sh
```

After the participant has generated one real GitHub Copilot Chat or agent session in the repository, use strict data mode:

```bash
local-otel/check-workshop-local.sh --strict-data
```

Expected result:

- The Aspire Dashboard, OpenTelemetry Collector, Tempo, Prometheus, Loki, Grafana, registry, jobs, dashboard API, and dashboard web containers are running.
- `http://localhost:3300` responds for the Frontier Cockpit Local mini app.
- `http://localhost:18888` responds for Aspire.
- `http://localhost:3000` responds for Grafana.
- `http://localhost:9090`, `http://localhost:3200`, and `http://localhost:3100` respond for Prometheus, Tempo, and Loki.
- `http://localhost:4318/v1/traces` exists for OTLP HTTP ingestion.
- `localhost:4317` is reachable for OTLP/gRPC.
- VS Code user settings point to `http://localhost:4318`.
- VS Code agent host OTel settings are enabled.
- Integrated terminal OTel variables are present.

Send a synthetic validation span before a demo:

```bash
local-otel/send-test-span.sh
```

In Aspire Dashboard, filter by service `copilot-otel-local-test` to confirm the collector is ingesting data.

In local Grafana, use Explore with the Tempo datasource and search for service `copilot-otel-local-test` to confirm trace history.

## Generate a trace

After starting the stack, restart VS Code or reload the window. Then run any GitHub Copilot Chat agent interaction, for example asking the agent to list files or explain a small function.

In Aspire Dashboard:

1. Open `http://localhost:18888`.
2. Go to **Traces**.
3. Filter service by `copilot-chat`.
4. Look for spans named `invoke_agent`, `chat`, `execute_tool`, and `execute_hook`.
5. Open a trace detail. In the current Aspire Dashboard, use the GenAI telemetry visualizer from the trace/span detail to inspect prompts, responses, and tool calls when content capture is enabled.
6. Open another workspace or repository and repeat. The same user-level configuration applies, while repository attributes identify the active project when available.

Aspire is the best local live viewer for trace trees, span attributes, and the GenAI conversation visualizer. Grafana is the best local historical dashboard for trends, workspace filtering, context window usage, AIU, and VS Code process memory.

## Coverage audit

Run the local coverage audit against the GitHub Copilot OTel reference:

```bash
local-otel/audit-coverage.sh
```

Open the coverage dashboard:

```bash
open http://localhost:3000/d/copilot-otel-coverage-local/github-copilot-otel-coverage-local
```

The audit emits metadata only. It does not fabricate usage. Signals marked `not_observed_yet` are expected when the matching behavior has not happened locally, for example MCP tools, cloud sessions, PR-ready notifications, user feedback, cache creation, or compaction events.

## Context, cost, and memory

Open the real workspace context dashboard:

```bash
open http://localhost:3000/d/copilot-context-cost-local/github-copilot-context-and-cost-local
```

This dashboard uses real local `copilot-chat` traces with repository attribution and shows:

- context window utilization from `copilot_chat.request.max_prompt_tokens` and `gen_ai.usage.input_tokens`;
- hot/warm/cold context from cache-read, cache-creation, and uncached input tokens;
- real AIU from `copilot_chat.copilot_usage_nano_aiu`;
- model labels emitted by telemetry, not friendly billing model names.

Open VS Code OS memory metrics:

```bash
open http://localhost:3000/d/vscode-process-memory-local/vs-code-process-memory-local
```

This measures OS process memory for VS Code/Electron, sampled by the optional macOS LaunchAgent. It is not model context memory.

## Useful commands

Stop the full stack while keeping local history:

```bash
local-otel/stop-full-stack.sh
```

Delete all local history volumes, destructive:

```bash
local-otel/stop-full-stack.sh --reset
```

Restart the stack:

```bash
local-otel/stop-full-stack.sh
local-otel/start-full-stack.sh
```

Register the current Git workspace:

```bash
local-otel/register-workspace.sh
```

Export recent OTel snapshots to DuckDB:

```bash
local-otel/export-otel-duckdb.sh
```

Validate Azure Bicep without deploying:

```bash
local-otel/azure/validate.sh
```

Deploy Frontier Cockpit Hybrid Azure resources:

```bash
local-otel/azure/deploy.sh
```

Delete the Azure resource group and stop Azure cost:

```bash
local-otel/azure/destroy.sh
```

Apply the user environment now:

```bash
local-otel/enable-user-env.sh
```

Send a test span:

```bash
local-otel/send-test-span.sh
```

Remove the user environment from macOS launchd:

```bash
local-otel/disable-user-env.sh
```

Export the local VS Code span database:

1. Open Command Palette in VS Code Insiders.
2. Run **Chat: Export Agent Traces DB**.
3. Save the `.db` file in a customer-approved location.

## Customer demo flow

1. Explain that OTel is off by default and user-controlled, and that content capture is a separate explicit opt-in.
2. Start the full local stack for the live trace tree.
3. Show VS Code user settings for `github.copilot.chat.otel`.
4. Run one GitHub Copilot Chat agent request.
5. Open Aspire traces and inspect the span tree.
6. Highlight token usage, tool spans, errors, model attributes, repository attributes, and resource attributes.
7. Switch to local Grafana to show historical traces in Tempo and the provisioned dashboards, persisted through Grafana's embedded SQLite storage.
8. Explain Frontier Cockpit Hybrid: the same local Collector can forward to the Azure Collector in Container Apps, which exports to Application Insights and Azure Managed Grafana.

## What is persisted

- Aspire Dashboard: live, in-memory diagnostic view.
- Tempo: local trace history, 30 days.
- Prometheus: local metric history, 30 days.
- Loki: local log history, 30 days.
- Grafana: dashboards, datasources, users, and preferences in the embedded SQLite database inside the `grafana-data` volume.
- Jobs container: materializer state in the `jobs-state` volume.
- Azure: Application Insights and Log Analytics hold sanitized telemetry and rollups after Frontier Cockpit Hybrid forwarding is enabled. Raw local content is not batch-sent when the 30-day local retention expires.

## Architecture outputs

- Draw.io source: `local-otel/azure/diagram/output/agentobs-hybrid-architecture.drawio`
- SVG preview: `local-otel/azure/diagram/output/agentobs-hybrid-architecture.svg`

## References

- [OpenTelemetry GenAI Semantic Conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Azure Managed Grafana and Application Insights for GitHub Copilot monitoring](https://learn.microsoft.com/azure/managed-grafana/grafana-opentelemetry-app-insights#github-copilot)
