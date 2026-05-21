import { analyzeHeavyProject } from './heavy-project-tracker.js';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Inserts approach-2 data-volume panel into k6 HTML report. */
export function injectHeavyProjectHtml(html, data, ctx) {
  const h = analyzeHeavyProject(data, ctx);

  const latencyRows = h.p95ByEndpoint
    .slice(0, 10)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.endpoint)}</td><td>${Math.round(r.value)} ms</td></tr>`
    )
    .join('');

  const sizeRows = h.maxBytes
    .slice(0, 10)
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.endpoint)}</td><td>${Math.round(r.value / 1024)} KB</td></tr>`
    )
    .join('');

  const actionRows = h.actions
    .map(
      (x) => `<tr>
        <td>${escapeHtml(x.priority)}</td>
        <td>${escapeHtml(x.area)}</td>
        <td>${escapeHtml(x.issue)}</td>
        <td>${escapeHtml(x.fix)}</td>
      </tr>`
    )
    .join('');

  const section = `
<section class="pms-a2" style="font-family:system-ui;margin:1.5rem 0;padding:1rem;border:2px solid #c4b5fd;border-radius:12px;background:#faf5ff">
  <h2 style="margin:0 0 0.5rem">Approach 2 — heavy project (seeded data)</h2>
  <p><strong>Project ${escapeHtml(ctx.projectId)}</strong> — ${escapeHtml(h.verdict)}</p>
  <p>${escapeHtml(h.headline)}</p>
  ${h.detail ? `<p>${escapeHtml(h.detail)}</p>` : ''}
  <p>≥5s: <strong>${h.slow5}</strong> | ≥10s: <strong>${h.slow10}</strong> | SLO fails: <strong>${h.checkFails}</strong></p>
  ${latencyRows ? `<h3>p95 latency</h3><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th>Screen</th><th>p95</th></tr>${latencyRows}</table>` : ''}
  ${sizeRows ? `<h3>Max payload</h3><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th>Screen</th><th>Size</th></tr>${sizeRows}</table>` : ''}
  <h3>Actions</h3>
  <table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">
    <tr><th>Priority</th><th>Area</th><th>Issue</th><th>Fix</th></tr>
    ${actionRows}
  </table>
</section>`;

  const anchor = '<div class="content">';
  if (html.includes('<div class="content">')) {
    return html.replace('<div class="content">', `<div class="content">\n${section}\n`);
  }
  return section + html;
}
