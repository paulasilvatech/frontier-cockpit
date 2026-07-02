#!/usr/bin/env zsh
set -euo pipefail

# Unload Frontier Cockpit Local user LaunchAgents. By default this preserves the
# copied plist files. Pass --delete to remove them from ~/Library/LaunchAgents.

script_dir="${0:A:h}"
template_dir="$script_dir/launchagents"
target_dir="$HOME/Library/LaunchAgents"
gui_domain="gui/$(id -u)"
delete_files=0

for arg in "$@"; do
  case "$arg" in
    --delete) delete_files=1 ;;
    *) print -u2 "Unknown argument: $arg"; exit 2 ;;
  esac
done

if [[ ! -d "$template_dir" ]]; then
  print -u2 "LaunchAgent template directory not found: $template_dir"
  exit 1
fi

for template_file in "$template_dir"/*.plist(N); do
  plist_name="${template_file:t}"
  target_file="$target_dir/$plist_name"
  label="${plist_name%.plist}"

  if [[ -f "$target_file" ]]; then
    launchctl bootout "$gui_domain" "$target_file" >/dev/null 2>&1 || true
    if [[ "$delete_files" -eq 1 ]]; then
      rm -f "$target_file"
      print "Unloaded and deleted $label"
    else
      print "Unloaded $label"
    fi
  else
    print "Not installed: $label"
  fi
done

print "Frontier Cockpit Local LaunchAgent cleanup complete."
