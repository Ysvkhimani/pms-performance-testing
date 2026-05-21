#!/usr/bin/env bash
# Seed ECOFTETHI202602 + run approach-2 performance tests + reports
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p approach2/reports

export SEED_PROJECT_NAME="${SEED_PROJECT_NAME:-ECOFTETHI202602}"
export SEED_PROFILE="${SEED_PROFILE:-medium}"
export SEED_DELAY_MS="${SEED_DELAY_MS:-100}"

echo "== 1/3 Seed data into ${SEED_PROJECT_NAME} (profile=${SEED_PROFILE}) =="
node approach2/scripts/seed-heavy-project.mjs

export HEAVY_PROJECT_ID="$(node -pe "require('./approach2/data/seeded-project.json').projectId")"
echo "Project id: ${HEAVY_PROJECT_ID}"

echo ""
echo "== 2/3 Project module load test =="
sleep 10
k6 run approach2/scripts/project-module-heavy.js

echo ""
echo "== 3/3 Full journey load test =="
sleep 10
k6 run approach2/scripts/heavy-project-journey.js

echo ""
echo "Done. Reports in approach2/reports/"
