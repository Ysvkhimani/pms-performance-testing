#!/usr/bin/env node
/**
 * Approach 2 — create project + seed epics/stories/tasks/members.
 * Run from repo root: node approach2/scripts/seed-heavy-project.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import {
  SEED_EPICS,
  SEED_STORIES_PER_EPIC,
  SEED_TASKS_PER_STORY,
  SEED_MEMBERS,
  SEED_DELAY_MS,
  SEED_PROFILE,
} from '../config/seed-defaults.js';
import {
  resolveToken,
  apiJson,
  sleep,
  pickId,
} from '../lib/pms-api-client.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = join(__dir, '../data/seeded-project.json');

async function createProject(token) {
  const codeRes = await apiJson('POST', '/projects/generate-code', token, {
    type: 'WEB',
  });
  let code = `PERF-${Date.now().toString(36).toUpperCase()}`;
  if (codeRes.ok && codeRes.data) {
    code =
      codeRes.data.code ??
      codeRes.data.project_code ??
      codeRes.data?.data?.code ??
      code;
  }

  const name = `Perf Legacy Sim ${new Date().toISOString().slice(0, 10)}`;
  const createRes = await apiJson('POST', '/projects', token, { name, code });

  if (!createRes.ok) {
    if (createRes.status === 403) {
      throw new Error(
        'POST /projects forbidden (403). Your user needs projects.create permission, or set HEAVY_PROJECT_ID to an existing project and skip seeding.'
      );
    }
    throw new Error(
      `POST /projects failed HTTP ${createRes.status}: ${JSON.stringify(createRes.data)}`
    );
  }

  const project =
    createRes.data?.project ?? createRes.data?.data ?? createRes.data;
  const projectId = project?.id ?? createRes.data?.id;

  if (!projectId) {
    throw new Error(
      `Project created but id missing: ${JSON.stringify(createRes.data)}`
    );
  }

  return { projectId, name, code };
}

async function addMembers(token, projectId) {
  const empRes = await apiJson('GET', '/projects/employees', token);
  if (!empRes.ok) {
    console.warn(`GET /projects/employees → ${empRes.status}, skipping members`);
    return 0;
  }

  const list =
    empRes.data?.employees ??
    empRes.data?.data ??
    (Array.isArray(empRes.data) ? empRes.data : []);

  let added = 0;
  const roleId = Number(process.env.SEED_MEMBER_ROLE_ID || 2);

  for (const emp of list) {
    if (added >= SEED_MEMBERS) {
      break;
    }
    const userId = pickId(emp);
    if (!userId) {
      continue;
    }

    const res = await apiJson('POST', `/projects/${projectId}/members`, token, {
      user_id: userId,
      role_id: roleId,
    });

    if (res.ok || res.status === 409) {
      added += 1;
    }
    await sleep(SEED_DELAY_MS);
  }

  return added;
}

async function findProjectByName(token, nameOrCode) {
  const res = await apiJson('GET', '/projects', token);
  if (!res.ok) {
    throw new Error(`GET /projects failed HTTP ${res.status}`);
  }
  const list =
    res.data?.data ?? res.data?.projects ?? (Array.isArray(res.data) ? res.data : []);
  const needle = nameOrCode.toLowerCase();
  const match = list.find(
    (p) =>
      String(p.name || '').toLowerCase() === needle ||
      String(p.code || '').toLowerCase() === needle ||
      String(p.name || '').toLowerCase().includes(needle) ||
      String(p.code || '').toLowerCase().includes(needle)
  );
  if (!match?.id) {
    throw new Error(`Project not found: "${nameOrCode}"`);
  }
  return { projectId: match.id, name: match.name, code: match.code || '-' };
}

async function createTask(token, payload) {
  const maxAttempts = 5;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await apiJson('POST', '/agile/tasks', token, payload);
    if (res.status === 429) {
      await sleep(SEED_DELAY_MS * attempt * 2);
      continue;
    }
    if (!res.ok) {
      if (attempt === maxAttempts) {
        console.warn(
          `POST /agile/tasks failed HTTP ${res.status}: ${JSON.stringify(res.data).slice(0, 120)}`
        );
      }
      return null;
    }
    const row = res.data?.task ?? res.data?.data ?? res.data;
    return row?.id ?? res.data?.id ?? null;
  }
  return null;
}

async function linkParent(token, childId, parentId) {
  await apiJson('PATCH', `/agile/tasks/${childId}/parent`, token, {
    parent_id: parentId,
  });
}

async function seedAgile(token, projectId, onProgress) {
  let epics = 0;
  let stories = 0;
  let tasks = 0;
  let errors = 0;

  for (let e = 0; e < SEED_EPICS; e++) {
    const epicId = await createTask(token, {
      title: `Perf Epic ${e + 1}`,
      project_id: projectId,
      type: 'Epic',
    });

    if (!epicId) {
      errors += 1;
      continue;
    }
    epics += 1;
    onProgress?.('epic', e + 1, SEED_EPICS);

    for (let s = 0; s < SEED_STORIES_PER_EPIC; s++) {
      let storyId = await createTask(token, {
        title: `Perf Story E${e + 1}-S${s + 1}`,
        project_id: projectId,
        type: 'Story',
        parent_id: epicId,
      });

      if (!storyId) {
        storyId = await createTask(token, {
          title: `Perf Story E${e + 1}-S${s + 1}`,
          project_id: projectId,
          type: 'Story',
        });
        if (storyId) {
          await linkParent(token, storyId, epicId);
        }
      }

      if (!storyId) {
        errors += 1;
        await sleep(SEED_DELAY_MS);
        continue;
      }
      stories += 1;

      for (let t = 0; t < SEED_TASKS_PER_STORY; t++) {
        let taskId = await createTask(token, {
          title: `Perf Task E${e + 1}-S${s + 1}-T${t + 1}`,
          project_id: projectId,
          type: 'Task',
          parent_id: storyId,
        });

        if (!taskId) {
          taskId = await createTask(token, {
            title: `Perf Task E${e + 1}-S${s + 1}-T${t + 1}`,
            project_id: projectId,
            type: 'Task',
          });
          if (taskId) {
            await linkParent(token, taskId, storyId);
          }
        }

        if (taskId) {
          tasks += 1;
        } else {
          errors += 1;
        }
        await sleep(SEED_DELAY_MS);
      }
      await sleep(SEED_DELAY_MS);
    }
    await sleep(SEED_DELAY_MS);
  }

  return { epics, stories, tasks, errors };
}

async function measureReads(token, projectId) {
  const paths = [
    `/projects/${projectId}/members`,
    `/projects/${projectId}/resources`,
    `/agile/backlog?project_id=${projectId}`,
    `/agile/board?project_id=${projectId}`,
    `/agile/epics?project_id=${projectId}`,
  ];

  const reads = {};
  for (const path of paths) {
    const t0 = performance.now();
    const res = await apiJson('GET', path, token);
    const ms = Math.round(performance.now() - t0);
    const bytes =
      typeof res.data === 'string'
        ? res.data.length
        : JSON.stringify(res.data || '').length;
    reads[path] = { status: res.status, ms, kb: Math.round(bytes / 1024) };
  }
  return reads;
}

async function main() {
  console.log('=== Approach 2: seed heavy project ===');
  console.log(
    `Profile ${SEED_PROFILE}: epics=${SEED_EPICS} stories/epic=${SEED_STORIES_PER_EPIC} tasks/story=${SEED_TASKS_PER_STORY} members=${SEED_MEMBERS}`
  );

  const token = await resolveToken();
  console.log('Auth OK\n');

  const projectName =
    process.env.SEED_PROJECT_NAME || process.env.SEED_TARGET_PROJECT || 'ECOFTETHI202602';
  const existingId = process.env.SEED_USE_EXISTING_PROJECT_ID;
  let projectId;
  let name;
  let code;

  if (existingId) {
    projectId = Number(existingId);
    name = `Existing project ${projectId}`;
    code = '-';
    console.log(`Using existing project id=${projectId} (SEED_USE_EXISTING_PROJECT_ID)`);
  } else if (projectName) {
    const found = await findProjectByName(token, projectName);
    projectId = found.projectId;
    name = found.name;
    code = found.code;
    console.log(`Using project "${name}" id=${projectId} (matched ${projectName})`);
  } else {
    const created = await createProject(token);
    projectId = created.projectId;
    name = created.name;
    code = created.code;
    console.log(`Created project id=${projectId} "${name}" (${code})`);
  }

  const members = await addMembers(token, projectId);
  console.log(`Members added: ${members}`);

  let lastLog = 0;
  const agile = await seedAgile(token, projectId, (_phase, n, total) => {
    if (n - lastLog >= 5) {
      lastLog = n;
      console.log(`  Epics ${n}/${total}…`);
    }
  });

  console.log(
    `Agile: ${agile.epics} epics, ${agile.stories} stories, ${agile.tasks} tasks (${agile.errors} errors)`
  );

  console.log('\nPost-seed read check:');
  const reads = await measureReads(token, projectId);
  for (const [path, m] of Object.entries(reads)) {
    console.log(`  GET ${path} → ${m.status} ${m.kb} KB ${m.ms}ms`);
  }

  const payload = {
    projectId,
    name,
    code,
    seededAt: new Date().toISOString(),
    profile: SEED_PROFILE,
    counts: { ...agile, members, errors: agile.errors },
    targets: {
      epics: SEED_EPICS,
      storiesPerEpic: SEED_STORIES_PER_EPIC,
      tasksPerStory: SEED_TASKS_PER_STORY,
      members: SEED_MEMBERS,
    },
    reads,
  };

  mkdirSync(dirname(OUT_FILE), { recursive: true });
  writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2));

  console.log(`\nSaved ${OUT_FILE}`);
  console.log('\nNext:');
  console.log('  k6 run approach2/scripts/project-module-heavy.js');
  console.log('  k6 run approach2/scripts/heavy-project-journey.js');
  console.log('  ./approach2/run-all.sh');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
