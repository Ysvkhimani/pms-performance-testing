import { Counter, Gauge, Trend } from 'k6/metrics';

export const error429Count = new Counter('error_429_count');
export const first429AfterRequest = new Gauge('first_429_after_request');
export const first429Vu = new Gauge('first_429_vu');
/** One sample per VU: that VU's request index when it first saw 429 (use min/median in report). */
export const vuFirst429Seq = new Trend('vu_first_429_seq', true);

export const pms_http_200 = new Counter('pms_http_200');
export const pms_http_401 = new Counter('pms_http_401');
export const pms_http_403 = new Counter('pms_http_403');
export const pms_http_404 = new Counter('pms_http_404');
export const pms_http_429 = new Counter('pms_http_429');

export const pms_http_2xx = new Counter('pms_http_2xx');
export const pms_http_3xx = new Counter('pms_http_3xx');
export const pms_http_4xx = new Counter('pms_http_4xx');
export const pms_http_5xx = new Counter('pms_http_5xx');
export const pms_http_other = new Counter('pms_http_other');

const discover =
  __ENV.DISCOVER_429 === '1' || __ENV.DISCOVER_429 === 'true';

let seq = 0;
let first429SeenThisVu = false;

function trackStatusClass(st) {
  if (st >= 200 && st < 300) {
    pms_http_2xx.add(1);
  } else if (st >= 300 && st < 400) {
    pms_http_3xx.add(1);
  } else if (st >= 400 && st < 500) {
    pms_http_4xx.add(1);
  } else if (st >= 500 && st < 600) {
    pms_http_5xx.add(1);
  } else {
    pms_http_other.add(1);
  }

  if (st === 200) {
    pms_http_200.add(1);
  } else if (st === 401) {
    pms_http_401.add(1);
  } else if (st === 403) {
    pms_http_403.add(1);
  } else if (st === 404) {
    pms_http_404.add(1);
  } else if (st === 429) {
    pms_http_429.add(1);
  }
}

function statusLabel(st) {
  const labels = {
    200: '200 OK',
    401: '401 Unauthorized',
    403: '403 Forbidden',
    404: '404 Not Found',
    429: '429 Too Many Requests',
  };
  return labels[st] || `HTTP ${st}`;
}

function logIterationLine(statusCounts) {
  const parts = Object.keys(statusCounts)
    .map(Number)
    .sort((a, b) => a - b)
    .map((code) => `${code}=${statusCounts[code]}`);

  const vu = typeof __VU !== 'undefined' ? __VU : '-';
  const iter = typeof __ITER !== 'undefined' ? __ITER : '-';
  const line = `PMS | VU ${vu} | iter ${iter} | ${parts.join(' ')}`;

  if (statusCounts[429] > 0) {
    console.error(line + ' | rate limited');
  } else if (parts.length === 1 && statusCounts[200]) {
    console.log(line);
  } else {
    console.warn(line);
  }
}

export function recordResponse(response, opts = {}) {
  const { logEachResponse = false } = opts;

  seq += 1;
  const st = response.status;
  trackStatusClass(st);

  if (st === 429) {
    error429Count.add(1);

    if (!first429SeenThisVu) {
      first429SeenThisVu = true;
      first429AfterRequest.add(seq);
      vuFirst429Seq.add(seq);
      if (typeof __VU !== 'undefined') {
        first429Vu.add(__VU);
      }

      console.error(
        `PMS | FIRST 429 on this VU | VU ${__VU} | after request #${seq} on this VU | ${response.url}`
      );
    }
  }

  if (logEachResponse) {
    const fn = st === 200 ? console.log : st === 429 ? console.error : console.warn;
    fn(
      `PMS | VU ${__VU} | req #${seq} | ${statusLabel(st)} | ${response.timings.duration}ms | ${response.url}`
    );
  }

  return seq;
}

