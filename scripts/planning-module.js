import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, headers } from '../config/config.js';
import { applyDiscover429Scenario, recordBatch } from './lib/rate-limit-tracker.js';
import { buildK6SummaryOutputs } from './lib/k6-summary-output.js';

const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'planning-module',
  filePrefix: 'planning-module',
  moduleDescription:
    'Planning / Agile: backlog, board, and epics for project_id=1.',
  endpoints: [
    `${BASE_URL}/agile/backlog?project_id=1`,
    `${BASE_URL}/agile/board?project_id=1`,
    `${BASE_URL}/agile/epics?project_id=1`,
  ],
};

const baseOptions = {
  scenarios: {
    planning_module_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 80 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.20'],
  },
};

export const options = applyDiscover429Scenario(baseOptions);

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/agile/backlog?project_id=1`, null, { headers }],
    ['GET', `${BASE_URL}/agile/board?project_id=1`, null, { headers }],
    ['GET', `${BASE_URL}/agile/epics?project_id=1`, null, { headers }],
  ]);

  recordBatch(responses, { logEachResponse });

  responses.forEach((response) => {
    check(response, {
      'status is 200': (r) => r.status === 200,
      'response under 3 sec': (r) => r.timings.duration < 3000,
    });
  });

  sleep(2);
}

export function handleSummary(data) {
  return buildK6SummaryOutputs(data, reportCtx);
}
