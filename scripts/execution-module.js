import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, headers } from '../config/config.js';
import { applyDiscover429Scenario, recordBatch } from './lib/rate-limit-tracker.js';
import { buildK6SummaryOutputs } from './lib/k6-summary-output.js';

const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'execution-module',
  filePrefix: 'execution-module',
  moduleDescription: 'Execution: tasks, my tasks, and dashboard.',
  endpoints: [
    `${BASE_URL}/tasks`,
    `${BASE_URL}/tasks/my`,
    `${BASE_URL}/dashboard`,
  ],
};

const baseOptions = {
  scenarios: {
    execution_module_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 200 },
        { duration: '1m', target: 0 },
      ],
    },
  },
};

export const options = applyDiscover429Scenario(baseOptions);

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/tasks`, null, { headers }],
    ['GET', `${BASE_URL}/tasks/my`, null, { headers }],
    ['GET', `${BASE_URL}/dashboard`, null, { headers }],
  ]);

  recordBatch(responses, { logEachResponse });

  responses.forEach((response) => {
    check(response, {
      'status is 200': (r) => r.status === 200,
      'response under 3 sec': (r) => r.timings.duration < 3000,
    });
  });

  sleep(Math.random() * 3);
}

export function handleSummary(data) {
  return buildK6SummaryOutputs(data, reportCtx);
}
