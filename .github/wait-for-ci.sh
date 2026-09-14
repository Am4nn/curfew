#!/usr/bin/env bash
# Wait for CI to finish on one commit, then insist it passed.
#
# Checking for an already-completed run was not enough. A tag cut while CI is
# still running on the same commit found nothing completed and refused to
# deploy, which is a false negative: CI was going to pass two minutes later.
# The opposite is worse, and is what this really guards. A Preview deploy that
# starts at the same moment as CI would otherwise race it and ship whatever was
# pushed, so the dev site could be serving a commit CI is about to fail.
#
# So: wait for a conclusion, then act on it. Deploy only on success.
#
#   REPO=owner/name SHA=<sha> [WORKFLOW=ci.yml] [TIMEOUT_MIN=45] wait-for-ci.sh
#
# Needs GH_TOKEN in the environment for `gh api`.
set -euo pipefail

WORKFLOW="${WORKFLOW:-ci.yml}"
TIMEOUT_MIN="${TIMEOUT_MIN:-45}"
INTERVAL=20

if [ -z "${REPO:-}" ] || [ -z "${SHA:-}" ]; then
  echo "REPO and SHA are required."
  exit 1
fi

deadline=$(( $(date +%s) + TIMEOUT_MIN * 60 ))
echo "Waiting for $WORKFLOW on $SHA (up to ${TIMEOUT_MIN}m)."

while :; do
  # The newest run for this commit. A re-run makes a second one, and the latest
  # is the one that counts.
  run="$(gh api \
    "repos/$REPO/actions/workflows/$WORKFLOW/runs?head_sha=$SHA&per_page=1" \
    --jq '.workflow_runs[0] | "\(.status)|\(.conclusion // "-")|\(.html_url)"' 2>/dev/null || echo "")"

  status="${run%%|*}"
  rest="${run#*|}"
  conclusion="${rest%%|*}"
  url="${rest#*|}"

  if [ -z "$run" ] || [ "$run" = "|" ]; then
    # CI has not been created yet. Normal for the first seconds after a push,
    # since both workflows start from the same event.
    status="pending"
  fi

  case "$status" in
    completed)
      if [ "$conclusion" = "success" ]; then
        echo "CI passed on $SHA"
        echo "$url"
        exit 0
      fi
      echo "CI concluded '$conclusion' on $SHA. Not deploying."
      echo "$url"
      exit 1
      ;;
    pending)
      echo "  no CI run for this commit yet, waiting..."
      ;;
    *)
      echo "  CI is $status, waiting..."
      ;;
  esac

  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Gave up after ${TIMEOUT_MIN}m with CI still '$status' on $SHA."
    echo "A tag on a commit that was never pushed to main never gets a CI run,"
    echo "which is the usual reason to end up here."
    exit 1
  fi
  sleep "$INTERVAL"
done
