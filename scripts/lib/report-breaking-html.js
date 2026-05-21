import { analyzeRateLimit, formatFirst429Summary } from './rate-limit-tracker.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pctBar(pctStr, tone) {
  const n = parseFloat(pctStr);
  const w = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0;
  return `<div class="pms-bar pms-bar--${tone}"><span style="width:${w}%"></span></div>`.replace(
    /<\/?motion>/g,
    ''
  );
}

function verdictMeta(verdict) {
  const map = {
    RATE_LIMITED: ['bad', 'Rate limited', 'Gateway returned many 429 responses under load.'],
    AUTH_ISSUES: ['bad', 'Authentication problems', 'Fix token before measuring capacity.'],
    PERMISSION_ISSUES: ['warn', 'Permission issues', '403 on one or more endpoints — role or project access.'],
    MIXED: ['warn', 'Mixed issues', 'Review 401, 403, and 429 sections below.'],
    HEALTHY: ['ok', 'No major breakage', 'Mostly successful responses; increase load to find limits.'],
  };
  return map[verdict] || ['warn', verdict, ''];
}

export function formatBreakingInsightsPlain(data, ctx) {
  const a = analyzeRateLimit(data);
  return [
    '',
    '=== PMS LOAD TEST — DEVELOPER SUMMARY ===',
    `Module: ${ctx.scriptLabel}`,
    ctx.moduleDescription || '',
    '',
    `VERDICT: ${a.verdict}`,
    a.first429Headline,
    a.first429Detail,
    '',
    `200 OK: ${a.c200} (${a.pct200})`,
    `429:    ${a.c429} (${a.pct429})`,
    `401:    ${a.c401}`,
    `403:    ${a.c403}`,
    '',
    'ACTIONS:',
    ...a.actions.map((x, i) => `${i + 1}. [${x.priority}] ${x.area} — ${x.fix}`),
    '',
    formatFirst429Summary(data, ctx),
  ]
    .filter(Boolean)
    .join('\n');
}

