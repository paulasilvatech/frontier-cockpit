param(
    [switch]$StrictData
)

# Windows equivalent of check-workshop-local.sh. Workshop validation gate for
# Frontier Cockpit Local. Default mode validates stack, endpoints, workspace
# registry, and reports whether real GitHub Copilot telemetry is present. Use
# -StrictData after the participant has run at least one GitHub Copilot Chat
# or agent session in this repository.

$ErrorActionPreference = "Continue"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:Fail = $false
$script:WarnCount = 0

function Write-Pass([string]$Message) { Write-Host "PASS  $Message" }
function Write-WarnLine([string]$Message) { Write-Host "WARN  $Message"; $script:WarnCount++ }
function Write-FailLine([string]$Message) { Write-Host "FAIL  $Message"; $script:Fail = $true }

function Get-HttpCode([string]$Url) {
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 8 -SkipHttpErrorCheck
        return [int]$response.StatusCode
    }
    catch {
        return 0
    }
}

function Get-PromScalar([string]$Query) {
    try {
        $url = "http://localhost:9090/api/v1/query?query=" + [uri]::EscapeDataString($Query)
        $payload = Invoke-RestMethod -Uri $url -TimeoutSec 10
        $result = $payload.data.result
        if (!$result -or $result.Count -eq 0) { return 0 }
        return [double]$result[0].value[1]
    }
    catch {
        return 0
    }
}

$mode = if ($StrictData) { "strict-data" } else { "setup" }
Write-Host "==> Frontier Cockpit Local workshop validation"
Write-Host "mode=$mode"
Write-Host ""

$docker = Get-Command docker -ErrorAction SilentlyContinue
$dockerReady = $false
if (!$docker) {
    Write-FailLine "Docker CLI not found. Install Docker Desktop."
}
else {
    docker info *> $null
    if ($LASTEXITCODE -ne 0) {
        Write-FailLine "Docker daemon is not running. Start Docker Desktop and wait until it is ready."
    }
    else {
        Write-Pass "Docker daemon is running."
        $dockerReady = $true
    }
}

$expectedContainers = @(
    "aspire-dashboard",
    "copilot-otel-collector",
    "copilot-otel-grafana",
    "copilot-otel-jobs",
    "copilot-otel-loki",
    "copilot-otel-prometheus",
    "copilot-otel-registry",
    "copilot-otel-tempo",
    "frontier-dashboard-api",
    "frontier-dashboard-web"
)

if ($dockerReady) {
    $runningNames = (& docker ps --format '{{.Names}}') -split "`n" | ForEach-Object { $_.Trim() }
    foreach ($name in $expectedContainers) {
        if ($runningNames -contains $name) {
            Write-Pass "$name container is running."
        }
        else {
            Write-FailLine "$name container is not running. Run $ScriptDir\workshop-ready.ps1 from a Git repository."
        }
    }
}

$endpoints = @(
    @{ Url = "http://localhost:3300"; Name = "Frontier Cockpit Local mini app" },
    @{ Url = "http://localhost:3300/api/health"; Name = "Dashboard API health" },
    @{ Url = "http://localhost:3300/api/summary?range=24h&repo=all"; Name = "Dashboard summary API" },
    @{ Url = "http://localhost:3300/api/sessions?range=24h&repo=all"; Name = "Dashboard sessions API" },
    @{ Url = "http://localhost:3300/api/coach?range=24h&repo=all"; Name = "Dashboard coach API" },
    @{ Url = "http://localhost:3300/api/planner?lookback=7d&weeks=4&repo=all"; Name = "Dashboard planner API" },
    @{ Url = "http://localhost:3000/api/health"; Name = "Grafana" },
    @{ Url = "http://localhost:18888"; Name = "Aspire Dashboard" },
    @{ Url = "http://localhost:9090/-/ready"; Name = "Prometheus" },
    @{ Url = "http://localhost:3200/ready"; Name = "Tempo" },
    @{ Url = "http://localhost:3100/ready"; Name = "Loki" }
)

foreach ($endpoint in $endpoints) {
    $code = Get-HttpCode $endpoint.Url
    if ($code -in @(200, 302)) {
        Write-Pass "$($endpoint.Name) responds (HTTP $code)."
    }
    else {
        Write-FailLine "$($endpoint.Name) did not respond as expected (HTTP $code)."
    }
}

