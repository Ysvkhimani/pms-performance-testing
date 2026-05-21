#!/usr/bin/env bash
# Approach 2 only: seed data → test project module → full journey
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p approach2/reports

echo "== 1/3 Seed heavy project =="
node approach2/scripts/seed-heavy-project.mjs

echo ""
echo "== 2/3 Project module (seeded project) =="
k6 run approach2/scripts/project-module-heavy.js

echo ""
echo "== 3/3 Full journey =="
k6 run approach2/scripts/heavy-project-journey.js

echo ""
echo "Reports: approach2/reports/"
