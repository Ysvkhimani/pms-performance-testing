import http from 'k6/http';
import { check, sleep } from 'k6';

import { headers } from '../../config/config.js';
import { PROJECT_ID } from '../config/scenario.js';
import { applyDiscover429Scenario } from '../../scripts/lib/rate-limit-tracker.js';
import { buildApproach2SummaryOutputs } from '../lib/k6-summary-output.js';
import { buildProjectModuleEndpoints } from '../lib/heavy-project-endpoints.js';
import {
  applyHeavyProjectScenario,
  recordHeavyEndpoint,
} from '../lib/heavy-project-tracker.js';

const endpoints = buildProjectModuleEndpoints();
const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'approach2-project-module',
  filePrefix: 'approach2-project-module',
  projectId: PROJECT_ID,
  moduleDescription:
    `Project module on seeded heavy project id=${PROJECT_ID} (list, resources, members).`,
  endpoints: endpoints.map((e) => e.url),
};

const baseOptions = {
  scenarios: {
    approach2_project_module: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '2m', target: 15 },
        { duration: '2m', target: 25 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
};

export const options = applyHeavyProjectScenario(
  applyDiscover429Scenario(baseOptions)
);

export default function () {
  const responses = http.batch(
    endpoints.map((ep) => ['GET', ep.url, null, { headers, tags: { endpoint: ep.name } }])
  );

  responses.forEach((response, i) => {
    const ep = endpoints[i];
    recordHeavyEndpoint(response, {
      endpoint: ep.name,
      sloMs: ep.sloMs,
      logEachResponse,
    });
    check(response, {
      'status is 200': (r) => r.status === 200,
      [`${ep.name} under SLO`]: (r) => r.timings.duration < ep.sloMs,
    });
  });

  sleep(2);
}

export function handleSummary(data) {
  return buildApproach2SummaryOutputs(data, reportCtx);
}
