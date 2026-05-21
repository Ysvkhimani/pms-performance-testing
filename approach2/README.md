# Approach 2 — seed heavy project, then performance test

**Separate from approach 1** (`scripts/planning-module.js`, etc.). Nothing here changes those files.

## Steps

```bash
cd /home/yashvi/pms-performance-testing

# 1) Seed: new project + epics + stories + tasks + members
node approach2/scripts/seed-heavy-project.mjs

# 2) Test project module on that project
k6 run approach2/scripts/project-module-heavy.js

# 3) Or full multi-module journey
k6 run approach2/scripts/heavy-project-journey.js

# Or one command:
chmod +x approach2/run-all.sh
./approach2/run-all.sh
```

Token: uses `config/config.js` (same as approach 1).

If you cannot create projects (403), seed into an existing one:

```bash
SEED_USE_EXISTING_PROJECT_ID=123 node approach2/scripts/seed-heavy-project.mjs
HEAVY_PROJECT_ID=123 k6 run approach2/scripts/project-module-heavy.js
```

## Seed sizes

| `SEED_PROFILE` | Rough data |
|----------------|------------|
| `small` | 5 epics, 10 stories each |
| `medium` (default) | 25 × 30 × 5 tasks |
| `large` | 50 × 50 × 8 tasks |

After seed, `approach2/data/seeded-project.json` stores `projectId`.

## Reports

Written to **`approach2/reports/`** (not `reports/` used by approach 1).

Look for the purple **Approach 2 — heavy project** section: slowest API, payload size, where it breaks.
