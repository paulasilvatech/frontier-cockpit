---
title: "Frontier Developer Cockpit"
description: "Client-ready local GitHub Copilot observability cockpit with OpenTelemetry, Aspire, Prometheus, Grafana, Tempo, Loki, and a local dashboard."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["frontier-developer-cockpit", "github-copilot", "opentelemetry", "docker", "grafana", "aspire"]
---

<!-- markdownlint-disable MD025 -->

# Frontier Developer Cockpit

Frontier Developer Cockpit is a client-run observability cockpit for GitHub Copilot Chat and agent activity. The default mode is fully local: it configures VS Code or VS Code Insiders to send GitHub Copilot OpenTelemetry signals to a local Docker stack, then shows local traces, metrics, model labels, token behavior, AIU, AI Credits estimates, cache behavior, workspace attribution, and developer coaching. An optional Azure hybrid mode can forward sanitized telemetry to client-owned Azure resources when enterprise history or Azure Managed Grafana is required.

This repository is prepared for client installation. The committed defaults are generic, no customer or personal data is required, and local secret/configuration files are ignored by git.

## What You Get

| Component | Purpose |
| --- | --- |
| OpenTelemetry Collector | Local OTLP HTTP/gRPC ingest endpoint for GitHub Copilot and local tools. |
| Aspire Dashboard | Live trace, span, log, metric, and GenAI inspection surface. |
| Prometheus | Local metrics store for the dashboard and Grafana. |
| Tempo | Local trace history backend. |
| Loki | Local logs and content-capture metadata backend. |
| Grafana OSS | Historical dashboards and local exploration. |
| Frontier dashboard | Local mini app at `http://localhost:3300` for the client-facing cockpit. |

## Run Modes

| Mode | Use When | Data Boundary |
| --- | --- | --- |
| Local-only | A developer or workshop participant needs a private cockpit on their machine. | All raw telemetry and dashboard state stay local. |
| Optional Azure hybrid | Platform, FinOps, or leadership teams need governed history and shared enterprise dashboards. | Local Collector forwards sanitized telemetry to client-owned Azure resources. Raw prompts and oversized sensitive attributes must stay local unless the client explicitly approves otherwise. |

Start with local-only mode for every client. Enable Azure hybrid only after the client has approved Azure subscription, identity, networking, retention, and data-boundary decisions.

Default endpoints:

| Service | URL |
| --- | --- |
| Frontier dashboard | `http://localhost:3300` |
| Grafana | `http://localhost:3000` |
| Aspire Dashboard | `http://localhost:18888` |
| Prometheus | `http://localhost:9090` |
| Tempo | `http://localhost:3200` |
| Loki | `http://localhost:3100` |
| OTLP HTTP | `http://localhost:4318` |
| OTLP gRPC | `http://localhost:4317` |

## Platform Support

| Platform | Supported path | Entry point |
| --- | --- | --- |
| macOS | Docker Desktop plus optional scheduled automation. | `bash local-otel/client-bootstrap.sh` |
| Linux | Docker Desktop or Docker Engine with Compose. | `bash local-otel/client-bootstrap.sh` |
| Windows | Docker Desktop with WSL2 backend, run from PowerShell. | `pwsh -ExecutionPolicy Bypass -File local-otel/client-bootstrap.ps1` |

Scheduled automation under `local-otel/launchagents/` is macOS-only and optional. Linux users can schedule equivalent scripts with `cron` or systemd timers. Windows users can use Task Scheduler when scheduled refresh is needed. The Docker stack itself does not depend on scheduled automation.

## Prerequisites

- Docker Desktop, or Docker Engine with Docker Compose on Linux.
- Git.
- VS Code or VS Code Insiders with GitHub Copilot enabled.
- Python 3, used by the bootstrap and local validation scripts.
- PowerShell 7 on Windows.

Optional Azure hybrid prerequisites:

- Azure CLI authenticated to the client subscription.
- Permission to deploy Bicep at subscription scope and create a resource group.
- Client-approved Azure location, naming values, and resource group.
- Managed identity and least-privilege access for Azure-hosted components.
- Secret handling for `AZURE_OTLP_TOKEN`; never commit the generated `.env` file.

## Quick Start

1. Clone the repository.

   ```bash
   git clone https://github.com/your-org/frontier-cockpit.git
   cd frontier-cockpit
   ```

