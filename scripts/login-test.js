import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, headers } from '../config/config.js';
import { applyDiscover429Scenario, recordBatch } from './lib/rate-limit-tracker.js';
import { buildK6SummaryOutputs } from './lib/k6-summary-output.js';

const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'login-test',
  filePrefix: 'login-test',
  moduleDescription: 'Post-login smoke: burndown, search, and my-work.',
  endpoints: [
    `${BASE_URL}/sprints/1/burndown`,
    `${BASE_URL}/search?q=test`,
    `${BASE_URL}/my-work`,
  ],
};

const baseOptions = {
  scenarios: {
    login_module_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 10 },
        { duration: '1m', target: 25 },
        { duration: '1m', target: 50 },
        { duration: '1m', target: 100 },
        { duration: '1m', target: 150 },
        { duration: '1m', target: 0 },
      ],
    },
  },
};

export const options = applyDiscover429Scenario(baseOptions);

export default function () {
  const responses = http.batch([
    ['GET', `${BASE_URL}/sprints/1/burndown`, null, { headers }],
    ['GET', `${BASE_URL}/search?q=test`, null, { headers }],
    ['GET', `${BASE_URL}/my-work`, null, { headers }],
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
