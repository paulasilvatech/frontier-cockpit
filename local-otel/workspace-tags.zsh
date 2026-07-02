# Dynamic workspace tags for terminal-launched agents and dev tools.
# This file updates OTEL_RESOURCE_ATTRIBUTES from the current directory.

typeset -g _copilot_otel_dir="${0:A:h}"

if [[ "${COPILOT_OTEL_DISABLE_DYNAMIC_WORKSPACE_TAGS:-false}" == "true" ]]; then
  return 0
fi

_copilot_otel_escape_attr_value() {
  emulate -L zsh
  local value="$1"
  value="${value//$'\n'/ }"
  value="${value//$'\r'/ }"
  value="${value//,/;}"
  print -r -- "$value"
}

_copilot_otel_repo_slug_from_remote() {
  emulate -L zsh
  local remote="$1"
  local slug=""

  if [[ "$remote" == git@github.com:* ]]; then
    slug="${remote#git@github.com:}"
  elif [[ "$remote" == https://github.com/* ]]; then
    slug="${remote#https://github.com/}"
  elif [[ "$remote" == http://github.com/* ]]; then
    slug="${remote#http://github.com/}"
  elif [[ "$remote" == ssh://git@github.com/* ]]; then
    slug="${remote#ssh://git@github.com/}"
  else
    slug="${remote:t}"
  fi

  slug="${slug%.git}"
  print -r -- "$slug"
}

_copilot_otel_path_hash() {
  emulate -L zsh
  local path_value="$1"
  if command -v shasum >/dev/null 2>&1; then
    print -rn -- "$path_value" | shasum -a 256 | awk '{print $1}'
  else
    print -r -- "unavailable"
  fi
}

_copilot_otel_register_workspace_once() {
  emulate -L zsh
  local hash_value="$1"
  local stamp_dir="$_copilot_otel_dir/workspaces"
  local stamp_file="$stamp_dir/$hash_value"
  local now=""
  local last="0"

  [[ -n "$hash_value" && "$hash_value" != "unavailable" ]] || return 0
  [[ -f "$_copilot_otel_dir/register-workspace.sh" ]] || return 0

  now="$(date +%s)"
  if [[ -f "$stamp_file" ]]; then
    last="$(stat -f %m "$stamp_file" 2>/dev/null || stat -c %Y "$stamp_file" 2>/dev/null || print 0)"
    if (( now - last < 300 )); then
      return 0
    fi
  fi

  mkdir -p "$stamp_dir"
  ( "$_copilot_otel_dir/register-workspace.sh" >/dev/null 2>&1 && touch "$stamp_file" ) &!
}

copilot_otel_update_workspace_tags() {
  emulate -L zsh
  local base_attrs="${COPILOT_OTEL_BASE_RESOURCE_ATTRIBUTES:-team.id=platform,department=engineering,environment=local,collection.scope=user,workshop=true}"
  local current_dir="$PWD"
  local workspace_name=""
  local workspace_kind="directory"
  local workspace_path_hash=""
  local git_root=""
  local branch_name=""
  local remote_url=""
  local repo_slug=""
  local repo_owner=""
  local repo_name=""
  local dynamic_attrs=""

  if git_root="$(git rev-parse --show-toplevel 2>/dev/null)"; then
    workspace_kind="git"
    workspace_name="${git_root:t}"
    workspace_path_hash="$(_copilot_otel_path_hash "$git_root")"
    branch_name="$(git branch --show-current 2>/dev/null || true)"
    if [[ -z "$branch_name" ]]; then
      branch_name="$(git rev-parse --short HEAD 2>/dev/null || true)"
    fi
    remote_url="$(git config --get remote.origin.url 2>/dev/null || true)"
    repo_slug="$(_copilot_otel_repo_slug_from_remote "$remote_url")"
    if [[ "$repo_slug" == */* ]]; then
      repo_owner="${repo_slug%%/*}"
      repo_name="${repo_slug#*/}"
    else
      repo_name="${repo_slug:-$workspace_name}"
    fi
  else
    workspace_name="${current_dir:t}"
    workspace_path_hash="$(_copilot_otel_path_hash "$current_dir")"
  fi

  dynamic_attrs="workspace.name=$(_copilot_otel_escape_attr_value "$workspace_name"),workspace.kind=$workspace_kind,workspace.path_hash=$workspace_path_hash"

  if [[ -n "$remote_url" ]]; then
    dynamic_attrs="$dynamic_attrs,github.copilot.git.repository=$(_copilot_otel_escape_attr_value "$remote_url")"
  fi
  if [[ -n "$branch_name" ]]; then
    dynamic_attrs="$dynamic_attrs,github.copilot.git.branch=$(_copilot_otel_escape_attr_value "$branch_name"),git.branch=$(_copilot_otel_escape_attr_value "$branch_name")"
  fi
  if [[ -n "$repo_owner" ]]; then
    dynamic_attrs="$dynamic_attrs,github.copilot.github.org=$(_copilot_otel_escape_attr_value "$repo_owner"),git.repository.owner=$(_copilot_otel_escape_attr_value "$repo_owner")"
  fi
  if [[ -n "$repo_name" ]]; then
    dynamic_attrs="$dynamic_attrs,git.repository.name=$(_copilot_otel_escape_attr_value "$repo_name")"
  fi

  export OTEL_RESOURCE_ATTRIBUTES="$base_attrs,$dynamic_attrs"
  _copilot_otel_register_workspace_once "$workspace_path_hash"
}

if [[ -o interactive ]]; then
  autoload -Uz add-zsh-hook
  add-zsh-hook chpwd copilot_otel_update_workspace_tags
  add-zsh-hook precmd copilot_otel_update_workspace_tags
fi

copilot_otel_update_workspace_tags
