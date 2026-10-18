#!/usr/bin/env bash
# The deployed tier: the official RealWorld suite (hurl/) and every scenario test, against a running server on Postgres.
# With REALWORLD_URL (and DATABASE_URL, for the storage contracts) set, it uses that server. Otherwise it starts the
# stack in compose.yaml and stops it afterwards. Writes two JUnit reports, which the deployed tier lists.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p .storyspec
rm -f .storyspec/hurl.xml .storyspec/pytest.xml

if [ -z "${REALWORLD_URL:-}" ]; then
  trap 'docker compose down -v >/dev/null 2>&1' EXIT
  docker compose up -d --build --wait
  export REALWORLD_URL=http://localhost:8000
  export DATABASE_URL=postgresql://realworld:realworld@localhost:5432/realworld
fi

status=0
hurl --test --jobs 1 --variable "host=$REALWORLD_URL" --variable "uid=$(date +%s)$$" \
  --report-junit .storyspec/hurl.xml hurl/*.hurl || status=1
python3 -m pytest -q -p no:cacheprovider --junitxml=.storyspec/pytest.xml || status=1
exit $status