export function recordBatch(responses, opts = {}) {
  const statusCounts = {};

  for (const response of responses) {
    recordResponse(response, { logEachResponse: opts.logEachResponse });
    statusCounts[response.status] = (statusCounts[response.status] || 0) + 1;
  }

  if (!opts.logEachResponse) {
    logIterationLine(statusCounts);
  }

  return statusCounts;
}

export function applyDiscover429Scenario(baseOptions) {
  if (!discover) {
    return baseOptions;
  }

  const duration = __ENV.DISCOVER_DURATION || '20m';
  const scenarios = {};

  for (const [name, sc] of Object.entries(baseOptions.scenarios || {})) {
    const {
      executor: _e,
      stages: _s,
      startVUs: _sv,
      gracefulRampDown: _grd,
      ...rest
    } = sc;

    scenarios[name] = {
      ...rest,
      executor: 'constant-vus',
      vus: 1,
      duration,
      gracefulStop: sc.gracefulStop || '30s',
    };
  }

  return { ...baseOptions, scenarios };
}

export function metricCount(data, name) {
  const m = data.metrics?.[name];
  if (!m?.values) {
    return 0;
  }
  const c = m.values.count;
  return typeof c === 'number' ? c : 0;
}

function trendField(data, name, field) {
  const v = data.metrics?.[name]?.values?.[field];
  return typeof v === 'number' ? v : null;
}

export function getHttpStatusSummary(data) {
  const total = data.metrics?.http_reqs?.values?.count ?? 0;
  return {
    total,
    c200: metricCount(data, 'pms_http_200'),
    c401: metricCount(data, 'pms_http_401'),
    c403: metricCount(data, 'pms_http_403'),
    c404: metricCount(data, 'pms_http_404'),
    c429: metricCount(data, 'pms_http_429'),
    seqMin: trendField(data, 'vu_first_429_seq', 'min'),
    seqMed: trendField(data, 'vu_first_429_seq', 'med'),
    seqMax: trendField(data, 'vu_first_429_seq', 'max'),
  };
}

/**
 * Developer-facing interpretation of the run (used in HTML + index).
 * @param {import('k6/data').SummaryData} data
 */
