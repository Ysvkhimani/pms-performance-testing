# PMS performance testing (k6)

## Approach 1 — concurrent users (unchanged)

Scripts in `scripts/` — same as before:

```bash
k6 run scripts/planning-module.js
k6 run scripts/project-module.js
k6 run scripts/quality-module.js
DISCOVER_429=1 k6 run scripts/planning-module.js
```

Reports: `reports/`

Token: `config/config.js`

---

## Approach 2 — seed data + test heavy project

**Fully separate folder:** [`approach2/README.md`](approach2/README.md)

Does not modify approach 1 scripts.

```bash
./approach2/run-all.sh
```

Reports: `approach2/reports/`
