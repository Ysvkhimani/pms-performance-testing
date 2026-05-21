import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {
  formatBreakingInsightsPlain,
  injectBreakingInsightsHtml,
} from '../../scripts/lib/report-breaking-html.js';
import { formatHeavyProjectPlain } from './heavy-project-tracker.js';
import { injectHeavyProjectHtml } from './heavy-project-report-html.js';

function buildTimestamp() {
  const date = new Date();
  return (
    `${date.getFullYear()}-` +
    `${String(date.getMonth() + 1).padStart(2, '0')}-` +
    `${String(date.getDate()).padStart(2, '0')}-` +
    `${String(date.getHours()).padStart(2, '0')}-` +
    `${String(date.getMinutes()).padStart(2, '0')}-` +
    `${String(date.getSeconds()).padStart(2, '0')}`
  );
}

export function buildApproach2SummaryOutputs(data, ctx) {
  const timestamp = buildTimestamp();
  const htmlFile = `${ctx.filePrefix}-${timestamp}.html`;
  const txtFile = `${ctx.filePrefix}-${timestamp}-heavy-summary.txt`;

  const basePlain = formatBreakingInsightsPlain(data, ctx);
  const heavyPlain = formatHeavyProjectPlain(data, ctx);
  const fullText = basePlain + heavyPlain;

  console.log(fullText);
  console.log(`\n[Approach 2] Report: approach2/reports/${htmlFile}\n`);

  let html = injectBreakingInsightsHtml(htmlReport(data), data, ctx);
  html = injectHeavyProjectHtml(html, data, ctx);

  return {
    stdout:
      textSummary(data, { indent: ' ', enableColors: false }) +
      '\n\n' +
      fullText +
      '\n',
    [`approach2/reports/${htmlFile}`]: html,
    [`approach2/reports/${txtFile}`]: fullText,
  };
}
