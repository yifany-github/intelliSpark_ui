#!/usr/bin/env bash
set -euo pipefail

# Create GitHub issues from local markdown specs using GitHub CLI (gh).
# Prereqs:
#  - Install gh: https://cli.github.com/
#  - Authenticate: gh auth login
# Usage:
#  ./scripts/create_github_issues.sh

files=(
  "user_character_management_issue.md"
  "admin_safeguards_creator_visibility_issue.md"
  "nsfw_persona_consistency_qatests_issue.md"
)


if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI (gh) not found. Install from https://cli.github.com/" >&2
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "You are not authenticated with GitHub CLI. Run: gh auth login" >&2
  exit 1
fi

for f in "${files[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "Skipping missing file: $f" >&2
    continue
  fi

  # Title = first line without leading '# ' and optional 'Issue:' prefix
  raw_title=$(head -n 1 "$f" | sed -E 's/^#\s*//')
  title=${raw_title#Issue: }

  # Body = remaining lines
  body=$(tail -n +2 "$f")

  # Labels
  # Build args without labels (labels vary by repo; add manually if desired)
  args=(issue create --title "$title" --body "$body")

  echo "Creating issue: $title"
  gh "${args[@]}"
done

echo "All done. Verify issues on your repository."
