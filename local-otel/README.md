---
title: "Frontier Developer Cockpit Local OpenTelemetry Kit"
description: "User-level local OpenTelemetry runtime for Frontier Developer Cockpit, including Aspire, Grafana, Prometheus, Tempo, Loki, local materialization, and Azure hybrid forwarding."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.0.5"
status: "approved"
tags: ["frontier-developer-cockpit", "github-copilot", "opentelemetry", "aspire", "grafana", "local-runtime"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Developer Cockpit Local OpenTelemetry Kit

This user-level kit configures the local runtime for Frontier Developer Cockpit. It captures GitHub Copilot Chat and agent telemetry in VS Code or VS Code Insiders, routes it through a local OpenTelemetry Collector, and fans out to Aspire Dashboard, Tempo, Prometheus, Loki, Grafana, and optional Azure hybrid forwarding.

## Change Log

| Version | Date | Author | Changes |
| --- | --- | --- | --- |
| 1.0.5 | 2026-07-02 | Frontier Cockpit Team | Added cross-platform client bootstrap scripts for macOS, Linux, and Windows. |
| 1.0.4 | 2026-06-30 | Frontier Cockpit Team | Added the local workshop-ready flow, the workshop validation gate, and the Frontier Developer Cockpit mini app entry point. |
| 1.0.3 | 2026-06-23 | Frontier Cockpit Team | Enabled full local content materialization by default and increased trace replay coverage across workspaces. |
| 1.0.2 | 2026-06-23 | Frontier Cockpit Team | Standardized local Tempo, Prometheus, and Loki retention to 30 days and clarified the Docker and Azure sync boundary. |
| 1.0.1 | 2026-06-22 | Frontier Cockpit Team | Aligned title, frontmatter, and settings with the Frontier Developer Cockpit offer. |
| 1.0.0 | 2026-06-17 | Frontier Cockpit Team | Initial local OpenTelemetry kit. |

The cross-platform client bootstrap supports macOS, Linux, and Windows. It applies VS Code or VS Code Insiders GitHub Copilot OpenTelemetry settings, exports standard OTel environment variables for terminal-launched dev agents and tools that honor OTLP, starts the Docker Compose stack, registers the current workspace, and sends a synthetic validation span. Older macOS helper scripts remain available for local automation and LaunchAgent scheduling.

The kit has three run modes:

- Aspire-only: lightweight live view for quick inspection.
- Full local stack: OpenTelemetry Collector + Aspire + Tempo + Prometheus + Loki + Grafana + PostgreSQL, with local history.
- Hybrid Azure: full local stack plus forwarding to an Azure Container Apps Collector, Application Insights, Log Analytics, Azure Monitor workspace, and Azure Managed Grafana.

The full local stack runs in Docker and keeps trace, metric, and log history locally for 30 days. Hybrid Azure mode does not wait for local retention to expire. It forwards sanitized telemetry while the stack is running, and the scheduled rollup jobs keep the Azure view refreshed with approved summary signals.

Default local endpoints:

- Frontier Developer Cockpit mini app: `http://localhost:3300`
- Aspire UI: `http://localhost:18888`
- Grafana local UI: `http://localhost:3000`
- Prometheus UI: `http://localhost:9090`
- Tempo API: `http://localhost:3200`
- Loki API: `http://localhost:3100`
- OTLP/gRPC ingest: `http://localhost:4317`
- OTLP/HTTP ingest: `http://localhost:4318`

GitHub Copilot Chat uses OTLP/HTTP on `4318`. Dev apps or SDKs that require gRPC can use `4317`.

## What is configured

VS Code and VS Code Insiders user settings are configured with:

- `github.copilot.chat.otel.enabled`: `true`
- `github.copilot.chat.otel.exporterType`: `otlp-http`
- `github.copilot.chat.otel.otlpEndpoint`: `http://localhost:4318`
- `github.copilot.chat.otel.captureContent`: `true`
- `github.copilot.chat.otel.maxAttributeSizeChars`: `0`
- `github.copilot.chat.otel.dbSpanExporter.enabled`: `true`

Local materialization is also enabled for full-fidelity content records:

- `COPILOT_MATERIALIZE_CONTENT=true`
- `COPILOT_MATERIALIZE_TRACE_LIMIT=1000`

Local DuckDB analytical files are also supported:

- `frontier-insights.duckdb` stores derived developer rollups.
- `frontier-otel-export.duckdb` stores local OTel export snapshots from Prometheus, Loki, Tempo, and the VS Code Agent Host SQLite span database when available.
- DuckDB complements Tempo, Prometheus, Loki, and Grafana. It does not replace those backends.

The integrated terminal user environment also receives OTel variables so terminal sessions can inherit the local endpoint.

Terminal-launched apps get these Aspire defaults:

- `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`
- `OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:4318/v1/traces`
- `OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:4318/v1/metrics`
- `OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:4318/v1/logs`

The cross-platform client bootstrap is configured through:

- `local-otel/client.env.example`
- `local-otel/client.env`, local-only and gitignored
- `local-otel/client-bootstrap.sh`, for macOS and Linux
- `local-otel/client-bootstrap.ps1`, for Windows PowerShell

The legacy shell and macOS user environment scripts are still available through:

- `$HOME/frontier-cockpit/local-otel/env.zsh`
- `$HOME/frontier-cockpit/local-otel/enable-user-env.sh`
- `$HOME/frontier-cockpit/local-otel/launchagents/`
- `$HOME/frontier-cockpit/local-otel/install-launchagents.sh`
- `~/Library/LaunchAgents/com.frontier.copilot-otel-*.plist`

This covers new terminal sessions, integrated terminals, and GUI apps launched after the user environment is enabled. GitHub Copilot spans still add per-project attributes such as repository, branch, and commit when the workspace is inside a Git repository. The materializer replays recent traces across all observed workspaces and writes full local content records to Loki for local debugging.

Install the scheduled user automation from the versioned templates:

```bash
$HOME/frontier-cockpit/local-otel/install-launchagents.sh
```

Remove the scheduled automation while preserving copied plist files:

```bash
$HOME/frontier-cockpit/local-otel/uninstall-launchagents.sh
```

Remove the copied plist files too:

```bash
$HOME/frontier-cockpit/local-otel/uninstall-launchagents.sh --delete
```

The LaunchAgents cover user environment setup, stack autostart, OTel coverage audit every hour, session materialization every five minutes, VS Code process memory sampling every minute, 24-hour workspace rollup refresh every hour, GitHub Enterprise ingestion every hour, organization status ingestion every hour, model price registry refresh every five minutes, and audit stream renewal. They do not contain secrets. Runtime logs and state are ignored by git.

The hourly jobs keep dashboard support data fresh. They cannot create events that have not happened, so rare GitHub Copilot signals can still appear as `not_observed_yet`, but the coverage and data-quality dashboards should refresh at least hourly while the local stack is running.

## Model labels, tokens, AIU, and AI Credits

Frontier Developer Cockpit separates three different cost signals so they are never confused:

- **Tokens by model** are real telemetry. Inspect them in the Sessions and Model Labels dashboard. Model labels are telemetry labels, not official billing model names.
- **AIU** is real. GitHub Copilot emits `copilot_chat.copilot_usage_nano_aiu` per session, materialized as `copilot_real_session_nano_aiu` and shown as real AIU in the Context and Cost dashboard. AIU equals `nano_aiu / 1e9`.
- **AI Credits** are the current GitHub Copilot usage-based billing unit. Current GitHub documentation states that Copilot usage consumes input, output, and cached tokens, priced by model and converted into AI Credits, where 1 AI Credit equals US$0.01. Local AIU and token telemetry are operational estimates, not official billing.

Legacy request-based billing scripts remain in the repository only for historical analysis. They are not used by the current mini app. The current cockpit uses AI Credits, token classes, model labels, cache behavior, and local model price assumptions where available.

### AI Credits and USD in the dashboard

The Sessions and Model Labels dashboard now shows both signals directly:

- **Real AIU consumed (AI credits)** is a stat panel backed by `copilot_real_session_nano_aiu_ratio / 1e9`. This is the real AI-Units-equivalent reported by GitHub Copilot for workspace sessions.
- **Estimated local spend by model (USD what-if)** is a table that multiplies token counts by local planning prices.

Seed the local planning prices, then they persist through the price LaunchAgent:

```bash
$HOME/frontier-cockpit/local-otel/seed-model-prices.sh
```

The prices in `seed-model-prices.sh` are **local planning assumptions** (`price_source=local-planning-assumption`), not official billing and not provider-confirmed for these telemetry labels. Edit that file with your own source-of-truth prices, or override one model:

```bash
$HOME/frontier-cockpit/local-otel/register-model-price.sh gpt-4o-mini-2024-07-18 0.15 0.60
```

The `com.frontier.copilot-otel-price-registry` LaunchAgent re-seeds prices every five minutes for the same collector-expiry reason. Official spend and AI Credits always require GitHub billing exports or the Copilot usage metrics API.

The `daily-rollup.sh` job also updates DuckDB when available:

- `frontier-local-insights.sh` writes derived workspace rollups to `local-otel/frontier-insights.duckdb`.
- `export-otel-duckdb.sh` writes recent OTel export snapshots to `local-otel/frontier-otel-export.duckdb`, including Agent Host spans from the local SQLite exporter at `~/Library/Application Support/Code - Insiders/User/globalStorage/github.copilot-chat/agent-traces.db` when present.

Both files are local runtime state and ignored by git.

## Workspace tags

GitHub Copilot Chat spans include repository tags when VS Code is open in a Git repository:

- `github.copilot.git.repository`
- `github.copilot.git.branch`
- `github.copilot.git.commit_sha`
- `github.copilot.github.org`, for GitHub remotes

Terminal-launched dev tools and agents also receive dynamic resource attributes from `$HOME/frontier-cockpit/local-otel/workspace-tags.zsh`:

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

Content capture is enabled for teaching and local validation. It can include prompts, source code, file paths, tool inputs, and tool results. Keep this local for trusted sessions, and disable content capture before using this with sensitive customer repositories unless the customer explicitly approves it.

Frontier Developer Cockpit telemetry is operational telemetry. It is useful for coaching, debugging, context analysis, and cost-awareness education. Official billing, AI Credits, and adoption reporting require GitHub billing exports, usage metrics, or another approved source.

Aspire Dashboard runs with anonymous browser access for local convenience and is bound to localhost only. Do not expose port `18888` publicly. OTLP and Dashboard API ingestion still use the local API key configured in `local-otel/stack/aspire-api-key.env` when the full stack is running.

## Client Runtime Setup

Docker Desktop must be running.

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

The bootstrap starts the local Docker Compose stack, updates VS Code and VS Code Insiders user settings, persists `OTEL_*` and `COPILOT_OTEL_*` environment variables for terminal-launched GitHub Copilot CLI and Copilot SDK workloads, registers the current Git workspace when available, sends validation telemetry, and checks the local endpoints. Restart VS Code after the bootstrap so GitHub Copilot Chat and agent hosts pick up the new settings.

Optional workshop setup, run from the participant Git repository only when following the hands-on labs:

```bash
$HOME/frontier-cockpit/local-otel/workshop-ready.sh
```

This command is local-only. It does not enable hybrid mode or forward data to Azure. It enables the local OpenTelemetry environment, starts the full Docker Desktop stack, registers the current Git workspace, sends a synthetic validation span, materializes recent GitHub Copilot sessions, refreshes support metrics, and runs the workshop validation gate.

Open the local mini app after setup:

```bash
open http://localhost:3300
```

If the mini app has no workspace-attributed sessions yet, open the repository in VS Code or VS Code Insiders, run one GitHub Copilot Chat or agent request, then rerun the client bootstrap or click Refresh after the local materializer runs.

Aspire-only, lightweight live inspection:

```bash
$HOME/frontier-cockpit/local-otel/enable-user-env.sh
$HOME/frontier-cockpit/local-otel/start-aspire-dashboard.sh
```

Full local stack, live view plus local history:

```bash
$HOME/frontier-cockpit/local-otel/enable-user-env.sh
$HOME/frontier-cockpit/local-otel/start-full-stack.sh
```

Hybrid Azure mode, local history plus Azure forwarding:

```bash
$HOME/frontier-cockpit/local-otel/azure/deploy.sh
$HOME/frontier-cockpit/local-otel/start-full-stack.sh --hybrid
```

The Azure deploy script creates or updates the configured resource group with Bicep and writes `$HOME/frontier-cockpit/local-otel/azure/.env` for local forwarding.

Open the dashboard:

```bash
open http://localhost:18888
```

Open local Grafana:

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
source $HOME/frontier-cockpit/local-otel/use-otlp-grpc.zsh
```

## Validate

```bash
$HOME/frontier-cockpit/local-otel/check-otel-local.sh
```

For workshop participants, use the focused gate:

```bash
$HOME/frontier-cockpit/local-otel/check-workshop-local.sh
```

After the participant has generated one real GitHub Copilot Chat or agent session in the repository, use strict data mode:

```bash
$HOME/frontier-cockpit/local-otel/check-workshop-local.sh --strict-data
```

Expected result:

- Aspire Dashboard container is running.
- In full-stack mode, the OpenTelemetry Collector, Tempo, Prometheus, Loki, Grafana, and PostgreSQL containers are running.
- `http://localhost:18888` responds.
- `http://localhost:3000` responds for Grafana in full-stack mode.
- `http://localhost:9090`, `http://localhost:3200`, and `http://localhost:3100` respond for Prometheus, Tempo, and Loki in full-stack mode.
- `http://localhost:4318/v1/traces` exists for OTLP HTTP ingestion.
- `localhost:4317` is reachable for OTLP/gRPC.
- VS Code Insiders user settings point to `http://localhost:4318`.
- VS Code agent host OTel settings are enabled.
- Integrated terminal OTel variables are present.
- macOS launchd user environment OTel variables are present.

Send a synthetic validation span when checking the pipeline:

```bash
$HOME/frontier-cockpit/local-otel/send-test-span.sh
```

In Aspire Dashboard, filter by service `copilot-otel-local-test` to confirm the collector is ingesting data.

In local Grafana, use Explore with the Tempo datasource and search for service `copilot-otel-local-test` to confirm trace history.

## Generate a trace

After starting the dashboard, restart VS Code Insiders or reload the window. Then run any GitHub Copilot Chat agent interaction, for example asking the agent to list files or explain a small function.

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
$HOME/frontier-cockpit/local-otel/audit-coverage.sh
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

This measures macOS process memory for VS Code/Electron. It is not model context memory.

## Useful commands

Stop the dashboard:

```bash
$HOME/frontier-cockpit/local-otel/stop-aspire-dashboard.sh
```

Stop the full stack while keeping local history:

```bash
$HOME/frontier-cockpit/local-otel/stop-full-stack.sh
```

Delete all local history volumes, destructive:

```bash
$HOME/frontier-cockpit/local-otel/stop-full-stack.sh --reset
```

Validate Azure Bicep without deploying:

```bash
$HOME/frontier-cockpit/local-otel/azure/validate.sh
```

Deploy Azure hybrid resources:

```bash
$HOME/frontier-cockpit/local-otel/azure/deploy.sh
```

Delete the Azure resource group and stop Azure cost:

```bash
$HOME/frontier-cockpit/local-otel/azure/destroy.sh
```

Apply the user environment now:

```bash
$HOME/frontier-cockpit/local-otel/enable-user-env.sh
```

Send a test span:

```bash
$HOME/frontier-cockpit/local-otel/send-test-span.sh
```

Remove the user environment from macOS launchd:

```bash
$HOME/frontier-cockpit/local-otel/disable-user-env.sh
```

Restart it:

```bash
$HOME/frontier-cockpit/local-otel/stop-aspire-dashboard.sh
$HOME/frontier-cockpit/local-otel/start-aspire-dashboard.sh
```

Export the local VS Code span database:

1. Open Command Palette in VS Code Insiders.
2. Run **Chat: Export Agent Traces DB**.
3. Save the `.db` file in a customer-approved location.

## Client Validation Walkthrough

1. Confirm Docker Desktop is running.
2. Run the client bootstrap and restart VS Code or VS Code Insiders.
3. Confirm VS Code settings for `github.copilot.chat.otel` point to `http://localhost:4318`.
4. Run one GitHub Copilot Chat or agent request in a Git repository.
5. Open Aspire traces and inspect the span tree.
6. Open the local mini app and confirm sessions, tokens, AI Credits estimates, cache, and workspace attribution appear.
7. Open Grafana local to review historical traces in Tempo and persisted dashboards through PostgreSQL.
8. If Azure hybrid mode is approved, confirm that sanitized telemetry also reaches the client-owned Azure Collector and Azure Managed Grafana.

## What is persisted

- Aspire Dashboard: live, in-memory diagnostic view.
- Tempo: local trace history, 30 days.
- Prometheus: local metric history, 30 days.
- Loki: local log history, 30 days.
- PostgreSQL: Grafana metadata, dashboards, datasources, users, and preferences.
- Azure: Application Insights and Log Analytics hold sanitized telemetry and rollups after hybrid forwarding is enabled. Raw local content is not batch-sent when the 30-day local retention expires.

## Architecture outputs

- Draw.io source: `$HOME/frontier-cockpit/local-otel/azure/diagram/output/agentobs-hybrid-architecture.drawio`
- SVG preview: `$HOME/frontier-cockpit/local-otel/azure/diagram/output/agentobs-hybrid-architecture.svg`

## References

- [OpenTelemetry GenAI Semantic Conventions](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/)
- [Aspire Dashboard standalone](https://aspire.dev/dashboard/standalone/)
- [Azure Managed Grafana and Application Insights for GitHub Copilot monitoring](https://learn.microsoft.com/azure/managed-grafana/grafana-opentelemetry-app-insights#github-copilot)
