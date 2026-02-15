// worker/autoFeatureAnalyzer.js
// Automated worker for analyzing traces without feature_id
// Checks for traces that are stable (no updates for 60+ seconds) and automatically categorizes them

import { createClient } from '@clickhouse/client';
import { analyzeTraceFeature } from '../controller/features/features.js';
// import { analyzePromptDrift } from '../controller/traceAnalysis/traceAnalysisController.js';
import { pool } from '../postgres.js';
import dotenv from 'dotenv';
dotenv.config();

const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

// Configuration
export const POLL_INTERVAL_MS = parseInt(process.env.AUTO_FEATURE_ANALYZER_INTERVAL_MS || '30000');
const STABILITY_THRESHOLD_SECONDS = parseInt(process.env.AUTO_FEATURE_ANALYZER_STABILITY_SECONDS || '60');
const BATCH_SIZE = parseInt(process.env.AUTO_FEATURE_ANALYZER_BATCH_SIZE || '3');
const ENABLED = process.env.AUTO_FEATURE_ANALYZER_ENABLED !== 'false';

let isProcessing = false;

// Get traces without feature_id that are stable (no updates for 60+ seconds)
async function getUnanalyzedTraces(limit = BATCH_SIZE) {
  // console.log('Querying for unanalyzed traces...');

  try {
    // First, get traces without feature_id
    const query = `
      SELECT t.id, t.project_id, t.metadata, t.timestamp
      FROM traces t
      WHERE t.is_deleted = 0
        AND NOT has(mapKeys(t.metadata), 'feature_id')
        AND t.timestamp < NOW() - INTERVAL ${STABILITY_THRESHOLD_SECONDS} SECOND
        AND EXISTS (
          SELECT 1 FROM observations o
          WHERE o.trace_id = t.id
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') != ''
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') != ''
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') != ''
            AND o.name != 'handleChatRequest'
        )
      ORDER BY t.timestamp DESC
      LIMIT ${limit}
    `;

    const result = await clickhouseClient.query({ query });
    const data = await result.json();
    const traces = data?.data || [];

    if (traces.length === 0) {
      return [];
    }

    // For each trace, check if it has valid observations and is stable
    const stableTraces = [];
    for (const trace of traces) {
      try {
        // Only check for stability now
        const obsQuery = `
          SELECT MAX(o.updated_at) as latest_update
          FROM observations o
          WHERE o.trace_id = '${trace.id}'
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') != ''
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') != ''
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') IS NOT NULL
            AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') != ''
            AND o.name != 'handleChatRequest'
        `;

        const obsResult = await clickhouseClient.query({ query: obsQuery });
        const obsData = await obsResult.json();
        const latestUpdate = obsData?.data?.[0]?.latest_update;

        if (!latestUpdate) {
          // Should not happen due to initial filter, but skip just in case
          continue;
        }

        const now = new Date();
        const updateTime = new Date(latestUpdate);
        const secondsSinceUpdate = (now - updateTime) / 1000;

        if (secondsSinceUpdate >= STABILITY_THRESHOLD_SECONDS) {
          stableTraces.push(trace);
        }
      } catch (err) {
        console.error(`Error checking stability for trace ${trace.id}:`, err);
      }
    }

    return stableTraces;
  } catch (err) {
    console.error('Error querying unanalyzed traces:', err);
    return [];
  }
}

