import { BASE_URL } from '../../config/config.js';
import { PROJECT_ID, HEAVY_SLO_MS, LIGHT_SLO_MS } from '../config/scenario.js';

export function buildHeavyProjectEndpoints() {
  const pid = PROJECT_ID;
  return [
    { name: 'projects_list', url: `${BASE_URL}/projects`, sloMs: LIGHT_SLO_MS },
    {
      name: 'project_resources',
      url: `${BASE_URL}/projects/${pid}/resources`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'project_members',
      url: `${BASE_URL}/projects/${pid}/members`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'agile_backlog',
      url: `${BASE_URL}/agile/backlog?project_id=${pid}`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'agile_board',
      url: `${BASE_URL}/agile/board?project_id=${pid}`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'agile_epics',
      url: `${BASE_URL}/agile/epics?project_id=${pid}`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'agile_stories',
      url: `${BASE_URL}/agile/stories?project_id=${pid}`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'tasks',
      url: `${BASE_URL}/tasks`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'dashboard',
      url: `${BASE_URL}/dashboard`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'qa_coverage',
      url: `${BASE_URL}/qa/coverage-stats`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'qa_plan_stories',
      url: `${BASE_URL}/qa/plans/${pid}/stories`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'search',
      url: `${BASE_URL}/search?q=perf`,
      sloMs: HEAVY_SLO_MS,
    },
  ];
}

export function buildProjectModuleEndpoints() {
  const pid = PROJECT_ID;
  return [
    { name: 'projects_list', url: `${BASE_URL}/projects`, sloMs: LIGHT_SLO_MS },
    {
      name: 'project_resources',
      url: `${BASE_URL}/projects/${pid}/resources`,
      sloMs: HEAVY_SLO_MS,
    },
    {
      name: 'project_members',
      url: `${BASE_URL}/projects/${pid}/members`,
      sloMs: HEAVY_SLO_MS,
    },
  ];
}
