# Windows equivalent of workshop-ready.sh. One-command local workshop setup for
# Frontier Cockpit Local. Run from the participant Git repository. This is
# local-only and never enables Azure forwarding or hybrid mode.
#
# Host-only steps that require zsh (VS Code memory sampling) are skipped on
# Windows; the session materializer and coverage audit run inside the
# copilot-otel-jobs container instead, so the result matches macOS and Linux.

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) { Write-Host "`n==> $Message" }
function Fail([string]$Message) { Write-Error "FAIL  $Message"; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "Frontier Cockpit Local workshop setup"
Write-Host "local_only=true"
Write-Host "azure_forwarding=disabled"
Write-Host ""

$git = Get-Command git -ErrorAction SilentlyContinue
if (!$git) { Fail "git was not found. Install Git for Windows first." }
$inside = & git rev-parse --is-inside-work-tree 2>$null
if ($LASTEXITCODE -ne 0 -or $inside -ne "true") {
    Fail "Run this command from inside the Git repository the participant will use during the workshop. Workspace attribution depends on Git repository metadata."
}

$RepoRoot = (& git rev-parse --show-toplevel)
Set-Location $RepoRoot

$repoRemote = (& git config --get remote.origin.url 2>$null)
if (!$repoRemote) { $repoRemote = "unknown" }
$branch = (& git branch --show-current 2>$null)
if (!$branch) { $branch = "unknown" }
Write-Host "repo_root=$RepoRoot"
Write-Host "repo_remote=$repoRemote"
Write-Host "branch=$branch"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (!$docker) { Fail "Docker CLI was not found. Install Docker Desktop first." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker is installed, but the daemon is not running. Start Docker Desktop, wait until it is ready, then rerun." }

Write-Step "Resolve participant identity"
# Precedence: shell env > local-otel/workshop.env > git config > generic default.
# These values only label the local dashboard. They are not sent to Azure.
$workshopEnv = Join-Path $ScriptDir "workshop.env"
if (Test-Path $workshopEnv) {
    foreach ($line in Get-Content $workshopEnv) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $matches[1]
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            $current = [Environment]::GetEnvironmentVariable($name, "Process")
            if ([string]::IsNullOrWhiteSpace($current)) {
                Set-Item -Path "Env:$name" -Value $value
            }
        }
    }
    Write-Host "identity_source=workshop.env"
}
else {
    Write-Host "identity_source=git-config-or-default"
}

function Default-Env([string]$Name, [string]$Value) {
    $current = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($current)) {
        Set-Item -Path "Env:$Name" -Value $Value
    }
}

$gitName = (& git config user.name 2>$null)
if (!$gitName) { $gitName = "Workshop Participant" }
$gitEmail = (& git config user.email 2>$null)
if (!$gitEmail) { $gitEmail = "" }
Default-Env "FRONTIER_PARTICIPANT_NAME" $gitName
Default-Env "FRONTIER_PARTICIPANT_EMAIL" $gitEmail
Default-Env "FRONTIER_PARTICIPANT_ROLE" "Developer"
Default-Env "FRONTIER_PARTICIPANT_TEAM" ""
Default-Env "FRONTIER_CUSTOMER_NAME" ""
Default-Env "FRONTIER_DASHBOARD_TITLE" "Frontier Cockpit Local"
Default-Env "OTEL_EXPORTER_OTLP_METRICS_ENDPOINT" "http://localhost:4318/v1/metrics"
Default-Env "OTEL_EXPORTER_OTLP_TRACES_ENDPOINT" "http://localhost:4318/v1/traces"

Write-Host "participant_name=$env:FRONTIER_PARTICIPANT_NAME"
Write-Host "participant_role=$env:FRONTIER_PARTICIPANT_ROLE"

Write-Step "Local OpenTelemetry environment"
Write-Host "Windows has no launchd. Persistent OTel variables for GitHub Copilot CLI and SDK workloads come from client-bootstrap.ps1; this run uses process-level variables."

Write-Step "Start full local stack"
& (Join-Path $ScriptDir "start-full-stack.ps1")
if ($LASTEXITCODE -ne 0) { Fail "start-full-stack.ps1 failed." }

function New-Attr([string]$Key, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { $Value = "unknown" }
    return @{ key = $Key; value = @{ stringValue = $Value } }
}

