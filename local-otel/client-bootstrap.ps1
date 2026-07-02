param(
    [string]$Config = "",
    [switch]$NoBuild,
    [switch]$SkipVSCodeSettings,
    [switch]$SkipUserEnv,
    [switch]$SkipWorkspaceRegister,
    [switch]$SkipValidation
)

$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) { Write-Host "`n==> $Message" }
function Write-Pass([string]$Message) { Write-Host "PASS  $Message" }
function Write-Warn([string]$Message) { Write-Host "WARN  $Message" }
function Fail([string]$Message) { Write-Error "FAIL  $Message"; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir
$StackDir = Join-Path $ScriptDir "stack"
$CallerDir = (Get-Location).Path
if ([string]::IsNullOrWhiteSpace($Config)) {
    $Config = Join-Path $ScriptDir "client.env"
}

function Read-EnvFile([string]$Path) {
    if (!(Test-Path $Path)) {
        $example = Join-Path $ScriptDir "client.env.example"
        if (Test-Path $example) {
            Copy-Item $example $Path
            Write-Warn "Created $Path from client.env.example. Edit it for the client, then rerun if needed."
        }
        else {
            Fail "Missing config file: $Path"
        }
    }
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $name = $matches[1]
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            Set-Item -Path "Env:$name" -Value $value
        }
    }
}

function Default-Env([string]$Name, [string]$Value) {
    $current = [Environment]::GetEnvironmentVariable($Name, "Process")
    if ([string]::IsNullOrWhiteSpace($current)) {
        Set-Item -Path "Env:$Name" -Value $Value
    }
}

function Set-OtelEnv {
    Default-Env "FRONTIER_PARTICIPANT_NAME" "Client Developer"
    Default-Env "FRONTIER_PARTICIPANT_ROLE" "Developer"
    Default-Env "FRONTIER_PARTICIPANT_EMAIL" ""
    Default-Env "FRONTIER_PARTICIPANT_TEAM" ""
    Default-Env "FRONTIER_CUSTOMER_NAME" "Client Organization"
    Default-Env "FRONTIER_DASHBOARD_TITLE" "Frontier Cockpit Local"
    Default-Env "FRONTIER_COPILOT_PLAN" "business"
    Default-Env "FRONTIER_COPILOT_SEATS" "1"
    Default-Env "FRONTIER_AI_CREDITS_USE_PROMO" "false"
    Default-Env "FRONTIER_AI_CREDITS_MONTHLY_ALLOWANCE" ""
    Default-Env "FRONTIER_VSCODE_CHANNELS" "stable,insiders"
    Default-Env "FRONTIER_ENABLE_CONTENT_CAPTURE" "false"

    $capture = $env:FRONTIER_ENABLE_CONTENT_CAPTURE
    $customer = ($env:FRONTIER_CUSTOMER_NAME -replace ',', ' ')
    $team = ($env:FRONTIER_PARTICIPANT_TEAM -replace ',', ' ')
    $vars = [ordered]@{
        COPILOT_OTEL_ENABLED = "true"
        COPILOT_OTEL_ENDPOINT = "http://localhost:4318"
        COPILOT_OTEL_PROTOCOL = "http"
        COPILOT_OTEL_CAPTURE_CONTENT = $capture
        COPILOT_OTEL_MAX_ATTRIBUTE_SIZE_CHARS = "0"
        COPILOT_MATERIALIZE_CONTENT = $capture
        COPILOT_MATERIALIZE_TRACE_LIMIT = "1000"
        OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT = $capture
        COPILOT_OTEL_LOG_LEVEL = "info"
        COPILOT_OTEL_HTTP_INSTRUMENTATION = "true"
        OTEL_EXPORTER_OTLP_ENDPOINT = "http://localhost:4318"
        OTEL_EXPORTER_OTLP_PROTOCOL = "http/protobuf"
        OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = "http://localhost:4318/v1/traces"
        OTEL_EXPORTER_OTLP_METRICS_ENDPOINT = "http://localhost:4318/v1/metrics"
        OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = "http://localhost:4318/v1/logs"
        OTEL_EXPORTER_OTLP_TRACES_PROTOCOL = "http/protobuf"
        OTEL_EXPORTER_OTLP_METRICS_PROTOCOL = "http/protobuf"
        OTEL_EXPORTER_OTLP_LOGS_PROTOCOL = "http/protobuf"
        OTEL_TRACES_EXPORTER = "otlp"
        OTEL_METRICS_EXPORTER = "otlp"
        OTEL_LOGS_EXPORTER = "otlp"
        OTEL_RESOURCE_ATTRIBUTES = "service.namespace=frontier-cockpit,environment=local,collection.scope=user,frontier.customer=$customer,frontier.team=$team"
    }
    foreach ($item in $vars.GetEnumerator()) {
        Set-Item -Path "Env:$($item.Key)" -Value $item.Value
        if (!$SkipUserEnv) {
            [Environment]::SetEnvironmentVariable($item.Key, $item.Value, "User")
        }
    }
    if (!$SkipUserEnv) {
        Write-Pass "Set user-level OTel environment for GitHub Copilot CLI, Copilot SDK apps, and terminal-launched tools that honor OTEL_* variables."
    }
}

