#!/usr/bin/env zsh
set -euo pipefail

# Configure or renew GitHub Enterprise audit log streaming to Azure Blob Storage.
# Uses a user delegation SAS because the storage account blocks Shared Key authentication.
# The SAS is encrypted with the GitHub Enterprise audit-log stream public key before it is
# sent to GitHub. The raw SAS is saved only in the local 0600 env file.

export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

script_dir="${0:A:h}"
azure_dir="$script_dir/azure"
enterprise="${GITHUB_ENTERPRISE_SLUG:-your-enterprise-slug}"
subscription="${AZURE_SUBSCRIPTION_ID:-00000000-0000-0000-0000-000000000000}"
resource_group="${AZURE_RESOURCE_GROUP:-rg-agentobs-dev-eus-001}"
account_file="$azure_dir/audit-storage-account.txt"
container_file="$azure_dir/audit-storage-container.txt"
env_file="$azure_dir/github-enterprise-audit-log-streaming.env"
state_file="$azure_dir/github-enterprise-audit-stream-state.json"
python_bin="${FRONTIER_PYTHON:-$script_dir/.venv/bin/python}"

# Portable UTC date offsets: GNU date (Linux, WSL) first, BSD date (macOS) fallback.
utc_offset() {
  local gnu_expr="$1" bsd_expr="$2" fmt="$3"
  date -u -d "$gnu_expr" "$fmt" 2>/dev/null || date -u -v"$bsd_expr" "$fmt"
}

if [[ ! -x "$python_bin" ]]; then
  print -u2 "Missing PyNaCl environment at $python_bin. Run the setup step first, or set FRONTIER_PYTHON to a Python interpreter with PyNaCl installed."
  exit 1
fi

if [[ ! -f "$account_file" || ! -f "$container_file" ]]; then
  print -u2 "Missing audit storage account/container files under $azure_dir."
  exit 1
fi

account="$(cat "$account_file")"
container="$(cat "$container_file")"

az account set --subscription "$subscription"

# Ensure the signed-in user can generate a user-delegation SAS and validate blobs.
storage_id="$(az storage account show --subscription "$subscription" -g "$resource_group" -n "$account" --query id -o tsv)"
principal="$(az ad signed-in-user show --query id -o tsv)"
az role assignment create --assignee "$principal" --role "Storage Blob Data Contributor" --scope "$storage_id" -o none 2>/dev/null || true

# User delegation SAS maximum validity is limited by Azure. Use 7 days and renew daily.
start="$(utc_offset '-5 minutes' '-5M' '+%Y-%m-%dT%H:%MZ')"
expiry="$(utc_offset '+7 days' '+7d' '+%Y-%m-%dT%H:%MZ')"
az account set --subscription "$subscription"
sas="$(az storage container generate-sas \
  --account-name "$account" \
  --name "$container" \
  --auth-mode login \
  --as-user \
  --permissions acdlrw \
  --start "$start" \
  --expiry "$expiry" \
  --https-only \
  -o tsv)"
container_sas_url="https://${account}.blob.core.windows.net/${container}?${sas}"
blob_service_sas_url="https://${account}.blob.core.windows.net/?${sas}"

# Validate SAS before giving it to GitHub.
sas_token="${container_sas_url#*\?}"
test_file="$(mktemp /tmp/github-audit-stream.XXXXXX)"
printf '{"test":"github-audit-stream","enterprise":"%s","time":"%s"}\n' "$enterprise" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" > "$test_file"
az storage blob upload \
  --account-name "$account" \
  --container-name "$container" \
  --name "_frontier/github-stream-connectivity.json" \
  --file "$test_file" \
  --sas-token "$sas_token" \
  --overwrite true \
  -o none
rm -f "$test_file"

stream_key_json="$(gh api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/${enterprise}/audit-log/stream-key")"
key_id="$(printf '%s' "$stream_key_json" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin)["key_id"])')"
public_key="$(printf '%s' "$stream_key_json" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin)["key"])')"