2. Create the local client configuration. This file is ignored by git.

   macOS or Linux:

   ```bash
   cp local-otel/client.env.example local-otel/client.env
   ```

   Windows PowerShell:

   ```powershell
   Copy-Item local-otel/client.env.example local-otel/client.env
   ```

3. Edit `local-otel/client.env` for the client environment.

   | Setting | What to customize |
   | --- | --- |
   | `FRONTIER_PARTICIPANT_NAME` | Name shown in the local dashboard. |
   | `FRONTIER_PARTICIPANT_ROLE` | Role shown in the local dashboard. |
   | `FRONTIER_PARTICIPANT_TEAM` | Team label added to local resource attributes. |
   | `FRONTIER_CUSTOMER_NAME` | Customer or organization label. |
   | `FRONTIER_DASHBOARD_TITLE` | Dashboard title. |
   | `FRONTIER_COPILOT_PLAN` | `business` or `enterprise` for local AI Credits planning. |
   | `FRONTIER_COPILOT_SEATS` | Seat count used for local planning. |
   | `FRONTIER_AI_CREDITS_USE_PROMO` | `true` only if the client wants to model a promotional credit pool. |
   | `FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE` | Optional override for the monthly local credit pool. |
   | `FRONTIER_VSCODE_CHANNELS` | `stable`, `insiders`, or `stable,insiders`. |
   | `FRONTIER_ENABLE_CONTENT_CAPTURE` | `true` for trusted local workshops, `false` for stricter privacy. |

4. Start the local cockpit. The bootstrap configures OpenTelemetry first, then starts Docker Compose.

   macOS or Linux:

   ```bash
   bash local-otel/client-bootstrap.sh
   ```

   Windows PowerShell:

   ```powershell
   pwsh -ExecutionPolicy Bypass -File local-otel/client-bootstrap.ps1
   ```

5. Restart VS Code or reload the VS Code window so GitHub Copilot picks up the OpenTelemetry settings.

6. Open the local dashboard.

   ```text
   http://localhost:3300
   ```

At this point the local-only cockpit is ready. The Azure hybrid section below is optional and should be skipped for local-only workshops.

## Optional Azure Hybrid Integration

Azure hybrid mode keeps the local cockpit running and adds sanitized forwarding to Azure. Use it only when the client wants shared enterprise history, Azure Monitor, Log Analytics, or Azure Managed Grafana.

1. Select the client Azure subscription.

   ```bash
   az account set --subscription "your-subscription-name-or-id"
   ```

2. Set deployment naming values for the client environment.

   ```bash
   export AZURE_LOCATION=eastus
   export AZURE_WORKLOAD=agentobs
   export AZURE_ENVIRONMENT_NAME=dev
   export AZURE_REGION_ABBR=eus
   export AZURE_INSTANCE=001
   export AZURE_RESOURCE_GROUP=<resource-group-name>
   ```

3. Validate and deploy the Azure side.

   ```bash
   bash local-otel/azure/validate.sh
   bash local-otel/azure/deploy.sh
   ```

   The deploy script writes `local-otel/azure/.env` with `AZURE_OTLP_ENDPOINT` and `AZURE_OTLP_TOKEN`. This file is local-only and ignored by git.

4. Start local Docker Compose with Azure forwarding enabled.

   ```bash
   local-otel/start-full-stack.sh --hybrid
   ```

5. Validate the local stack and confirm Azure ingestion in the client Azure environment.

   ```bash
   local-otel/check-workshop-local.sh
   local-otel/azure/check-azure-runtime.sh
   ```

Security notes for Azure hybrid mode:

- Use client-owned Azure resources and managed identity where possible.
- Treat `AZURE_OTLP_TOKEN` as a secret and rotate it according to the client's policy.
- Keep local content capture disabled or approved before forwarding any telemetry.
- Do not use local OpenTelemetry as official billing. Official GitHub Copilot billing and adoption reporting require GitHub-provided sources.

## What The Bootstrap Configures

The client bootstrap performs the setup needed before the Docker stack can show useful GitHub Copilot metrics:

- reads `local-otel/client.env`;
- exports local `OTEL_*` and `COPILOT_OTEL_*` variables;
- updates VS Code user settings for GitHub Copilot OpenTelemetry;
- enables OTLP/HTTP at `http://localhost:4318`;
- optionally enables local content capture based on `FRONTIER_ENABLE_CONTENT_CAPTURE`;
- starts the Docker Compose stack under `local-otel/stack/`;
- registers the current Git workspace so telemetry can be attributed to the repository;
- sends a synthetic validation span;
- validates the local endpoints.

