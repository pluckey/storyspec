#!/usr/bin/env bash
# Copies the latest official RealWorld Hurl suite into hurl/ (needs the GitHub CLI).
set -euo pipefail
cd "$(dirname "$0")/../hurl"
for f in $(gh api repos/gothinkster/realworld/contents/specs/api/hurl -q '.[].name | select(endswith(".hurl"))'); do
  gh api "repos/gothinkster/realworld/contents/specs/api/hurl/$f" -q .content | base64 -d > "$f"
done
sha=$(gh api repos/gothinkster/realworld/commits/main -q .sha)
sed -i.bak -E "s/[0-9a-f]{40}/$sha/; s/\`[0-9a-f]{7}\`/\`${sha:0:7}\`/" README.md && rm README.md.bak
echo "hurl/ now matches gothinkster/realworld@${sha:0:7}"
