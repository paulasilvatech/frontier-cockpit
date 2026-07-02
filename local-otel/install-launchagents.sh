#!/usr/bin/env zsh
set -euo pipefail

# Install Frontier Developer Cockpit user LaunchAgents from versioned templates.
# This copies plist files to ~/Library/LaunchAgents and loads them for the current GUI user.

script_dir="${0:A:h}"
template_dir="$script_dir/launchagents"
target_dir="$HOME/Library/LaunchAgents"
gui_domain="gui/$(id -u)"

if [[ "$(uname -s)" != "Darwin" ]]; then
  print -u2 "LaunchAgents are macOS-only optional automation. On Linux and Windows the Docker jobs container already schedules the materializer and rollup; use cron or Task Scheduler only for the optional host-side ingestion scripts."
  exit 1
fi

if [[ ! -d "$template_dir" ]]; then
  print -u2 "LaunchAgent template directory not found: $template_dir"
  exit 1
fi

mkdir -p "$target_dir"

for template_file in "$template_dir"/*.plist(N); do
  plist_name="${template_file:t}"
  target_file="$target_dir/$plist_name"
  label="${plist_name%.plist}"

  # Templates use the __LOCAL_OTEL_DIR__ placeholder so the repo can live at any path.
  sed "s|__LOCAL_OTEL_DIR__|$script_dir|g" "$template_file" > "$target_file"
  chmod 644 "$target_file"

  launchctl bootout "$gui_domain" "$target_file" >/dev/null 2>&1 || true
  launchctl bootstrap "$gui_domain" "$target_file"
  launchctl enable "$gui_domain/$label" >/dev/null 2>&1 || true
  launchctl kickstart -k "$gui_domain/$label" >/dev/null 2>&1 || true

  print "Installed $label"
done

print "Optional host-side LaunchAgents installed under $target_dir."
print "Session materializer and daily rollup are NOT installed here anymore. They run in the copilot-otel-jobs Docker container on every platform."
print "Restart VS Code Insiders after the environment agent runs."