$git = Get-Command git -ErrorAction SilentlyContinue
$gitRoot = $null
if ($git) {
    $gitRoot = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0) { $gitRoot = $null }
}
if ($gitRoot) {
    $currentRepo = (& git -C $gitRoot config --get remote.origin.url 2>$null)
    $currentBranch = (& git -C $gitRoot branch --show-current 2>$null)
    Write-Host ""
    Write-Host "Workspace context:"
    Write-Host "  git_root=$gitRoot"
    Write-Host "  repo=$currentRepo"
    Write-Host "  branch=$currentBranch"
}
else {
    Write-WarnLine "Current directory is not inside a Git repository. Workspace attribution will be incomplete."
}

$workspaceRegistry = Get-PromScalar 'count(copilot_workspace_registry_ratio{workspace_kind="git"})'
$realSessions = Get-PromScalar 'count(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real"})'
$nonWorkspaceSessions = Get-PromScalar 'count(copilot_real_session_input_tokens_ratio{usage_scope="non_workspace_real"})'
$aiCredits = Get-PromScalar 'sum(max_over_time(copilot_real_session_nano_aiu_ratio{usage_scope="workspace_real"}[24h])) / 1e9'
$inputTokens = Get-PromScalar 'sum(max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real"}[24h]))'
$cacheRead = Get-PromScalar 'sum(max_over_time(copilot_real_session_cache_read_tokens_ratio{usage_scope="workspace_real"}[24h]))'
$workspacesObserved = Get-PromScalar 'count(max by (workspace_path_hash, workspace_name, branch) (max_over_time(copilot_real_session_input_tokens_ratio{usage_scope="workspace_real",workspace_kind="git",workspace_name!="unknown",repo!="",repo!="unknown"}[24h])))'

$coachCards = 0
try {
    $coach = Invoke-RestMethod -Uri "http://localhost:3300/api/coach?range=24h&repo=all" -TimeoutSec 10
    if ($coach.cards) { $coachCards = @($coach.cards).Count }
}
catch {}

Write-Host ""
Write-Host "Local telemetry summary:"
Write-Host "  workspace_registry_git=$workspaceRegistry"
Write-Host "  workspace_real_session_series=$realSessions"
Write-Host "  non_workspace_real_session_series=$nonWorkspaceSessions"
Write-Host "  workspaces_observed_24h=$workspacesObserved"
Write-Host "  ai_credits_local_24h=$aiCredits"
Write-Host "  input_tokens_24h=$inputTokens"
Write-Host "  cache_read_tokens_24h=$cacheRead"
Write-Host "  coach_cards=$coachCards"

if ($workspaceRegistry -gt 0) {
    Write-Pass "At least one Git workspace is registered."
}
else {
    Write-WarnLine "No Git workspace registry metric found yet. Run the client bootstrap or workshop-ready.ps1 inside the participant repository."
}

if ($realSessions -gt 0) {
    Write-Pass "Real workspace-attributed GitHub Copilot sessions are available."
}
elseif ($StrictData) {
    Write-FailLine "No workspace-attributed GitHub Copilot sessions found. Run one GitHub Copilot Chat or agent request in this Git repository, then rerun with -StrictData."
}
else {
    Write-WarnLine "No workspace-attributed GitHub Copilot sessions found yet. The stack is ready for the participant to generate one."
}

if ($nonWorkspaceSessions -gt 0) {
    Write-WarnLine "Some sessions are non_workspace_real. Open a Git repository in VS Code before generating workshop telemetry."
}

if ($coachCards -gt 0) {
    Write-Pass "Coach recommendations endpoint returns cards."
}
else {
    Write-WarnLine "Coach endpoint returned no cards. It will populate after real telemetry is present."
}

Write-Host ""
if (!$script:Fail) {
    if ($script:WarnCount -eq 0) {
        Write-Host "Ready for workshop. Open http://localhost:3300"
    }
    else {
        Write-Host "Workshop stack is ready with $($script:WarnCount) warning(s). Open http://localhost:3300"
        Write-Host "If this is before the participant's first GitHub Copilot request, warnings about missing sessions are expected."
    }
    exit 0
}

Write-Host "Workshop validation failed. Fix the FAIL items above and rerun this script."
exit 1