encrypted_sas_url="$("$python_bin" - "$public_key" "$container_sas_url" <<'PY'
import base64
import sys
from nacl.public import PublicKey, SealedBox
public_key_b64 = sys.argv[1]
secret_value = sys.argv[2]
public_key = PublicKey(base64.b64decode(public_key_b64))
sealed_box = SealedBox(public_key)
encrypted = sealed_box.encrypt(secret_value.encode('utf-8'))
print(base64.b64encode(encrypted).decode('utf-8'))
PY
)"

body_file="$(mktemp /tmp/github-audit-stream-body.XXXXXX)"
cat > "$body_file" <<JSON
{
  "enabled": true,
  "stream_type": "Azure Blob Storage",
  "vendor_specific": {
    "key_id": "$key_id",
    "encrypted_sas_url": "$encrypted_sas_url",
    "container": "$container"
  }
}
JSON

streams_file="$(mktemp /tmp/github-audit-streams.XXXXXX)"
gh api -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/${enterprise}/audit-log/streams" > "$streams_file"
stream_id="$("$python_bin" - "$streams_file" <<'PY'
import json, sys
try:
  streams = json.load(open(sys.argv[1]))
except Exception:
    streams = []
for stream in streams:
    if stream.get('stream_type') == 'Azure Blob Storage':
        print(stream.get('id'))
        break
PY
)"
      rm -f "$streams_file"

if [[ -n "$stream_id" ]]; then
  result_json="$(gh api -X PUT -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/${enterprise}/audit-log/streams/${stream_id}" --input "$body_file")"
  action="updated"
else
  result_json="$(gh api -X POST -H 'Accept: application/vnd.github+json' -H 'X-GitHub-Api-Version: 2026-03-10' "/enterprises/${enterprise}/audit-log/streams" --input "$body_file")"
  action="created"
fi
rm -f "$body_file"

new_stream_id="$(printf '%s' "$result_json" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin).get("id", ""))')"
stream_enabled="$(printf '%s' "$result_json" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin).get("enabled", ""))')"
stream_type="$(printf '%s' "$result_json" | "$python_bin" -c 'import json,sys; print(json.load(sys.stdin).get("stream_type", ""))')"

cat > "$env_file" <<EOF
AZURE_AUDIT_STORAGE_ACCOUNT=$(printf '%q' "$account")
AZURE_AUDIT_STORAGE_CONTAINER=$(printf '%q' "$container")
AZURE_AUDIT_CONTAINER_SAS_URL=$(printf '%q' "$container_sas_url")
AZURE_AUDIT_BLOB_SAS_URL=$(printf '%q' "$blob_service_sas_url")
AZURE_AUDIT_SAS_START=$(printf '%q' "$start")
AZURE_AUDIT_SAS_EXPIRY=$(printf '%q' "$expiry")
AZURE_AUDIT_SAS_KIND=user_delegation
GITHUB_ENTERPRISE_SLUG=$(printf '%q' "$enterprise")
GITHUB_AUDIT_STREAM_ID=$(printf '%q' "$new_stream_id")
EOF
chmod 600 "$env_file"

cat > "$state_file" <<JSON
{
  "enterprise": "$enterprise",
  "storage_account": "$account",
  "container": "$container",
  "stream_id": "$new_stream_id",
  "stream_type": "$stream_type",
  "enabled": "$stream_enabled",
  "action": "$action",
  "sas_kind": "user_delegation",
  "sas_start": "$start",
  "sas_expiry": "$expiry",
  "updated_at": "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
}
JSON
chmod 600 "$state_file"

clipboard="false"
if command -v pbcopy >/dev/null 2>&1; then
  printf '%s' "$container_sas_url" | pbcopy && clipboard="true"
elif command -v clip.exe >/dev/null 2>&1; then
  printf '%s' "$container_sas_url" | clip.exe && clipboard="true"
elif command -v xclip >/dev/null 2>&1; then
  printf '%s' "$container_sas_url" | xclip -selection clipboard && clipboard="true"
fi

echo "enterprise=$enterprise"
echo "action=$action"
echo "stream_id=$new_stream_id"
echo "stream_type=$stream_type"
echo "enabled=$stream_enabled"
echo "storage_account=$account"
echo "container=$container"
echo "sas_expiry=$expiry"
echo "container_sas_url_copied_to_clipboard=$clipboard"
echo "env_file=$env_file"
echo "state_file=$state_file"
