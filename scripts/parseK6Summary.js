const fs = require('fs');
const path = require('path');

const SUMMARY_JSON_PATH = path.join(__dirname, '../summary.json');
const REPORT_MD_PATH = path.join(__dirname, '../reports/load-test-summary.md');

// Defensive metric parser helper
function getMetricValue(metricObj, key) {
  if (!metricObj) return null;

  if (
    metricObj.values &&
    Object.prototype.hasOwnProperty.call(metricObj.values, key)
  ) {
    return metricObj.values[key];
  }

  if (
    Object.prototype.hasOwnProperty.call(metricObj, key)
  ) {
    return metricObj[key];
  }

  return null;
}

function parseSummary() {
  console.log(`Reading k6 summary from: ${SUMMARY_JSON_PATH}`);
  if (!fs.existsSync(SUMMARY_JSON_PATH)) {
    console.error('ERROR: summary.json file not found. Make sure the k6 run completed successfully.');
    process.exit(1);
  }

  const rawData = fs.readFileSync(SUMMARY_JSON_PATH, 'utf8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error('ERROR: Failed to parse summary.json as JSON:', err.message);
    process.exit(1);
  }

  // Helper to format values
  const formatNum = (val, fixed = 2) => val !== null && val !== undefined ? val.toFixed(fixed) : 'N/A';
  const formatMs = (val) => val !== null && val !== undefined ? `${val.toFixed(1)} ms` : 'N/A';
  const formatPct = (val) => val !== null && val !== undefined ? `${(val * 100).toFixed(2)}%` : 'N/A';

  // Extract metrics defensively
  const httpReqs = data.metrics.http_reqs || {};
  const httpReqDuration = data.metrics.http_req_duration || {};
  const httpReqFailed = data.metrics.http_req_failed || {};
  const checks = data.metrics.checks || {};
  const vus = data.metrics.vus || {};

  // Latencies
  const avgLatency = getMetricValue(httpReqDuration, 'avg');
  const minLatency = getMetricValue(httpReqDuration, 'min');
  const maxLatency = getMetricValue(httpReqDuration, 'max');
  const medLatency = getMetricValue(httpReqDuration, 'med');
  const p90Latency = getMetricValue(httpReqDuration, 'p(90)');
  const p95Latency = getMetricValue(httpReqDuration, 'p(95)');
  const p99Latency = getMetricValue(httpReqDuration, 'p(99)');

  // Throughput and counts
  const totalReqs = getMetricValue(httpReqs, 'count');
  const rps = getMetricValue(httpReqs, 'rate');
  const failRate = getMetricValue(httpReqFailed, 'value') || getMetricValue(httpReqFailed, 'rate') || 0;
  
  // Checks
  const checksPass = getMetricValue(checks, 'passes') || 0;
  const checksFail = getMetricValue(checks, 'fails') || 0;
  const checksTotal = checksPass + checksFail;
  const checksRate = checksTotal > 0 ? checksPass / checksTotal : 1.0;

  // Load
  const activeVus = getMetricValue(vus, 'value') || 100;
  const maxVus = getMetricValue(vus, 'max') || 100;

  // Threshold evaluations
  const passFailText = (isPassed) => isPassed ? '🟢 PASS' : '🔴 FAIL';
  const thresholdFailRatePassed = failRate < 0.05;
  const thresholdP95Passed = p95Latency === null || p95Latency < 1500;
  const thresholdChecksPassed = checksRate > 0.95;

  // Build Markdown Summary
  const md = [
    `# 📊 CharityAI Backend Load Test Report`,
    '',
    `## ⚙️ Test Configuration`,
    '',
    `| Parameter | Value |`,
    `|---|---|`,
    `| **Target Backend** | CharityAI Production API |`,
    `| **Virtual Users (VUs)** | ${activeVus} (Max: ${maxVus}) |`,
    `| **Target Duration** | 1 minute |`,
    `| **Test Engine** | k6 Performance testing tool |`,
    '',
    `## 📈 Performance Summary`,
    '',
    `| Metric | Result |`,
    `|---|---|`,
    `| **Total HTTP Requests** | ${totalReqs || 'N/A'} |`,
    `| **Throughput (RPS)** | ${formatNum(rps)} reqs/sec |`,
    `| **Average Response Time** | ${formatMs(avgLatency)} |`,
    `| **Minimum Response Time** | ${formatMs(minLatency)} |`,
    `| **Maximum Response Time** | ${formatMs(maxLatency)} |`,
    `| **Median Response Time** | ${formatMs(medLatency)} |`,
    `| **p90 Response Time** | ${formatMs(p90Latency)} |`,
    `| **p95 Response Time** | ${formatMs(p95Latency)} |`,
    `| **p99 Response Time** | ${formatMs(p99Latency)} |`,
    `| **Request Failure Rate** | ${formatPct(failRate)} |`,
    `| **Check Success Rate** | ${formatPct(checksRate)} (${checksPass}/${checksTotal} passed) |`,
    '',
    `## 🛡️ Threshold Results`,
    '',
    `| Threshold Requirement | Target Constraint | Actual Metric | Status |`,
    `|---|---|---|---|`,
    `| **HTTP Error Rate** | < 5% | ${formatPct(failRate)} | ${passFailText(thresholdFailRatePassed)} |`,
    `| **p95 Response Latency** | < 1500 ms | ${formatMs(p95Latency)} | ${passFailText(thresholdP95Passed)} |`,
    `| **Successful API Checks** | > 95% | ${formatPct(checksRate)} | ${passFailText(thresholdChecksPassed)} |`,
    '',
    `---`,
    `*Report generated automatically on ${new Date().toLocaleString()}*`
  ].join('\n');

  // Save report locally
  const reportsDir = path.dirname(REPORT_MD_PATH);
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  fs.writeFileSync(REPORT_MD_PATH, md);
  console.log(`📝 Local Markdown Report saved to: ${REPORT_MD_PATH}`);

  // Publish to GitHub Actions Summary
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    try {
      fs.appendFileSync(summaryFile, md);
      console.log('📝 GitHub Step Summary published successfully.');
    } catch (err) {
      console.warn('⚠️ Failed to append summary to GITHUB_STEP_SUMMARY:', err.message);
    }
  }
}

parseSummary();
