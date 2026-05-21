/**
 * Approach 2 only — project id for seeded heavy project tests.
 * Priority: HEAVY_PROJECT_ID env → approach2/data/seeded-project.json
 */
function resolveProjectId() {
  if (__ENV.HEAVY_PROJECT_ID || __ENV.PROJECT_ID) {
    return String(__ENV.HEAVY_PROJECT_ID || __ENV.PROJECT_ID);
  }

  try {
    const raw = open('../data/seeded-project.json');
    const parsed = JSON.parse(raw);
    if (parsed?.projectId != null) {
      return String(parsed.projectId);
    }
  } catch (_e) {
    /* run seed-heavy-project.mjs first */
  }

  throw new Error(
    'No project id: run "node approach2/scripts/seed-heavy-project.mjs" or set HEAVY_PROJECT_ID'
  );
}

export const PROJECT_ID = resolveProjectId();

export const HEAVY_SLO_MS = Number(__ENV.HEAVY_SLO_MS || 10000);
export const LIGHT_SLO_MS = Number(__ENV.LIGHT_SLO_MS || 3000);
