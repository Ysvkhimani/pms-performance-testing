import { Counter, Trend } from 'k6/metrics';

import { recordResponse } from '../../scripts/lib/rate-limit-tracker.js';

export const heavyDuration = new Trend('pms_heavy_duration', true);
export const heavyBytes = new Trend('pms_heavy_bytes', true);
export const heavySlow5s = new Counter('pms_heavy_slow_5s');
export const heavySlow10s = new Counter('pms_heavy_slow_10s');
export const heavyCheckFail = new Counter('pms_heavy_check_fail');

const baseline =
  __ENV.DISCOVER_BASELINE === '1' || __ENV.DISCOVER_BASELINE === 'true';

export function applyHeavyProjectScenario(baseOptions) {
  if (!baseline) {
    return baseOptions;
  }

  const duration = __ENV.BASELINE_DURATION || '5m';
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

export function recordHeavyEndpoint(response, meta) {
  const { endpoint, sloMs = 10000, logEachResponse = false } = meta;
  const tags = { endpoint };

  recordResponse(response, { logEachResponse });

  const ms = response.timings.duration;
  const bytes =
    response.body && typeof response.body === 'string'
      ? response.body.length
      : 0;

  heavyDuration.add(ms, tags);
  heavyBytes.add(bytes, tags);

  if (ms >= 5000) {
    heavySlow5s.add(1, tags);
  }
  if (ms >= 10000) {
    heavySlow10s.add(1, tags);
  }

  const ok = response.status === 200 && ms < sloMs;
  if (!ok) {
    heavyCheckFail.add(1, tags);
    if (response.status !== 200) {
      console.warn(
        `PMS A2 | ${endpoint} | HTTP ${response.status} | ${Math.round(ms)}ms`
      );
    } else {
      console.warn(
        `PMS A2 | ${endpoint} | SLOW ${Math.round(ms)}ms (limit ${sloMs}ms)`
      );
    }
  }

  return { ms, bytes, ok };
}

function metricTaggedTrend(data, metricName, field) {
  const out = [];
  const re = new RegExp(`^${metricName}\\{endpoint:(.+)\\}$`);
  for (const [key, m] of Object.entries(data.metrics || {})) {
    const match = key.match(re);
    if (!match || !m?.values) {
      continue;
    }
    const val = m.values[field];
    if (typeof val === 'number') {
      out.push({ endpoint: match[1], value: val });
    }
  }
  out.sort((a, b) => b.value - a.value);
  return out;
}

function metricCount(data, name) {
  const m = data.metrics?.[name];
  return typeof m?.values?.count === 'number' ? m.values.count : 0;
}

export function analyzeHeavyProject(data, ctx) {
  const p95ByEndpoint = metricTaggedTrend(data, 'pms_heavy_duration', 'p(95)');
  const maxBytes = metricTaggedTrend(data, 'pms_heavy_bytes', 'max');
  const slow5 = metricCount(data, 'pms_heavy_slow_5s');
  const slow10 = metricCount(data, 'pms_heavy_slow_10s');
  const checkFails = metricCount(data, 'pms_heavy_check_fail');

  const worstLatency = p95ByEndpoint[0] || null;
  const largestPayload = maxBytes[0] || null;

  let verdict = 'HEALTHY';
  if (slow10 > 0 || (worstLatency && worstLatency.value >= 10000)) {
    verdict = 'DATA_VOLUME_STRESSED';
  } else if (slow5 > 0 || checkFails > 0) {
    verdict = 'DEGRADED';
  }

  let headline = `Seeded project id=${ctx.projectId}: within SLO under this load.`;
  let detail = '';

  if (worstLatency) {
    headline = `Slowest: "${worstLatency.endpoint}" p95 ≈ ${Math.round(worstLatency.value)}ms.`;
    if (verdict === 'DATA_VOLUME_STRESSED') {
      detail =
        'One or more APIs exceeded 10s — check backlog/board/epics queries and pagination.';
    } else if (verdict === 'DEGRADED') {
      detail = `${slow5} responses ≥5s — data volume stress before rate limits.`;
    }
  }

  if (largestPayload) {
    detail +=
      (detail ? ' ' : '') +
      `Largest payload: "${largestPayload.endpoint}" ~${Math.round(largestPayload.value / 1024)} KB.`;
  }

  const actions = [];
  if (worstLatency && worstLatency.value >= 5000) {
    actions.push({
      priority: 'high',
      area: worstLatency.endpoint,
      issue: `p95 ~${Math.round(worstLatency.value)}ms`,
      fix: 'Add pagination / indexes on this screen.',
    });
  }
  if (checkFails > 0 && actions.length === 0) {
    actions.push({
      priority: 'medium',
      area: 'SLO',
      issue: `${checkFails} failed checks`,
      fix: 'See per-endpoint table in report.',
    });
  }
  if (actions.length === 0) {
    actions.push({
      priority: 'low',
      area: 'Capacity',
      issue: 'No major breakage',
      fix: 'Increase VUs or SEED_PROFILE=large and re-test.',
    });
  }

  return {
    verdict,
    headline,
    detail,
    slow5,
    slow10,
    checkFails,
    p95ByEndpoint,
    maxBytes,
    actions,
  };
}

export function formatHeavyProjectPlain(data, ctx) {
  const a = analyzeHeavyProject(data, ctx);
  const lines = [
    '',
    '=== APPROACH 2 — HEAVY PROJECT SUMMARY ===',
    `Project id: ${ctx.projectId}`,
    ctx.moduleDescription || '',
    '',
    `VERDICT: ${a.verdict}`,
    a.headline,
    a.detail,
    '',
    `≥5s:  ${a.slow5}`,
    `≥10s: ${a.slow10}`,
    `SLO fails: ${a.checkFails}`,
    '',
  ];

  if (a.p95ByEndpoint.length) {
    lines.push('p95 by endpoint:');
    for (const row of a.p95ByEndpoint.slice(0, 12)) {
      lines.push(`  ${row.endpoint}: ${Math.round(row.value)}ms`);
    }
    lines.push('');
  }

  lines.push('ACTIONS:');
  a.actions.forEach((x, i) => {
    lines.push(`${i + 1}. [${x.priority}] ${x.area}: ${x.fix}`);
  });

  return lines.filter(Boolean).join('\n');
}