// Process a single trace
async function processTrace(trace) {
  try {
    console.log(`\n=== Auto-analyzing trace: ${trace.id} ===`);
    console.log(`Project ID: ${trace.project_id}`);
    console.log(`Timestamp: ${trace.timestamp}`);

    // Step 1: Trigger feature analysis
    const result = await analyzeTraceFeature(trace.id);

    console.log(`✓ Feature analysis completed for trace ${trace.id}:`);
    console.log(`  - Feature ID: ${result.feature.id}`);
    console.log(`  - Feature Name: ${result.feature.feature_name}`);
    console.log(`  - Is New Feature: ${result.isNewFeature ? 'YES' : 'NO'}`);

    // // Step 2: Trigger drift analysis (Phase 3 integration)
    // try {
    //   console.log(`\n🔍 Starting prompt drift analysis for trace ${trace.id}...`);

    //   // Get full trace with observations for drift analysis
    //   const { getTraceDetail } = await import('../controller/traces.js');
    //   const fullTrace = await getTraceDetail({ id: trace.id, userId: 0 });

    //   if (!fullTrace) {
    //     console.log(`⚠️  Could not fetch full trace details for ${trace.id}, skipping drift analysis`);
    //   } else {
    //     // Run drift analysis
    //     const driftResult = await analyzePromptDrift(fullTrace, result.feature.id, 0);

    //     if (driftResult.success) {
    //       console.log(`✓ Drift analysis completed for trace ${trace.id}:`);
    //       console.log(`  - Fingerprint: ${driftResult.fingerprint.substring(0, 16)}...`);
    //       console.log(`  - Classification: ${driftResult.classification}`);
    //       console.log(`  - Root Cause: ${driftResult.rootCause}`);
    //       console.log(`  - Confidence: ${(driftResult.confidenceScore * 100).toFixed(0)}%`);

    //       if (driftResult.summary.fingerprint_changed) {
    //         console.log(`  ⚠️  Fingerprint changed from previous version`);
    //       }

    //       if (driftResult.summary.risk_flagged) {
    //         console.log(`  🚨 Feature marked with prompt_changed_risk flag`);
    //       }

    //       if (driftResult.summary.is_first_occurrence) {
    //         console.log(`  ℹ️  First occurrence of this feature (no previous fingerprint)`);
    //       }
    //     } else {
    //       console.log(`⚠️  Drift analysis failed for trace ${trace.id}: ${driftResult.error}`);
    //     }
    //   }
    // } catch (driftErr) {
    //   console.error(`✗ Error during drift analysis for trace ${trace.id}:`, driftErr.message || driftErr);
    //   // Don't fail the entire process if drift analysis fails
    //   console.log(`  Continuing with feature analysis only...`);
    // }

    // Step 3: Test case reset logic integration
    const meta = trace.metadata || {};
    const resetTestCaseId = meta.reset_test_case_id;
    if (resetTestCaseId && !isNaN(Number(resetTestCaseId))) {
      try {
        // Mark trace as processed for reset
        await clickhouseClient.query({
          query: `ALTER TABLE traces UPDATE metadata = mapUpdate(metadata, map('reset_processed', '1')) WHERE id = '${trace.id}'`
        });
        // Update the test case to link to this trace
        await pool.query(
          `UPDATE TestCases SET trace_id = $1, updated_at = NOW() WHERE id = $2 AND deleted = FALSE`,
          [trace.id, resetTestCaseId]
        );
        console.log(`✓ Processed reset trace ${trace.id} for test case ${resetTestCaseId}`);
      } catch (err) {
        console.error(`✗ Error processing reset trace ${trace.id}:`, err.message || err);
      }
    }

    console.log(`✅ Complete analysis finished for trace ${trace.id}`);
    return result;
  } catch (err) {
    console.error(`✗ Error auto-analyzing trace ${trace.id}:`, err.message || err);
    // Don't throw - continue processing other traces
  }
}

// Main processing function
async function processUnanalyzedTraces() {
  if (isProcessing) {
    console.log('Auto Feature Analyzer: Already processing traces, skipping this cycle');
    return;
  }

  if (!ENABLED) {
    return;
  }

  try {
    isProcessing = true;
    // console.log('\n╔════════════════════════════════════════════╗');
    // console.log('║  Auto Feature Analyzer - Polling Cycle    ║');
    // console.log('╚════════════════════════════════════════════╝');

    const traces = await getUnanalyzedTraces();

    if (traces.length === 0) {
      // console.log('✓ No unanalyzed traces found');
      return;
    }

    console.log(`\n📊 Found ${traces.length} unanalyzed stable trace(s), processing...\n`);

    // Process traces sequentially
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < traces.length; i++) {
      const trace = traces[i];
      console.log(`[${i + 1}/${traces.length}] Processing trace ${trace.id}...`);

      const result = await processTrace(trace);

      if (result) {
        successCount++;
      } else {
        failCount++;
      }

      // Small delay between traces to avoid overwhelming the system
      if (i < traces.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('\n╔════════════════════════════════════════════╗');
    console.log(`║  Batch Complete: ${successCount} success, ${failCount} failed  ║`);
    console.log('╚════════════════════════════════════════════╝\n');

  } catch (err) {
    console.error('Error in processUnanalyzedTraces:', err);
  } finally {
    isProcessing = false;
  }
}

// Worker loop entry point
export async function workerLoop() {
  await processUnanalyzedTraces();
}

// Start the worker
export function startAutoFeatureAnalyzer() {
  if (!ENABLED) {
    console.log('Auto Feature Analyzer: DISABLED (set AUTO_FEATURE_ANALYZER_ENABLED=true to enable)');
    return;
  }

  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   Auto Feature Analyzer Worker Started    ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log(`⚙️  Configuration:`);
  console.log(`   - Polling interval: ${POLL_INTERVAL_MS}ms (${POLL_INTERVAL_MS / 1000}s)`);
  console.log(`   - Stability threshold: ${STABILITY_THRESHOLD_SECONDS}s`);
  console.log(`   - Batch size: ${BATCH_SIZE} traces per cycle`);
  console.log(`   - Enabled: ${ENABLED}`);
  console.log('');

  // Sequential worker loop using setTimeout
  async function sequentialWorkerLoop() {
    await workerLoop();
    setTimeout(sequentialWorkerLoop, 5000); // Wait 5 seconds after completion
  }

  // Run immediately on start after 5 seconds
  setTimeout(() => {
    console.log('🚀 Running initial analysis...');
    sequentialWorkerLoop();
  }, 5000);
}