function Apply-VSCodeSettings {
    if ($SkipVSCodeSettings) {
        Write-Warn "Skipped VS Code settings update."
        return
    }
    $paths = @()
    $channels = ($env:FRONTIER_VSCODE_CHANNELS).Split(',') | ForEach-Object { $_.Trim().ToLowerInvariant() }
    foreach ($channel in $channels) {
        if ($channel -eq "stable") { $paths += Join-Path $env:APPDATA "Code\User\settings.json" }
        if ($channel -eq "insiders") { $paths += Join-Path $env:APPDATA "Code - Insiders\User\settings.json" }
    }
    $capture = ($env:FRONTIER_ENABLE_CONTENT_CAPTURE).ToLowerInvariant() -eq "true"
    $settingsUpdate = [ordered]@{
        "github.copilot.chat.otel.enabled" = $true
        "github.copilot.chat.otel.exporterType" = "otlp-http"
        "github.copilot.chat.otel.otlpEndpoint" = "http://localhost:4318"
        "github.copilot.chat.otel.captureContent" = $capture
        "github.copilot.chat.otel.maxAttributeSizeChars" = 0
        "github.copilot.chat.otel.dbSpanExporter.enabled" = $true
        "chat.agentHost.otel.enabled" = $true
        "chat.agentHost.otel.captureContent" = $capture
        "chat.agentHost.otel.dbSpanExporter.enabled" = $true
    }
    foreach ($path in $paths) {
        $directory = Split-Path -Parent $path
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        $settings = @{}
        if (Test-Path $path) {
            $backup = "$path.frontier-backup-$(Get-Date -Format yyyyMMddHHmmss)"
            Copy-Item $path $backup
            $text = Get-Content -Raw -Path $path
            if (![string]::IsNullOrWhiteSpace($text)) {
                try {
                    $settings = ConvertFrom-Json -InputObject $text -AsHashtable
                }
                catch {
                    Fail "Could not parse $path as JSON. Backup written to $backup. Remove comments or trailing commas, then rerun."
                }
            }
        }
        foreach ($item in $settingsUpdate.GetEnumerator()) {
            $settings[$item.Key] = $item.Value
        }
        $settings | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 -Path $path
        Write-Pass "Updated VS Code settings: $path"
    }
}

function Ensure-AspireKey {
    $keyFile = Join-Path $StackDir "aspire-api-key.env"
    if (Test-Path $keyFile) { return }
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32)
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Set-Content -Encoding ASCII -Path $keyFile -Value "ASPIRE_DASHBOARD_API_KEY=$token"
    Write-Pass "Created local Aspire API key file."
}

function Ensure-GrafanaAdmin {
    $adminFile = Join-Path $StackDir "grafana-admin.env"
    if (Test-Path $adminFile) { return }
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes(24)
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Set-Content -Encoding ASCII -Path $adminFile -Value "GF_SECURITY_ADMIN_PASSWORD=$token"
    Write-Pass "Created local Grafana admin credentials. Username admin, password stored in $adminFile."
}

function Ensure-Docker {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (!$docker) { Fail "Docker CLI was not found. Install Docker Desktop, then rerun." }
    docker info *> $null
    if ($LASTEXITCODE -ne 0) { Fail "Docker is installed, but the daemon is not running. Start Docker Desktop and rerun." }
    Write-Pass "Docker daemon is running."
}

function Start-Stack {
    Push-Location $StackDir
    try {
        $composeArgs = @("compose", "-f", "docker-compose.yml", "up", "-d")
        if (!$NoBuild) { $composeArgs += "--build" }
        & docker @composeArgs
        if ($LASTEXITCODE -ne 0) { Fail "docker compose failed." }
        Write-Pass "Docker Compose stack is starting."
    }
    finally {
        Pop-Location
    }
}

function New-Attr([string]$Key, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { $Value = "unknown" }
    return @{ key = $Key; value = @{ stringValue = $Value } }
}

