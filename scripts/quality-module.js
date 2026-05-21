import http from 'k6/http';
import { check, sleep } from 'k6';

import { BASE_URL, headers } from '../config/config.js';
import { applyDiscover429Scenario, recordBatch } from './lib/rate-limit-tracker.js';
import { buildK6SummaryOutputs } from './lib/k6-summary-output.js';

const logEachResponse =
  __ENV.K6_VERBOSE === '1' || __ENV.K6_VERBOSE === 'true';

const reportCtx = {
  scriptLabel: 'quality-module',
  filePrefix: 'quality-module',
  moduleDescription: 'QA: coverage stats and plan stories.',
  endpoints: [
    `${BASE_URL}/qa/coverage-stats`,
    `${BASE_URL}/qa/plans/1/stories`,
  ],
};

const baseOptions = {
  scenarios: {
    quality_module_test: {
      executor: 'ramping-vus',
      stages: [
        { duration: '1m', target: 5 },
        { duration: '1m', target: 10 },
        { duration: '1m', target: 20 },
        { duration: '1m', target: 30 },
        { duration: '1m', target: 40 },
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
    ['GET', `${BASE_URL}/qa/coverage-stats`, null, { headers }],
    ['GET', `${BASE_URL}/qa/plans/1/stories`, null, { headers }],
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
