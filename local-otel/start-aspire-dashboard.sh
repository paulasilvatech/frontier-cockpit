#!/usr/bin/env zsh
set -euo pipefail

container_name="aspire-dashboard"
image_name="mcr.microsoft.com/dotnet/aspire-dashboard:latest"

if ! command -v docker >/dev/null 2>&1; then
  print -u2 "Docker CLI was not found. Install Docker Desktop, then run this script again."
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  print -u2 "Docker is installed, but the daemon is not running. Start Docker Desktop, wait until it is ready, then run this script again."
  exit 1
fi

existing_id="$(docker ps -aq -f "name=^/${container_name}$" || true)"
if [[ -n "$existing_id" ]]; then
  grpc_port="$(docker port "$container_name" 18889/tcp 2>/dev/null || true)"
  http_port="$(docker port "$container_name" 18890/tcp 2>/dev/null || true)"
  if [[ "$grpc_port" != *":4317"* || "$http_port" != *":4318"* ]]; then
    print "Aspire Dashboard container exists without the expected OTLP port mapping. Recreating it."
    docker stop "$container_name" >/dev/null 2>&1 || true
    existing_id=""
  fi
fi

if [[ -n "$existing_id" ]]; then
  running_id="$(docker ps -q -f "name=^/${container_name}$" || true)"
  if [[ -n "$running_id" ]]; then
    print "Aspire Dashboard is already running."
  else
    docker start "$container_name" >/dev/null
    print "Aspire Dashboard started from the existing container."
  fi
else
  docker run --rm -d \
    -e DOTNET_DASHBOARD_UNSECURED_ALLOW_ANONYMOUS=true \
    -p 127.0.0.1:18888:18888 \
    -p 127.0.0.1:4317:18889 \
    -p 127.0.0.1:4318:18890 \
    --name "$container_name" \
    "$image_name" >/dev/null
  print "Aspire Dashboard container created and started."
fi

print "Dashboard: http://localhost:18888"
print "OTLP gRPC endpoint for SDKs that use gRPC: http://localhost:4317"
print "OTLP HTTP endpoint for VS Code: http://localhost:4318"