function Emit-WorkspaceRegistry {
    if ($SkipWorkspaceRegister) {
        Write-Warn "Skipped workspace registry metric."
        return
    }
    $workspacePath = $CallerDir
    $workspaceKind = "directory"
    $workspaceName = Split-Path -Leaf $workspacePath
    $branch = ""
    $remote = ""
    $heads = ""
    $git = Get-Command git -ErrorAction SilentlyContinue
    if ($git) {
        $inside = & git -C $CallerDir rev-parse --is-inside-work-tree 2>$null
        if ($LASTEXITCODE -eq 0 -and $inside -eq "true") {
            $workspacePath = & git -C $CallerDir rev-parse --show-toplevel
            $workspaceKind = "git"
            $workspaceName = Split-Path -Leaf $workspacePath
            $branch = (& git -C $workspacePath branch --show-current 2>$null)
            $remote = (& git -C $workspacePath config --get remote.origin.url 2>$null)
            $heads = (& git -C $workspacePath for-each-ref --format='%(objectname)' refs/heads 2>$null) -join ' '
        }
    }
    $hashBytes = [System.Security.Cryptography.SHA256]::HashData([Text.Encoding]::UTF8.GetBytes($workspacePath))
    $workspaceHash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $slug = $remote -replace '\.git$', ''
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
                (New-Attr "workspace.kind" $workspaceKind),
                (New-Attr "workspace.path_hash" $workspaceHash),
                (New-Attr "git.branch" $branch),
                (New-Attr "git.repository.owner" $owner),
                (New-Attr "git.repository.name" $repoName),
                (New-Attr "github.copilot.git.repository" $remote),
                (New-Attr "git.head_commit" $heads)
            ) }
            scopeMetrics = @(@{
                scope = @{ name = "frontier-client-bootstrap" }
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
    Write-Pass "Registered workspace $workspaceName ($workspaceKind) for local dashboards."
}

function Send-ValidationSpan {
    $now = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() * 1000000
    $traceId = ([guid]::NewGuid().ToString('N'))
    $spanId = ([guid]::NewGuid().ToString('N')).Substring(0, 16)
    $payload = @{
        resourceSpans = @(@{
            resource = @{ attributes = @(
                (New-Attr "service.name" "frontier-client-bootstrap"),
                (New-Attr "service.version" "1.0.0"),
                (New-Attr "frontier.customer" $env:FRONTIER_CUSTOMER_NAME)
            ) }
            scopeSpans = @(@{
                scope = @{ name = "frontier-client-bootstrap" }
                spans = @(@{
                    traceId = $traceId
                    spanId = $spanId
                    name = "client_bootstrap_validation"
                    kind = 1
                    startTimeUnixNano = $now.ToString()
                    endTimeUnixNano = ($now + 1000000).ToString()
                    attributes = @((New-Attr "frontier.validation" "synthetic"))
                })
            })
        })
    }
    Invoke-RestMethod -Method Post -Uri $env:OTEL_EXPORTER_OTLP_TRACES_ENDPOINT -ContentType "application/json" -Body ($payload | ConvertTo-Json -Depth 30) | Out-Null
    Write-Pass "Sent synthetic validation span."
}

function Wait-Url([string]$Url, [string]$Name) {
    for ($i = 0; $i -lt 30; $i++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 4 -SkipHttpErrorCheck
            if ($response.StatusCode -in @(200, 302, 405)) {
                Write-Pass "$Name responds at $Url (HTTP $($response.StatusCode))."
                return
            }
        }
        catch {}
        Start-Sleep -Seconds 2
    }
    Write-Warn "$Name did not respond yet at $Url."
}

function Validate-Endpoints {
    if ($SkipValidation) { return }
    Wait-Url "http://localhost:4318/v1/traces" "OTLP HTTP traces endpoint"
    Wait-Url "http://localhost:18888" "Aspire Dashboard"
    Wait-Url "http://localhost:3000/api/health" "Grafana"
    Wait-Url "http://localhost:9090/-/ready" "Prometheus"
    Wait-Url "http://localhost:3200/ready" "Tempo"
    Wait-Url "http://localhost:3100/ready" "Loki"
    Wait-Url "http://localhost:3300" "Frontier Cockpit Local mini app"
}

Write-Step "Resolve client configuration"
Read-EnvFile $Config
Set-OtelEnv
Write-Pass "config_file=$Config"
Write-Pass "participant_name=$env:FRONTIER_PARTICIPANT_NAME"
Write-Pass "customer_name=$env:FRONTIER_CUSTOMER_NAME"

Write-Step "Configure VS Code GitHub Copilot OTel settings"
Apply-VSCodeSettings

Write-Step "Start Docker Compose stack"
Ensure-Docker
Ensure-AspireKey
Ensure-GrafanaAdmin
Start-Stack

Write-Step "Emit local validation telemetry"
try { Send-ValidationSpan } catch { Write-Warn "Could not send synthetic validation span yet. The Collector may still be starting." }
try { Emit-WorkspaceRegistry } catch { Write-Warn "Could not register workspace yet. Run from a Git repository after the stack is ready." }

Write-Step "Validate local endpoints"
Validate-Endpoints

Write-Host ""
Write-Host "Frontier Cockpit Local is configured."
Write-Host ""
Write-Host "Open:"
Write-Host "  Mini app:    http://localhost:3300"
Write-Host "  Aspire:      http://localhost:18888"
Write-Host "  Grafana:     http://localhost:3000"
Write-Host "  Prometheus:  http://localhost:9090"
Write-Host ""
Write-Host "Restart VS Code or VS Code Insiders, open the client Git repository, and run one GitHub Copilot Chat, agent, CLI, or SDK interaction."
Write-Host "Terminal-launched GitHub Copilot CLI and Copilot SDK workloads must start after the OTEL_* environment is loaded."