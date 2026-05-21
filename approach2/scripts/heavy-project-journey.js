import http from 'k6/http';
import { check, sleep } from 'k6';

import { headers } from '../../config/config.js';
import { PROJECT_ID } from '../config/scenario.js';
import { applyDiscover429Scenario } from '../../scripts/lib/rate-limit-tracker.js';
import { buildApproach2SummaryOutputs } from '../lib/k6-summary-output.js';
import { buildHeavyProjectEndpoints } from '../lib/heavy-project-endpoints.js';
import {
  applyHeavyProjectScenario,
  recordHeavyEndpoint,
} from '../lib/heavy-project-tracker.js';

const endpoints = buildHeavyProjectEndpoints();
const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'approach2-heavy-journey',
  filePrefix: 'approach2-heavy-journey',
  projectId: PROJECT_ID,
  moduleDescription:
    `Seeded heavy project id=${PROJECT_ID} — full module journey after data seed.`,
  endpoints: endpoints.map((e) => e.url),
};

const baseOptions = {
  scenarios: {
    approach2_journey: {
      executor: 'ramping-vus',
      stages: [
        { duration: '2m', target: 5 },
        { duration: '3m', target: 15 },
        { duration: '2m', target: 25 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.25'],
  },
};

export const options = applyHeavyProjectScenario(
  applyDiscover429Scenario(baseOptions)
);

export default function () {
  for (const ep of endpoints) {
    const response = http.get(ep.url, { headers, tags: { endpoint: ep.name } });

    recordHeavyEndpoint(response, {
      endpoint: ep.name,
      sloMs: ep.sloMs,
      logEachResponse,
    });

    check(response, {
      'status is 200': (r) => r.status === 200,
      [`${ep.name} under SLO`]: (r) => r.timings.duration < ep.sloMs,
    });

    sleep(0.3);
  }

  sleep(1 + Math.random() * 2);
}

export function handleSummary(data) {
  return buildApproach2SummaryOutputs(data, reportCtx);
}
