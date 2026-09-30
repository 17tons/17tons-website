#!/bin/sh
# Publishes dist/ to an Amplify Hosting branch as a manual deployment and waits for the job to end.
# Usage: AMPLIFY_APP_ID=<id> scripts/deploy-amplify.sh <branch>
set -eu

branch="${1:?branch name required}"
app="${AMPLIFY_APP_ID:?AMPLIFY_APP_ID required}"
archive=build/site.zip

mkdir -p build
rm -f "$archive"
(cd dist && python3 -m zipfile -c ../"$archive" .)

deployment=$(aws amplify create-deployment --app-id "$app" --branch-name "$branch" --output json)
job=$(printf '%s' "$deployment" | jq -r .jobId)
upload=$(printf '%s' "$deployment" | jq -r .zipUploadUrl)

curl --fail --silent --show-error --upload-file "$archive" -H "Content-Type: application/zip" "$upload"
aws amplify start-deployment --app-id "$app" --branch-name "$branch" --job-id "$job" --query jobSummary.status --output text

while :; do
  status=$(aws amplify get-job --app-id "$app" --branch-name "$branch" --job-id "$job" --query job.summary.status --output text)
  case "$status" in
    SUCCEED) echo "Amplify job $job published $branch"; exit 0 ;;
    FAILED | CANCELLED) echo "Amplify job $job ended $status" >&2; exit 1 ;;
  esac
  sleep 5
done