The most important VS Code settings are:

```json
{
  "github.copilot.chat.otel.enabled": true,
  "github.copilot.chat.otel.exporterType": "otlp-http",
  "github.copilot.chat.otel.otlpEndpoint": "http://localhost:4318",
  "github.copilot.chat.otel.captureContent": true,
  "github.copilot.chat.otel.maxAttributeSizeChars": 0,
  "github.copilot.chat.otel.dbSpanExporter.enabled": true
}
```

If `FRONTIER_ENABLE_CONTENT_CAPTURE=false`, the bootstrap sets content-capture values to `false` where supported.

## Generate Real Telemetry

After the stack is running and VS Code has been restarted:

1. Open the client repository in VS Code or VS Code Insiders.
2. Run one GitHub Copilot Chat or agent request in that Git repository.
3. Wait a short moment for materialization, or rerun the bootstrap if needed.
4. Refresh `http://localhost:3300`.

Workspace-attributed telemetry is easiest to interpret when VS Code is opened at the root of a Git repository with a configured remote.

## Validate The Local Cockpit

Run the focused client validation:

```bash
local-otel/check-workshop-local.sh
```

After the client has generated at least one real GitHub Copilot Chat or agent session inside the repository, run strict data validation:

```bash
local-otel/check-workshop-local.sh --strict-data
```

Expected result:

- Docker is running.
- The ten local containers are running.
- Frontier dashboard, Grafana, Aspire, Prometheus, Tempo, and Loki respond.
- The current Git workspace is registered.
- Real workspace-attributed GitHub Copilot telemetry is present after strict mode.
- Coach recommendations return cards after real telemetry exists.

## Daily Use

| Task | Command or URL |
| --- | --- |
| Start or rebuild the client stack | `bash local-otel/client-bootstrap.sh` |
| Start without rebuilding images | `bash local-otel/client-bootstrap.sh --no-build` |
| Validate setup | `local-otel/check-workshop-local.sh` |
| Validate real telemetry | `local-otel/check-workshop-local.sh --strict-data` |
| Open local cockpit | `http://localhost:3300` |
| Open Grafana | `http://localhost:3000` |
| Open Aspire Dashboard | `http://localhost:18888` |
| Stop local stack | `local-otel/stop-full-stack.sh` |

## Data Boundary

- Local content capture can include prompts, file paths, source snippets, tool arguments, and tool results.
- Keep `FRONTIER_ENABLE_CONTENT_CAPTURE=true` only for trusted local workshops or explicitly approved client use.
- Use `FRONTIER_ENABLE_CONTENT_CAPTURE=false` for stricter privacy.
- Local AIU and AI Credits estimates are operational telemetry, not official billing.
- Official GitHub Copilot billing, AI Credits, and adoption totals require GitHub billing exports, the GitHub usage dashboard, or the Copilot usage metrics API.
- Real local files such as `local-otel/client.env`, `local-otel/stack/.env`, runtime logs, DuckDB files, and Azure `.env` files are ignored by git.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Dashboard is empty | Restart VS Code, run a GitHub Copilot Chat or agent request in a Git repository, then refresh. |
| No workspace attribution | Open VS Code at the Git repository root and rerun `local-otel/register-workspace.sh`. |
| Docker containers are missing | Start Docker Desktop, then rerun `bash local-otel/client-bootstrap.sh`. |
| VS Code settings did not change | Confirm `FRONTIER_VSCODE_CHANNELS` includes the installed channel. |
| Privacy needs stricter defaults | Set `FRONTIER_ENABLE_CONTENT_CAPTURE=false` in `local-otel/client.env` and rerun the bootstrap. |

## Repository Branches

| Branch | Purpose |
| --- | --- |
| `main` | Client-ready branch. Use this branch for installation and customer delivery. |
| `develop` | Development branch for future changes before promotion to `main`. |

## References

- [Local OpenTelemetry kit](local-otel/README.md)
- [Workshop guide](workshop/README.md)
- [Local links guide](docs/FrontierCockpit_LocalLinksGuide_v1_0_0_2026-06-19_en.md)
- [Operations runbook](docs/FrontierCockpit_OperationsRunbook_v1_0_0_2026-06-17_en.md)
- [GitHub Copilot documentation](https://docs.github.com/en/copilot)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
