param(
    [switch]$Hybrid
)

# Windows equivalent of start-full-stack.sh. Starts the full local
# observability stack: OTel Collector + Aspire + Tempo + Prometheus + Loki +
# Grafana + registry/jobs sidecars + the Frontier Cockpit Local mini app.
# Pass -Hybrid to also forward telemetry to the Azure cloud Collector
# (requires local-otel/azure/.env with AZURE_OTLP_ENDPOINT and AZURE_OTLP_TOKEN).

$ErrorActionPreference = "Stop"

function Fail([string]$Message) { Write-Error $Message; exit 1 }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StackDir = Join-Path $ScriptDir "stack"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (!$docker) { Fail "Docker CLI was not found. Install Docker Desktop, then run this script again." }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Fail "Docker is installed, but the daemon is not running. Start Docker Desktop, wait until it is ready, then run this script again." }

# A leftover standalone Aspire container from older setups can publish host
# ports 4317/4318. In full-stack mode the OTel Collector owns those ports, so
# stop the standalone one first.
$runningNames = (& docker ps --format '{{.Names}}') -split "`n"
if ($runningNames -contains "aspire-dashboard") {
    $standalonePorts = (& docker port aspire-dashboard "18890/tcp" 2>$null)
    if ($standalonePorts -match ':4318') {
        Write-Host "Stopping the standalone Aspire container to free OTLP ports 4317/4318 for the Collector."
        docker stop aspire-dashboard *> $null
    }
}

function New-SecretEnvFile([string]$Path, [string]$Name, [int]$ByteCount) {
    if (Test-Path $Path) { return }
    $bytes = [System.Security.Cryptography.RandomNumberGenerator]::GetBytes($ByteCount)
    $token = [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
    Set-Content -Encoding ASCII -Path $Path -Value "$Name=$token"
}

$AspireKeyFile = Join-Path $StackDir "aspire-api-key.env"
New-SecretEnvFile $AspireKeyFile "ASPIRE_DASHBOARD_API_KEY" 32

$GrafanaAdminFile = Join-Path $StackDir "grafana-admin.env"
if (!(Test-Path $GrafanaAdminFile)) {
    New-SecretEnvFile $GrafanaAdminFile "GF_SECURITY_ADMIN_PASSWORD" 24
    Write-Host "Created Grafana admin credentials (user admin, password in $GrafanaAdminFile)."
}

function Import-EnvFile([string]$Path) {
    if (!(Test-Path $Path)) { return }
    foreach ($line in Get-Content $Path) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith("#")) { continue }
        if ($trimmed -match '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
            $value = $matches[2].Trim()
            if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
                $value = $value.Substring(1, $value.Length - 2)
            }
            Set-Item -Path "Env:$($matches[1])" -Value $value
        }
    }
}

Import-EnvFile $AspireKeyFile

Push-Location $StackDir
try {
    if ($Hybrid) {
        Import-EnvFile (Join-Path $ScriptDir "azure/.env")
        if ([string]::IsNullOrWhiteSpace($env:AZURE_OTLP_ENDPOINT) -or [string]::IsNullOrWhiteSpace($env:AZURE_OTLP_TOKEN)) {
            Fail "Hybrid mode needs AZURE_OTLP_ENDPOINT and AZURE_OTLP_TOKEN. Provision the Azure side first ($ScriptDir/azure/deploy.sh) and write $ScriptDir/azure/.env."
        }
        Write-Host "Starting full stack in hybrid mode (local backends + Azure forwarding)."
        docker compose -f docker-compose.yml -f docker-compose.azure.yaml up -d
    }
    else {
        Write-Host "Starting full local stack (offline, no Azure forwarding)."
        docker compose -f docker-compose.yml up -d
    }
    if ($LASTEXITCODE -ne 0) { Fail "docker compose failed." }
}
finally {
    Pop-Location
}

Write-Host ""
Write-Host "Endpoints:"
Write-Host "  OTLP ingest (Collector):  http://localhost:4318  (HTTP)   http://localhost:4317  (gRPC)"
Write-Host "  Aspire Dashboard (live):  http://localhost:18888"
Write-Host "  Grafana (history):        http://localhost:3000  (user admin, password in stack/grafana-admin.env)"
Write-Host "  Prometheus:               http://localhost:9090"
Write-Host "  Tempo:                    http://localhost:3200"
Write-Host "  Loki:                     http://localhost:3100"
Write-Host ""
Write-Host "Reload VS Code or VS Code Insiders, run a GitHub Copilot Chat agent request, then check Aspire and Grafana."
