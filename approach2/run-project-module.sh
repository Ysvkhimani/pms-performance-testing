#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
mkdir -p approach2/reports

node approach2/scripts/seed-heavy-project.mjs
k6 run approach2/scripts/project-module-heavy.js