export function injectBreakingInsightsHtml(html, data, ctx) {
  const a = analyzeRateLimit(data);
  const [tone, verdictTitle, verdictSub] = verdictMeta(a.verdict);

  const actionRows = a.actions
    .map(
      (x) => `<tr>
        <td><span class="pms-pri pms-pri--${escapeHtml(x.priority)}">${escapeHtml(x.priority)}</span></td>
        <td>${escapeHtml(x.area)}</td>
        <td>${escapeHtml(x.issue)}</td>
        <td>${escapeHtml(x.fix)}</td>
      </tr>`
    )
    .join('');

  const endpointList = (ctx.endpoints || [])
    .map((e) => `<li><code>${escapeHtml(e)}</code></li>`)
    .join('');

  const rateLimitTable =
    a.c429 > 0 && a.reliableSeq != null
      ? `<table class="pms-table">
          <thead><tr><th>Metric</th><th>Value</th><th>How to read it</th></tr></thead>
          <tbody>
            <tr><td>Earliest VU first 429 (approx.)</td><td>~request #${Math.round(a.reliableSeq)}</td><td>That virtual user’s own request counter</td></tr>
            <tr><td>Latest VU first 429 (approx.)</td><td>~request #${a.seqMax != null ? Math.round(a.seqMax) : '—'}</td><td>VU that ran longest before limit</td></tr>
            <tr><td>429 share of all traffic</td><td>${escapeHtml(a.pct429)}</td><td>${a.c429.toLocaleString()} of ${a.total.toLocaleString()} HTTP responses</td></tr>
          </tbody>
        </table>`
      : '<p class="pms-muted">No 429 in this run — increase VUs or duration to trigger rate limits.</p>';

  const plainText = formatBreakingInsightsPlain(data, ctx);

  const section = `
<style>
  .pms-dev { font-family: Inter, system-ui, sans-serif; margin-bottom: 2rem; }
  .pms-verdict { border-radius: 12px; padding: 1.25rem 1.5rem; margin: 1rem 0 1.25rem; border: 1px solid #e2e8f0; }
  .pms-verdict--bad { background: linear-gradient(135deg, #fef2f2, #fff); border-color: #fecaca; }
  .pms-verdict--warn { background: linear-gradient(135deg, #fffbeb, #fff); border-color: #fde68a; }
  .pms-verdict--ok { background: linear-gradient(135deg, #f0fdf4, #fff); border-color: #bbf7d0; }
  .pms-verdict h2 { margin: 0 0 0.35rem; font-size: 1.35rem; color: #0f172a; }
  .pms-verdict p { margin: 0.25rem 0 0; color: #475569; font-size: 0.95rem; line-height: 1.5; }
  .pms-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; }
  .pms-kpi { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; text-align: center; }
  .pms-kpi .val { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
  .pms-kpi .lbl { font-size: 0.75rem; color: #64748b; margin-top: 0.25rem; text-transform: uppercase; }
  .pms-kpi--ok .val { color: #15803d; }
  .pms-kpi--bad .val { color: #b91c1c; }
  .pms-panel { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 1rem; }
  .pms-panel h3 { margin: 0 0 0.75rem; font-size: 1rem; color: #1e293b; }
  .pms-panel p { margin: 0 0 0.5rem; font-size: 0.9rem; color: #334155; line-height: 1.55; }
  .pms-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  .pms-table th, .pms-table td { border: 1px solid #e2e8f0; padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; }
  .pms-table th { background: #f1f5f9; font-weight: 600; }
  .pms-bar { height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden; margin: 0.35rem 0 0.75rem; }
  .pms-bar span { display: block; height: 100%; border-radius: 4px; }
  .pms-bar--ok span { background: #22c55e; }
  .pms-bar--warn span { background: #f59e0b; }
  .pms-bar--bad span { background: #ef4444; }
  .pms-stat-row { display: flex; justify-content: space-between; font-size: 0.85rem; margin-bottom: 0.15rem; }
  .pms-pri { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; padding: 0.15rem 0.4rem; border-radius: 4px; }
  .pms-pri--high { background: #fee2e2; color: #991b1b; }
  .pms-pri--medium { background: #ffedd5; color: #9a3412; }
  .pms-pri--low { background: #dbeafe; color: #1e40af; }
  .pms-endpoints { margin: 0.35rem 0 0 1.1rem; font-size: 0.85rem; }
  .pms-muted { color: #64748b; font-size: 0.8rem; margin-top: 0.5rem; }
  .pms-details {
    margin-top: 0.5rem; border: 1px solid #e2e8f0; border-radius: 10px;
    padding: 0.65rem 0.9rem; background: #f8fafc;
  }
  .pms-details summary {
    cursor: pointer; font-weight: 600; color: #1e40af; font-size: 0.9rem;
    list-style-position: outside;
  }
  .pms-details summary:hover { color: #1d4ed8; }
  .pms-details pre {
    margin: 0.75rem 0 0.15rem 0; white-space: pre-wrap; word-break: break-word;
    font-size: 0.78rem; line-height: 1.5; color: #334155;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 8px;
    padding: 0.75rem 0.85rem; max-height: 420px; overflow: auto;
  }
</style>
<section class="pms-dev">
  <div class="pms-verdict pms-verdict--${tone}">
    <h2>${escapeHtml(verdictTitle)}</h2>
    <p>${escapeHtml(verdictSub)}</p>
    <p><strong>Module:</strong> ${escapeHtml(ctx.scriptLabel)}
      ${a.durationSec != null ? ` | <strong>Duration:</strong> ~${a.durationSec}s` : ''}
      | <strong>Total requests:</strong> ${a.total.toLocaleString()}</p>
  </div>
  <div class="pms-kpis">
    <div class="pms-kpi pms-kpi--ok"><div class="val">${a.c200.toLocaleString()}</div><div class="lbl">200 OK (${escapeHtml(a.pct200)})</div></div>
    <div class="pms-kpi pms-kpi--bad"><div class="val">${a.c429.toLocaleString()}</div><div class="lbl">429 (${escapeHtml(a.pct429)})</div></div>
    <div class="pms-kpi"><div class="val">${a.c401.toLocaleString()}</div><div class="lbl">401</div></div>
    <div class="pms-kpi"><div class="val">${a.c403.toLocaleString()}</div><div class="lbl">403</div></div>
  </div>
  <div class="pms-panel">
    <h3>When did rate limiting start?</h3>
    <p><strong>${escapeHtml(a.first429Headline)}</strong></p>
    ${a.first429Detail ? `<p>${escapeHtml(a.first429Detail)}</p>` : ''}
    ${rateLimitTable}
  </div>
  <div class="pms-panel">
    <h3>HTTP status breakdown</h3>
    <div class="pms-stat-row"><span>200 OK</span><strong>${a.c200.toLocaleString()} (${escapeHtml(a.pct200)})</strong></div>
    ${pctBar(a.pct200, 'ok')}
    <div class="pms-stat-row"><span>429 Too Many Requests</span><strong>${a.c429.toLocaleString()} (${escapeHtml(a.pct429)})</strong></div>
    ${pctBar(a.pct429, 'bad')}
    <div class="pms-stat-row"><span>401 Unauthorized</span><strong>${a.c401.toLocaleString()}</strong></div>
    ${pctBar(a.total > 0 ? ((a.c401 / a.total) * 100).toFixed(1) + '%' : '0%', 'warn')}
    <div class="pms-stat-row"><span>403 Forbidden</span><strong>${a.c403.toLocaleString()}</strong></div>
    ${pctBar(a.total > 0 ? ((a.c403 / a.total) * 100).toFixed(1) + '%' : '0%', 'warn')}
  </div>
  <div class="pms-panel">
    <h3>What should developers fix?</h3>
    <table class="pms-table">
      <thead><tr><th>Priority</th><th>Area</th><th>What we saw</th><th>Recommended action</th></tr></thead>
      <tbody>${actionRows}</tbody>
    </table>
  </div>
  ${endpointList ? `<div class="pms-panel"><h3>APIs tested</h3><ul class="pms-endpoints">${endpointList}</ul></div>` : ''}
  <details class="pms-details">
    <summary>Plain-text summary (same as .txt file) — click to expand</summary>
    <pre>${escapeHtml(plainText)}</pre>
  </details>
  <p class="pms-muted">Full k6 metrics (latency, checks, thresholds) are in the standard report tabs below.</p>
</section>`.replace(/<\/?motion>/g, '');

  const anchor = '<div class="content">';
  if (html.includes(anchor)) {
    return html.replace(anchor, `${anchor}\n${section}\n`);
  }
  return section + '\n' + html;
}