export function analyzeRateLimit(data) {
  const s = getHttpStatusSummary(data);
  const { total, c200, c401, c403, c404, c429, seqMin, seqMed, seqMax } = s;

  const pct = (n) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '0%');
  const pct429 = pct(c429);
  const pct200 = pct(c200);

  const durationMs =
    data.state?.testRunDurationMs ??
    data.metrics?.iteration_duration?.values?.max ??
    null;
  const durationSec =
    durationMs != null ? Math.round(Number(durationMs) / 1000) : null;

  let verdict = 'HEALTHY';
  if (c429 > 0 && c429 >= total * 0.3) {
    verdict = 'RATE_LIMITED';
  } else if (c401 > total * 0.15) {
    verdict = 'AUTH_ISSUES';
  } else if (c403 > total * 0.15 && c429 === 0) {
    verdict = 'PERMISSION_ISSUES';
  } else if (c429 > 0 || c401 > 0 || c403 > 0) {
    verdict = 'MIXED';
  }

  let reliableSeq = seqMin;
  if (
    seqMin != null &&
    seqMin <= 3 &&
    seqMed != null &&
    seqMed > 5
  ) {
    reliableSeq = seqMed;
  }

  let first429Headline = 'No HTTP 429 (rate limiting) observed in this run.';
  let first429Detail = '';
  let first429Text = first429Headline;

  if (c429 > 0) {
    if (discover && reliableSeq != null) {
      first429Headline = `Rate limiting began after request #${Math.round(reliableSeq)} (single virtual user).`;
      first429Detail = `Only one client was simulated. After ${Math.round(reliableSeq)} HTTP calls on that client, the API started returning 429. Total 429 in run: ${c429.toLocaleString()} (${pct429}).`;
    } else if (reliableSeq != null && seqMax != null) {
      first429Headline = `Under load, VUs typically hit 429 after ~${Math.round(reliableSeq)}–${Math.round(seqMax)} requests each.`;
      first429Detail =
        `Across ${total.toLocaleString()} total HTTP responses, ${c429.toLocaleString()} were 429 (${pct429}). ` +
        `The earliest VUs that were already running hit 429 around local request #${Math.round(reliableSeq)} (median ~${seqMed != null ? Math.round(seqMed) : '—'}). ` +
        `Note: a VU that joins late can show "request #1" — that is not when the system first broke globally. ` +
        (durationSec != null
          ? `Test duration about ${durationSec}s. `
          : '') +
        `Before 429 dominated, there were about ${(c200 + c401 + c403 + c404).toLocaleString()} responses that were not 429.`;
    } else {
      first429Headline = `Heavy rate limiting: ${c429.toLocaleString()} × 429 (${pct429}).`;
      first429Detail = 'Per-VU first-429 sequence was not recorded; check terminal for lines starting with PMS | FIRST 429.';
    }
    first429Text = first429Headline;
  }

  const actions = [];
  if (c401 > 0) {
    actions.push({
      priority: 'high',
      area: 'Authentication',
      issue: `${c401.toLocaleString()} × 401 Unauthorized (${pct(c401)})`,
      fix: 'Refresh Bearer token in config/config.js from browser DevTools (Network → 200 request → Authorization header).',
    });
  }
  if (c403 > 0) {
    actions.push({
      priority: 'medium',
      area: 'Permissions',
      issue: `${c403.toLocaleString()} × 403 Forbidden (${pct(c403)})`,
      fix: 'Check role access for endpoints (e.g. agile/epics). Use a user/project that can open the screen in the UI.',
    });
  }
  if (c429 > 0) {
    actions.push({
      priority: 'high',
      area: 'Rate limit / gateway',
      issue: `${c429.toLocaleString()} × 429 Too Many Requests (${pct429})`,
      fix: 'Review API gateway or WAF rate limits, caching, and backlog/board hot paths. Reproduce with DISCOVER_429=1 for one clear "after N requests" number.',
    });
  }
  if (c200 > 0 && c429 === 0 && c401 === 0) {
    actions.push({
      priority: 'low',
      area: 'Capacity',
      issue: `${c200.toLocaleString()} × 200 OK (${pct200})`,
      fix: 'This run did not hit rate limits. Increase VUs or duration to find the breaking point.',
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: 'low',
      area: 'General',
      issue: 'No major HTTP errors recorded',
      fix: 'Review k6 thresholds and latency tabs below.',
    });
  }

  return {
    ...s,
    pct429,
    pct200,
    verdict,
    first429Headline,
    first429Detail,
    first429Text,
    reliableSeq,
    durationSec,
    actions,
  };
}

export function formatFirst429Summary(data, opts = {}) {
  const label = opts.scriptLabel || 'k6';
  const a = analyzeRateLimit(data);

  return [
    '==================================================',
    `EXECUTIVE SUMMARY — ${label}`,
    '==================================================',
    `Verdict: ${a.verdict}`,
    `Test duration: ${a.durationSec != null ? a.durationSec + 's' : 'n/a'}`,
    `Total HTTP requests: ${a.total.toLocaleString()}`,
    '',
    'HTTP status breakdown:',
    `  200 OK:              ${a.c200.toLocaleString()} (${a.pct200})`,
    `  401 Unauthorized:    ${a.c401.toLocaleString()}`,
    `  403 Forbidden:       ${a.c403.toLocaleString()}`,
    `  404 Not Found:       ${a.c404.toLocaleString()}`,
    `  429 Too Many Requests: ${a.c429.toLocaleString()} (${a.pct429})`,
    '',
    'Rate limiting:',
    `  ${a.first429Headline}`,
    a.first429Detail ? `  ${a.first429Detail}` : '',
    '',
    'Developer actions:',
    ...a.actions.map(
      (x, i) => `  ${i + 1}. [${x.priority}] ${x.area}: ${x.fix}`
    ),
    '==================================================',
  ]
    .filter(Boolean)
    .join('\n');
}
