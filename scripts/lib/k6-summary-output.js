import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.1/index.js';
import { htmlReport } from 'https://raw.githubusercontent.com/benc-uk/k6-reporter/main/dist/bundle.js';
import {
  formatBreakingInsightsPlain,
  injectBreakingInsightsHtml,
} from './report-breaking-html.js';

/** planning-module-2026-05-15-12-29-09.html */
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

/**
 * @param {import('k6/data').SummaryData} data
 * @param {{ scriptLabel: string, filePrefix: string, moduleDescription?: string, endpoints?: string[] }} ctx
 */
export function buildK6SummaryOutputs(data, ctx) {
  const timestamp = buildTimestamp();
  const htmlFile = `${ctx.filePrefix}-${timestamp}.html`;
  const txtFile = `${ctx.filePrefix}-${timestamp}-429-summary.txt`;
  const fullText = formatBreakingInsightsPlain(data, ctx);

  console.log(fullText);
  console.log(`\n[PMS] Report: reports/${htmlFile}\n`);

  const html = injectBreakingInsightsHtml(htmlReport(data), data, ctx);

  return {
    stdout:
      textSummary(data, { indent: ' ', enableColors: false }) +
      '\n\n' +
      fullText +
      '\n',
    [`reports/${htmlFile}`]: html,
    [`reports/${txtFile}`]: fullText,
  };
}
