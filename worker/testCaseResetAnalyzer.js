// worker/testCaseResetAnalyzer.js
// Worker for processing traces that are related to test case resets (marked by X-Reset-Test-Case header)

import { createClient } from '@clickhouse/client';
import testCaseController from '../controller/testcases/testCaseController.js';
import dotenv from 'dotenv';
dotenv.config();

const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

export const POLL_INTERVAL_MS = parseInt(process.env.AUTO_FEATURE_ANALYZER_INTERVAL_MS || '30000');
const STABILITY_THRESHOLD_SECONDS = parseInt(process.env.AUTO_FEATURE_ANALYZER_STABILITY_SECONDS || '60');
const ENABLED = process.env.AUTO_FEATURE_ANALYZER_ENABLED !== 'false';

let isProcessing = false;

// Get traces with reset marker that are stable (no updates for 60+ seconds)
async function getResetTraces() {
  const query = `
    SELECT t.id, t.metadata, t.timestamp
    FROM traces t
    WHERE t.is_deleted = 0
      AND has(mapKeys(t.metadata), 'testCaseId')
      AND has(mapKeys(t.metadata), 'testCaseRunRecordId')
      AND t.timestamp < NOW() - INTERVAL ${STABILITY_THRESHOLD_SECONDS} SECOND
      AND (t.metadata['reset_processed'] IS NULL OR t.metadata['reset_processed'] = '0')
    ORDER BY t.timestamp ASC
    LIMIT 20
  `;
  const result = await clickhouseClient.query({ query });
  const data = await result.json();
  return data?.data || [];
}

// Process a single reset trace
async function processResetTrace(trace) {
  try {
    const testCaseId = trace.metadata?.testCaseId;
    if (!testCaseId || isNaN(Number(testCaseId))) {
      console.warn(`Trace ${trace.id} has invalid or missing testCaseId, skipping.`);
      return;
    }
    const testCaseRunRecordId = trace.metadata?.testCaseRunRecordId;
    if (!testCaseRunRecordId || isNaN(Number(testCaseRunRecordId))) {
      console.warn(`Trace ${trace.id} has invalid or missing testCaseRunRecordId, skipping.`);
      return;
    }

    console.log(`Processing reset trace ${trace.id} for test case ${testCaseId}, run record ${testCaseRunRecordId}`);

    // Mark trace as processed to avoid reprocessing
    await clickhouseClient.query({
      query: `ALTER TABLE traces UPDATE metadata = mapUpdate(metadata, map('reset_processed', '1')) WHERE id = '${trace.id}'`
    });

    // Create TestCaseRun and TestCaseRunAICall from the trace
    // This creates a new run record that can be used to generate drafts for review
    const result = await testCaseController.createTestCaseRunFromTrace({
      testCaseId: Number(testCaseId),
      traceId: trace.id,
      testCaseRunRecordId: Number(testCaseRunRecordId),
      createdBy: 0 // System user
    });

    if (result.success) {
      console.log(`✓ Processed reset trace ${trace.id}:`);
      console.log(`  - Created TestCaseRun: ${result.testCaseRunId}`);
      console.log(`  - Created ${result.aiCallsCreated} TestCaseRunAICall entries`);
      console.log(`  - Test case: ${testCaseId}`);
      console.log(`  - Run record: ${testCaseRunRecordId}`);
    } else {
      console.error(`✗ Failed to process reset trace ${trace.id}`);
    }
  } catch (err) {
    console.error(`✗ Error processing reset trace ${trace.id}:`, err.message || err);
  }
}

// Main processing function
async function processResetTraces() {
  if (isProcessing) return;
  if (!ENABLED) return;
  try {
    isProcessing = true;
    const traces = await getResetTraces();
    if (traces.length === 0) return;
    for (const trace of traces) {
      await processResetTrace(trace);
    }
  } catch (err) {
    console.error('Error in processResetTraces:', err);
  } finally {
    isProcessing = false;
  }
}

// Worker loop entry point
export async function workerLoop() {
  await processResetTraces();
}

// Start the worker
export function startTestCaseResetAnalyzer() {
  if (!ENABLED) {
    console.log('Test Case Reset Analyzer: DISABLED');
    return;
  }
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Test Case Reset Analyzer Worker Started  ║');
  console.log('╚════════════════════════════════════════════╝');
  setInterval(workerLoop, POLL_INTERVAL_MS);
  setTimeout(() => {
    console.log('🚀 Running initial reset analysis...');
    workerLoop();
  }, 5000);
}