Write-Step "Register this Git workspace"
try {
    $workspacePath = $RepoRoot
    $workspaceName = Split-Path -Leaf $workspacePath
    $heads = (& git -C $workspacePath for-each-ref --format='%(objectname)' refs/heads 2>$null) -join ' '
    $hashBytes = [System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($workspacePath))
    $workspaceHash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $slug = $repoRemote -replace '\.git$', ''
    $slug = $slug -replace '^git@github\.com:', ''
    $slug = $slug -replace '^https://github\.com/', ''
    $owner = "unknown"
    $repoName = $workspaceName
    if ($slug -like '*/*') {
        $parts = $slug -split '/', 2
        $owner = $parts[0]
        $repoName = $parts[1]
    }
    $payload = @{
        resourceMetrics = @(@{
            resource = @{ attributes = @(
                (New-Attr "service.name" "copilot-workspace-registry"),
                (New-Attr "service.version" "1.0.0"),
                (New-Attr "workspace.name" $workspaceName),
                (New-Attr "workspace.kind" "git"),
                (New-Attr "workspace.path_hash" $workspaceHash),
                (New-Attr "git.branch" $branch),
                (New-Attr "git.repository.owner" $owner),
                (New-Attr "git.repository.name" $repoName),
                (New-Attr "github.copilot.git.repository" $repoRemote),
                (New-Attr "git.head_commit" $heads)
            ) }
            scopeMetrics = @(@{
                scope = @{ name = "frontier-workshop-ready" }
                metrics = @(@{
                    name = "copilot_workspace_registry"
                    description = "Friendly workspace registry for local GitHub Copilot OTel dashboards"
                    unit = "1"
                    gauge = @{ dataPoints = @(@{ timeUnixNano = ([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000).ToString(); asInt = "1"; attributes = @() }) }
                })
            })
        })
    }
    Invoke-RestMethod -Method Post -Uri $env:OTEL_EXPORTER_OTLP_METRICS_ENDPOINT -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 30) | Out-Null
    Write-Host "PASS  Registered workspace $workspaceName (git) for local dashboards."
}
catch {
    Write-Host "WARN  Could not register workspace yet. The Collector may still be starting."
}

Write-Step "Send synthetic validation span"
try {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $payload = @{
        resourceSpans = @(@{
            resource = @{ attributes = @(
                (New-Attr "service.name" "frontier-workshop-ready"),
                (New-Attr "service.version" "1.0.0")
            ) }
            scopeSpans = @(@{
                scope = @{ name = "frontier-workshop-ready" }
                spans = @(@{
                    traceId = ([guid]::NewGuid().ToString('N'))
                    spanId = ([guid]::NewGuid().ToString('N')).Substring(0, 16)
                    name = "workshop_ready_validation"
                    kind = 1
                    startTimeUnixNano = $now.ToString()
                    endTimeUnixNano = ($now + 1000000).ToString()
                    attributes = @((New-Attr "frontier.validation" "synthetic"))
                })
            })
        })
    }
    Invoke-RestMethod -Method Post -Uri $env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 30) | Out-Null
    Write-Host "PASS  Sent synthetic validation span."
}
catch {
    Write-Host "WARN  Could not send synthetic validation span yet. The Collector may still be starting."
}

Write-Step "Materialize recent GitHub Copilot sessions (inside the jobs container)"
docker exec `
    -e COPILOT_MATERIALIZE_FORCE_REPLAY=true `
    -e COPILOT_MATERIALIZE_CONTENT=true `
    -e COPILOT_MATERIALIZE_TRACE_LIMIT=1000 `
    copilot-otel-jobs zsh /app/local-otel/materialize-copilot-sessions.sh 2>$null
if ($LASTEXITCODE -ne 0) { Write-Host "WARN  Materializer run failed or the jobs container is still starting. It also runs automatically every 5 minutes." }

Write-Step "Refresh local support metrics (inside the jobs container)"
docker exec copilot-otel-jobs zsh /app/local-otel/audit-coverage.sh *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "WARN  Coverage audit failed or the jobs container is still starting. It also runs automatically every hour." }

Write-Step "Validate workshop readiness"
& (Join-Path $ScriptDir "check-workshop-local.ps1")
$checkExit = $LASTEXITCODE

Write-Host ""
Write-Host "Open the local cockpit: http://localhost:3300"
Write-Host "Open live traces:       http://localhost:18888"
Write-Host "Open Grafana:           http://localhost:3000"
Write-Host ""
Write-Host "Workshop next step: run one GitHub Copilot Chat or agent request in this repository, then click Refresh in the mini app."

exit $checkExit
