param(
    [switch]$Reset
)

# Windows equivalent of stop-full-stack.sh. Stops the full local observability
# stack without deleting data. Named volumes are preserved, so trace, metric,
# and log history and Grafana configuration survive a restart.
# Pass -Reset to also delete the data volumes (destructive, removes all local history).

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$StackDir = Join-Path $ScriptDir "stack"

$docker = Get-Command docker -ErrorAction SilentlyContinue
if (!$docker) { Write-Error "Docker CLI was not found."; exit 1 }
docker info *> $null
if ($LASTEXITCODE -ne 0) { Write-Host "Docker daemon is not running. Nothing to stop."; exit 0 }

Push-Location $StackDir
try {
    if ($Reset) {
        Write-Host "Stopping the stack and DELETING all local history volumes (traces, metrics, logs, Grafana)."
        docker compose -f docker-compose.yml -f docker-compose.azure.yaml down -v
        if ($LASTEXITCODE -ne 0) { Write-Error "docker compose down failed."; exit 1 }
        Write-Host "Stack stopped and local history volumes removed."
    }
    else {
        Write-Host "Stopping the stack and preserving all data volumes."
        docker compose -f docker-compose.yml -f docker-compose.azure.yaml down
        if ($LASTEXITCODE -ne 0) { Write-Error "docker compose down failed."; exit 1 }
        Write-Host "Stack stopped. History is preserved. Start again with $ScriptDir\start-full-stack.ps1"
    }
}
finally {
    Pop-Location
}
