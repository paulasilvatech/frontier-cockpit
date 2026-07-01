#!/usr/bin/env zsh
set -euo pipefail

# Install Frontier Developer Cockpit user LaunchAgents from versioned templates.
# This copies plist files to ~/Library/LaunchAgents and loads them for the current GUI user.

script_dir="${0:A:h}"
template_dir="$script_dir/launchagents"
target_dir="$HOME/Library/LaunchAgents"
gui_domain="gui/$(id -u)"
include_legacy_registry=0

for arg in "$@"; do
  case "$arg" in
    --include-legacy-registry-launchagents) include_legacy_registry=1 ;;
    *) print -u2 "Unknown argument: $arg"; exit 2 ;;
  esac
done

if [[ ! -d "$template_dir" ]]; then
  print -u2 "LaunchAgent template directory not found: $template_dir"
  exit 1
fi

mkdir -p "$target_dir"

for template_file in "$template_dir"/*.plist(N); do
  plist_name="${template_file:t}"
  target_file="$target_dir/$plist_name"
  label="${plist_name%.plist}"

  if [[ "$include_legacy_registry" -eq 0 ]]; then
    case "$label" in
      com.frontier.copilot-otel-model-registry|\
      com.frontier.copilot-otel-price-registry)
        print "Skipping $label because model and price refresh now runs in the copilot-otel-registry Docker sidecar."
        continue
        ;;
    esac
  fi

  cp "$template_file" "$target_file"
  chmod 644 "$target_file"

  launchctl bootout "$gui_domain" "$target_file" >/dev/null 2>&1 || true
  launchctl bootstrap "$gui_domain" "$target_file"
  launchctl enable "$gui_domain/$label" >/dev/null 2>&1 || true

  case "$label" in
    com.frontier.copilot-otel-env|\
    com.frontier.copilot-otel-autostart|\
    com.frontier.copilot-otel-coverage|\
    com.frontier.copilot-otel-materializer|\
    com.frontier.copilot-otel-register-all|\
    com.frontier.copilot-otel-model-registry|\
    com.frontier.copilot-otel-price-registry|\
    com.frontier.copilot-otel-vscode-memory|\
    com.frontier.copilot-otel-daily-rollup|\
    com.frontier.copilot-otel-github-enterprise|\
    com.frontier.copilot-otel-github-orgs)
      launchctl kickstart -k "$gui_domain/$label" >/dev/null 2>&1 || true
      ;;
  esac

  print "Installed $label"
done

print "Frontier Developer Cockpit LaunchAgents installed under $target_dir."
print "Model and price registry LaunchAgents are legacy. Use --include-legacy-registry-launchagents only for troubleshooting without Docker Compose."
print "Restart VS Code Insiders after the environment agent runs."
