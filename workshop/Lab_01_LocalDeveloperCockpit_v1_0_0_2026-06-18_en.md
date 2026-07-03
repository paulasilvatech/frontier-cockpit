---
title: "Lab 01, Local Developer Cockpit"
description: "Hands-on lab for starting and validating the Frontier Cockpit Local observability stack."
author: "Frontier Cockpit Team"
date: "2026-07-02"
version: "1.1.0"
status: "approved"
tags: ["github-copilot", "workshop", "local", "grafana", "aspire"]
---

<!-- markdownlint-disable MD025 -->

# Lab 01, Local Developer Cockpit

This lab helps participants start Frontier Cockpit Local and understand each local component.

Estimated duration: 30 minutes.

## Goals

- Start the full local stack.
- Validate OpenTelemetry endpoints.
- Open Aspire, Grafana, Prometheus, Tempo, and Loki.
- Understand the difference between live debugging and historical dashboards.

## Step 1, Start The Local Stack

Run from the cloned repository root (macOS/Linux; on Linux install `zsh` first):

```bash
local-otel/start-full-stack.sh
```

Windows PowerShell:

```powershell
pwsh -ExecutionPolicy Bypass -File local-otel/start-full-stack.ps1
```

Expected local endpoints:

| Component | Endpoint |
| --- | --- |
| OpenTelemetry HTTP | `http://localhost:4318` |
| OpenTelemetry gRPC | `http://localhost:4317` |
| Aspire Dashboard | `http://localhost:18888` |
| Grafana local | `http://localhost:3000` |
| Prometheus | `http://localhost:9090` |
| Tempo | `http://localhost:3200` |
| Loki | `http://localhost:3100` |

All ports bind to `127.0.0.1`, so the stack is reachable only from the local machine. The stack runs 10 containers, including `copilot-otel-jobs`, which runs the session materializer and daily rollup automatically on macOS, Linux, and Windows. Grafana uses its embedded SQLite database and requires the `admin` login with the generated password from `local-otel/stack/grafana-admin.env`. Anonymous access is disabled.

## Step 2, Validate The Stack

Run from the cloned repository root:

```bash
local-otel/check-workshop-local.sh
```

Windows PowerShell:

```powershell
pwsh -ExecutionPolicy Bypass -File local-otel/check-workshop-local.ps1
```

The output should show Docker, Collector, Aspire, Grafana, Prometheus, Tempo, Loki, the jobs container, and VS Code settings as ready.

## Step 3, Open The Interfaces

Open these URLs in your browser:

```text
http://localhost:18888
http://localhost:3000
http://localhost:9090
```

On macOS you can use `open <url>`, on Linux `xdg-open <url>`, and on Windows `start <url>`.

Explain:

| Interface | Best For |
| --- | --- |
| Aspire | Live trace debugging and GenAI visualizer |
| Grafana | Historical and educational dashboards |
| Prometheus | Raw metric exploration |
| Tempo | Trace search and trace detail |
| Loki | Logs and content-capture metadata |

## Step 4, Register The Workspace

From the cloned repository root:

```bash
local-otel/register-workspace.sh
```

This creates a local mapping from `workspace_path_hash` to a friendly workspace, repository, and branch. It does not fabricate usage.

## Step 5, Explain Local Privacy

Content capture is disabled by default. Local telemetry can include raw content only when a participant opts in by setting `FRONTIER_ENABLE_CONTENT_CAPTURE=true`, which should happen only when the facilitator approves. The local stack is intended for trusted developer machines and workshops where content capture is explicitly approved.

Azure forwarding redacts raw content before enterprise ingestion.

## Validation

Run:

```bash
curl -fsS http://localhost:9090/api/v1/label/__name__/values | python3 -m json.tool | head
```

You should see Prometheus metadata. Real GitHub Copilot metrics appear after a GitHub Copilot session runs.

## Completion Criteria

- [ ] Local stack is running.
- [ ] Aspire opens.
- [ ] Grafana opens.
- [ ] Workspace registry has a friendly entry.
- [ ] Participant can explain which tool is used for live traces vs historical dashboards.

## References

- [Developer Local Guide](../docs/FrontierCockpit_DeveloperLocalGuide_v1_0_0_2026-06-17_en.md)
- [Aspire Dashboard GenAI telemetry visualization](https://aspire.dev/dashboard/explore/#genai-telemetry-visualization)
- [OpenTelemetry GenAI semantic conventions](https://github.com/open-telemetry/semantic-conventions-genai/tree/main/docs/gen-ai/)
