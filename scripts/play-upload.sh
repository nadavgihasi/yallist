#!/usr/bin/env bash
# CI (android.yml): upload an AAB to a Google Play track and roll it out, through the Play
# Developer API (https://developers.google.com/android-publisher/edits).
#
# Usage: scripts/play-upload.sh <app.aab> <version name>
# Env:   PLAY_SERVICE_ACCOUNT_JSON  the service account's JSON key (docs/android.md)
#        PLAY_TRACK                 internal (default), alpha (closed), beta (open) or production
#        PLAY_RELEASE_STATUS        completed (default), or draft while the app has never been
#                                   published (Play rejects a completed release until then)
set -euo pipefail

aab=$1
version=$2
package=app.yallist
track=${PLAY_TRACK:-internal}
status=${PLAY_RELEASE_STATUS:-completed}
api=https://androidpublisher.googleapis.com/androidpublisher/v3/applications/$package
upload_api=https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/$package

key_file=$(mktemp)
trap 'rm -f "$key_file"' EXIT
jq -r .private_key <<<"$PLAY_SERVICE_ACCOUNT_JSON" >"$key_file"
client_email=$(jq -r .client_email <<<"$PLAY_SERVICE_ACCOUNT_JSON")

# OAuth access token from a JWT signed with the service account's key.
b64url() { openssl base64 -A | tr '+/' '-_' | tr -d '='; }
now=$(date +%s)
header=$(printf '{"alg":"RS256","typ":"JWT"}' | b64url)
claims=$(jq -cn --arg iss "$client_email" --argjson iat "$now" '{
  iss: $iss, iat: $iat, exp: ($iat + 600),
  scope: "https://www.googleapis.com/auth/androidpublisher",
  aud: "https://oauth2.googleapis.com/token"
}' | b64url)
signature=$(printf '%s.%s' "$header" "$claims" | openssl dgst -sha256 -sign "$key_file" | b64url)
token=$(curl -fsS https://oauth2.googleapis.com/token \
  --data-urlencode grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer \
  --data-urlencode "assertion=$header.$claims.$signature" | jq -r .access_token)

# --fail-with-body: on an error, print Google's explanation (e.g. "version code already used").
call() { curl -sS --fail-with-body -H "Authorization: Bearer $token" "$@"; }

edit=$(call -X POST "$api/edits" | jq -r .id)
echo "Uploading $aab..."
version_code=$(call -X POST -H 'Content-Type: application/octet-stream' --data-binary "@$aab" \
  "$upload_api/edits/$edit/bundles?uploadType=media" | jq -r .versionCode)
release=$(jq -cn --arg track "$track" --arg name "$version" --arg code "$version_code" --arg status "$status" \
  '{track: $track, releases: [{name: $name, versionCodes: [$code], status: $status}]}')
call -X PUT -H 'Content-Type: application/json' --data "$release" "$api/edits/$edit/tracks/$track" >/dev/null
call -X POST "$api/edits/$edit:commit" >/dev/null

echo "Released $version (version code $version_code) to the $track track, status $status."
if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "Google Play: $version (version code $version_code) → **$track** track ($status)" >>"$GITHUB_STEP_SUMMARY"
fi
