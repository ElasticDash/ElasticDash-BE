import { pool } from '../../postgres.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

// =====================================================
// Configuration & Constants
// =====================================================

const STABLE_THRESHOLD = parseInt(process.env.PROMPT_STABLE_THRESHOLD) || 5;
const TIME_THRESHOLD_DAYS = parseInt(process.env.PROMPT_TIME_THRESHOLD_DAYS) || 7;

// =====================================================
// Core Hash Calculation Functions
// =====================================================

/**
 * Calculate SHA-256 hash for any content
 * @param {any} content - Content to hash (will be stringified if not string)
 * @returns {string} - 64-character hex hash
 */
function calculateHash(content) {
  let stringContent;

  if (typeof content === 'string') {
    stringContent = content;
  } else if (typeof content === 'object' && content !== null) {
    // Ensure deterministic JSON stringification by sorting keys
    stringContent = JSON.stringify(content, Object.keys(content).sort());
  } else {
    stringContent = String(content);
  }

  return crypto.createHash('sha256').update(stringContent, 'utf8').digest('hex');
}

/**
 * Extract and hash system messages from observations
 * @param {Array} observations - Array of observation objects
 * @returns {Object} - { systemHashes: [], combinedHash: string }
 */
export function calculateSystemHash(observations) {
  console.log('calculateSystemHash: Processing', observations.length, 'observations');

  const systemMessages = [];

  for (const obs of observations) {
    if (!obs.input) continue;

    let input = obs.input;

    // Parse input if it's a string
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input);
      } catch (e) {
        // Not JSON, skip
        continue;
      }
    }

    // Extract messages array
    const messages = input.messages || input;

    if (Array.isArray(messages)) {
      // Find system role messages
      const systemMsgs = messages.filter(msg => msg.role === 'system');
      systemMessages.push(...systemMsgs);
    }
  }

  if (systemMessages.length === 0) {
    console.log('calculateSystemHash: No system messages found');
    return { systemHashes: [], combinedHash: null };
  }

  // Hash each system message
  const systemHashes = systemMessages.map(msg => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return calculateHash(content);
  });

  // Create combined hash from all system hashes
  const combinedHash = calculateHash(systemHashes.join('|'));

  console.log(`calculateSystemHash: Found ${systemMessages.length} system messages, combined hash: ${combinedHash}`);

  return { systemHashes, combinedHash };
}

/**
 * Extract and hash user messages from observations
 * @param {Array} observations - Array of observation objects
 * @returns {Object} - { userHashes: [], combinedHash: string }
 */
export function calculateUserHash(observations) {
  console.log('calculateUserHash: Processing', observations.length, 'observations');

  const userMessages = [];

  for (const obs of observations) {
    if (!obs.input) continue;

    let input = obs.input;

    // Parse input if it's a string
    if (typeof input === 'string') {
      try {
        input = JSON.parse(input);
      } catch (e) {
        continue;
      }
    }

    // Extract messages array
    const messages = input.messages || input;

    if (Array.isArray(messages)) {
      // Find user role messages
      const userMsgs = messages.filter(msg => msg.role === 'user');
      userMessages.push(...userMsgs);
    }
  }

  if (userMessages.length === 0) {
    console.log('calculateUserHash: No user messages found');
    return { userHashes: [], combinedHash: null };
  }

  // Hash each user message
  const userHashes = userMessages.map(msg => {
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    return calculateHash(content);
  });

  // Create combined hash from all user hashes
  const combinedHash = calculateHash(userHashes.join('|'));

  console.log(`calculateUserHash: Found ${userMessages.length} user messages, combined hash: ${combinedHash}`);

  return { userHashes, combinedHash };
}

/**
 * Extract model parameters from observations
 * @param {Array} observations - Array of observation objects
 * @returns {Object} - { model, temperature, max_tokens, top_p, tools_enabled }
 */
export function extractModelParameters(observations) {
  console.log('extractModelParameters: Processing', observations.length, 'observations');

  // Use the first observation with model info
  for (const obs of observations) {
    if (obs.name || obs.model) {
      const params = {
        model: obs.name || obs.model || 'unknown',
        temperature: null,
        max_tokens: null,
        top_p: null,
        tools_enabled: false
      };

      // Try to extract from metadata
      if (obs.metadata) {
        const meta = typeof obs.metadata === 'string' ? JSON.parse(obs.metadata) : obs.metadata;

        if (meta.temperature !== undefined) params.temperature = meta.temperature;
        if (meta.max_tokens !== undefined) params.max_tokens = meta.max_tokens;
        if (meta.top_p !== undefined) params.top_p = meta.top_p;
        if (meta.tools || meta.functions) params.tools_enabled = true;
      }

      console.log('extractModelParameters: Extracted params:', params);
      return params;
    }
  }

  console.log('extractModelParameters: No model parameters found, using defaults');
  return {
    model: 'unknown',
    temperature: null,
    max_tokens: null,
    top_p: null,
    tools_enabled: false
  };
}

/**
 * Generate prompt fingerprint from system hash and model parameters
 * @param {string} combinedSystemHash - Combined system messages hash
 * @param {Object} modelParams - Model parameters
 * @returns {string} - Fingerprint hash
 */
export function calculatePromptFingerprint(combinedSystemHash, modelParams) {
  console.log('calculatePromptFingerprint: Generating fingerprint');

  if (!combinedSystemHash) {
    console.log('calculatePromptFingerprint: No system hash provided, returning null');
    return null;
  }

  // Create fingerprint input object (order matters for consistency)
  const fingerprintInput = {
    system_hash: combinedSystemHash,
    model: modelParams.model || 'unknown',
    temperature: modelParams.temperature,
    max_tokens: modelParams.max_tokens,
    top_p: modelParams.top_p,
    tools_enabled: modelParams.tools_enabled || false
  };

  const fingerprint = calculateHash(fingerprintInput);

  console.log('calculatePromptFingerprint: Generated fingerprint:', fingerprint);

  return fingerprint;
}

// =====================================================
// Database Operations - Hash Statistics
// =====================================================

/**
 * Update or insert hash statistics in PromptHashStats table
 * @param {string} hashValue - The hash value
 * @param {string} hashType - Type: 'system', 'user', 'combined', 'assistant'
 * @returns {Object} - Updated stats record
 */
export async function updatePromptHashStats(hashValue, hashType) {
  console.log(`updatePromptHashStats: Updating stats for ${hashType} hash:`, hashValue);

  if (!hashValue) {
    console.log('updatePromptHashStats: No hash value provided, skipping');
    return null;
  }

  try {
    // Try to update existing record
    const updateResult = await pool.query(
      `UPDATE PromptHashStats
       SET seen_count = seen_count + 1,
           last_seen_at = NOW(),
           updated_at = NOW()
       WHERE hash_value = $1 AND hash_type = $2
       RETURNING *`,
      [hashValue, hashType]
    );

    if (updateResult.rows.length > 0) {
      console.log(`updatePromptHashStats: Updated existing record, seen_count now: ${updateResult.rows[0].seen_count}`);
      return updateResult.rows[0];
    }

    // Insert new record if not exists
    const insertResult = await pool.query(
      `INSERT INTO PromptHashStats (hash_value, hash_type, seen_count, first_seen_at, last_seen_at)
       VALUES ($1, $2, 1, NOW(), NOW())
       RETURNING *`,
      [hashValue, hashType]
    );

    console.log('updatePromptHashStats: Created new record');
    return insertResult.rows[0];
  } catch (error) {
    console.error('updatePromptHashStats: Error updating hash stats:', error);
    throw error;
  }
}

/**
 * Get hash statistics for a specific hash
 * @param {string} hashValue - The hash value to query
 * @returns {Object|null} - Stats record or null
 */
export async function getPromptHashStats(hashValue) {
  console.log('getPromptHashStats: Querying stats for hash:', hashValue);

  try {
    const result = await pool.query(
      `SELECT * FROM PromptHashStats WHERE hash_value = $1`,
      [hashValue]
    );

    if (result.rows.length > 0) {
      console.log(`getPromptHashStats: Found stats, seen_count: ${result.rows[0].seen_count}`);
      return result.rows[0];
    }

    console.log('getPromptHashStats: No stats found');
    return null;
  } catch (error) {
    console.error('getPromptHashStats: Error querying hash stats:', error);
    throw error;
  }
}

// =====================================================
// Prompt Stability Classification
// =====================================================

/**
 * Classify prompt stability based on statistics
 * @param {number} seenCount - How many times the hash has been seen
 * @param {Date} firstSeenAt - First occurrence timestamp
 * @param {Date} lastSeenAt - Last occurrence timestamp
 * @returns {string} - Classification: 'stable_template', 'unstable', 'ad_hoc', 'pending'
 */
export function classifyPromptStability(seenCount, firstSeenAt, lastSeenAt) {
  console.log(`classifyPromptStability: seen_count=${seenCount}, first=${firstSeenAt}, last=${lastSeenAt}`);

  // Ad-hoc: seen only once
  if (seenCount === 1) {
    console.log('classifyPromptStability: Classification = ad_hoc (seen once)');
    return 'ad_hoc';
  }

  // Calculate time span in days
  const timeDiff = new Date(lastSeenAt) - new Date(firstSeenAt);
  const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

  // Stable: meets both count and time thresholds
  if (seenCount >= STABLE_THRESHOLD && daysDiff >= TIME_THRESHOLD_DAYS) {
    console.log(`classifyPromptStability: Classification = stable_template (count=${seenCount}, days=${daysDiff.toFixed(1)})`);
    return 'stable_template';
  }

  // Pending: needs more data
  if (seenCount < STABLE_THRESHOLD || daysDiff < TIME_THRESHOLD_DAYS) {
    console.log(`classifyPromptStability: Classification = pending (needs more data)`);
    return 'pending';
  }

  // Unstable: seen multiple times but not stable
  console.log('classifyPromptStability: Classification = unstable');
  return 'unstable';
}

// =====================================================
// Database Operations - Prompt Fingerprints
// =====================================================

/**
 * Update or insert prompt fingerprint record
 * @param {Object} params - Fingerprint parameters
 * @returns {Object} - Fingerprint record
 */
export async function upsertPromptFingerprint({
  featureId,
  promptFingerprint,
  combinedSystemHash,
  combinedUserHash,
  model,
  temperature,
  maxTokens,
  topP,
  toolsEnabled,
  createdBy = 0
}) {
  console.log('upsertPromptFingerprint: Upserting fingerprint:', promptFingerprint);

  try {
    // Check if fingerprint exists
    const existingResult = await pool.query(
      `SELECT * FROM PromptFingerprints WHERE prompt_fingerprint = $1`,
      [promptFingerprint]
    );

    if (existingResult.rows.length > 0) {
      // Update existing record
      const existing = existingResult.rows[0];
      const newSeenCount = existing.seen_count + 1;

      // Classify stability
      const classification = classifyPromptStability(
        newSeenCount,
        existing.first_seen_at,
        new Date()
      );

      const updateResult = await pool.query(
        `UPDATE PromptFingerprints
         SET seen_count = $1,
             last_seen_at = NOW(),
             classification = $2,
             updated_at = NOW(),
             updated_by = $3
         WHERE prompt_fingerprint = $4
         RETURNING *`,
        [newSeenCount, classification, createdBy, promptFingerprint]
      );

      console.log(`upsertPromptFingerprint: Updated fingerprint, seen_count=${newSeenCount}, classification=${classification}`);
      return updateResult.rows[0];
    }

    // Insert new fingerprint
    const classification = classifyPromptStability(1, new Date(), new Date());

    const insertResult = await pool.query(
      `INSERT INTO PromptFingerprints (
        feature_id, prompt_fingerprint, combined_system_hash, combined_user_hash,
        model, temperature, max_tokens, top_p, tools_enabled,
        seen_count, first_seen_at, last_seen_at, classification,
        created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, NOW(), NOW(), $10, $11, $11)
      RETURNING *`,
      [
        featureId, promptFingerprint, combinedSystemHash, combinedUserHash,
        model, temperature, maxTokens, topP, toolsEnabled,
        classification, createdBy
      ]
    );

    console.log('upsertPromptFingerprint: Created new fingerprint record');
    return insertResult.rows[0];
  } catch (error) {
    console.error('upsertPromptFingerprint: Error upserting fingerprint:', error);
    throw error;
  }
}

/**
 * Get prompt fingerprint by fingerprint hash
 * @param {string} fingerprint - The fingerprint hash
 * @returns {Object|null} - Fingerprint record or null
 */
export async function getPromptFingerprint(fingerprint) {
  console.log('getPromptFingerprint: Querying fingerprint:', fingerprint);

  try {
    const result = await pool.query(
      `SELECT * FROM PromptFingerprints WHERE prompt_fingerprint = $1`,
      [fingerprint]
    );

    if (result.rows.length > 0) {
      console.log('getPromptFingerprint: Found fingerprint record');
      return result.rows[0];
    }

    console.log('getPromptFingerprint: No fingerprint found');
    return null;
  } catch (error) {
    console.error('getPromptFingerprint: Error querying fingerprint:', error);
    throw error;
  }
}

/**
 * Get all fingerprints for a feature
 * @param {number} featureId - The feature ID
 * @returns {Array} - Array of fingerprint records
 */
export async function getFingerprintsByFeature(featureId) {
  console.log('getFingerprintsByFeature: Querying fingerprints for feature:', featureId);

  try {
    const result = await pool.query(
      `SELECT * FROM PromptFingerprints
       WHERE feature_id = $1
       ORDER BY last_seen_at DESC`,
      [featureId]
    );

    console.log(`getFingerprintsByFeature: Found ${result.rows.length} fingerprints`);
    return result.rows;
  } catch (error) {
    console.error('getFingerprintsByFeature: Error querying fingerprints:', error);
    throw error;
  }
}

// =====================================================
// Main Analysis Function
// =====================================================

/**
 * Analyze trace and generate fingerprint
 * @param {Object} trace - Trace object with observations
 * @param {number} featureId - Feature ID
 * @param {number} createdBy - User ID
 * @returns {Object} - Analysis result with fingerprint
 */
export async function analyzeTraceForFingerprint(trace, featureId, createdBy = 0) {
  console.log('analyzeTraceForFingerprint: Starting analysis for trace:', trace.id);

  try {
    const observations = Array.isArray(trace.observations) ? trace.observations : [trace];

    if (observations.length === 0) {
      console.log('analyzeTraceForFingerprint: No observations found');
      return { success: false, error: 'No observations found' };
    }

    // 1. Calculate hashes
    const systemHashResult = calculateSystemHash(observations);
    const userHashResult = calculateUserHash(observations);
    const modelParams = extractModelParameters(observations);

    if (!systemHashResult.combinedHash) {
      console.log('analyzeTraceForFingerprint: No system messages found, cannot generate fingerprint');
      return { success: false, error: 'No system messages found' };
    }

    // 2. Generate fingerprint
    const fingerprint = calculatePromptFingerprint(systemHashResult.combinedHash, modelParams);

    if (!fingerprint) {
      console.log('analyzeTraceForFingerprint: Failed to generate fingerprint');
      return { success: false, error: 'Failed to generate fingerprint' };
    }

    // 3. Update hash statistics
    await updatePromptHashStats(systemHashResult.combinedHash, 'system');
    if (userHashResult.combinedHash) {
      await updatePromptHashStats(userHashResult.combinedHash, 'user');
    }

    // 4. Upsert fingerprint record
    const fingerprintRecord = await upsertPromptFingerprint({
      featureId,
      promptFingerprint: fingerprint,
      combinedSystemHash: systemHashResult.combinedHash,
      combinedUserHash: userHashResult.combinedHash,
      model: modelParams.model,
      temperature: modelParams.temperature,
      maxTokens: modelParams.max_tokens,
      topP: modelParams.top_p,
      toolsEnabled: modelParams.tools_enabled,
      createdBy
    });

    console.log('analyzeTraceForFingerprint: Analysis complete');

    return {
      success: true,
      fingerprint,
      fingerprintRecord,
      systemHash: systemHashResult.combinedHash,
      userHash: userHashResult.combinedHash,
      modelParams
    };
  } catch (error) {
    console.error('analyzeTraceForFingerprint: Error during analysis:', error);
    return { success: false, error: error.message || error };
  }
}

// =====================================================
// Phase 3: Drift Attribution System
// =====================================================

/**
 * Find the most recent previous fingerprint for a feature
 * @param {number} featureId - The feature ID
 * @param {string} currentFingerprint - Current fingerprint to exclude
 * @returns {Object|null} - Previous fingerprint record or null
 */
export async function findPreviousFingerprint(featureId, currentFingerprint) {
  console.log('findPreviousFingerprint: Looking for previous fingerprint for feature:', featureId);

  try {
    const result = await pool.query(
      `SELECT * FROM PromptFingerprints
       WHERE feature_id = $1 AND prompt_fingerprint != $2
       ORDER BY last_seen_at DESC
       LIMIT 1`,
      [featureId, currentFingerprint]
    );

    if (result.rows.length > 0) {
      console.log('findPreviousFingerprint: Found previous fingerprint:', result.rows[0].prompt_fingerprint);
      return result.rows[0];
    }

    console.log('findPreviousFingerprint: No previous fingerprint found');
    return null;
  } catch (error) {
    console.error('findPreviousFingerprint: Error querying previous fingerprint:', error);
    throw error;
  }
}

/**
 * Determine root cause of drift based on fingerprint comparison
 * @param {Object} params - Analysis parameters
 * @returns {string} - Root cause: SYSTEM_CHANGED, MODEL_INSTABILITY, USER_INTENT_CHANGED, PROMPT_AD_HOC, NO_PREVIOUS_DATA
 */
export function determineRootCause({
  currentFingerprint,
  previousFingerprint,
  currentSystemHash,
  previousSystemHash,
  currentUserHash,
  previousUserHash,
  currentClassification,
  outputDifferent = false
}) {
  console.log('determineRootCause: Analyzing drift');
  console.log('  Current fingerprint:', currentFingerprint);
  console.log('  Previous fingerprint:', previousFingerprint);
  console.log('  Output different:', outputDifferent);

  // Rule 1: No previous data
  if (!previousFingerprint) {
    console.log('determineRootCause: ROOT_CAUSE = NO_PREVIOUS_DATA (first occurrence)');
    return 'NO_PREVIOUS_DATA';
  }

  // Rule 2: Fingerprint different → SYSTEM_CHANGED (highest priority)
  if (currentFingerprint !== previousFingerprint) {
    console.log('determineRootCause: ROOT_CAUSE = SYSTEM_CHANGED (fingerprint changed)');
    return 'SYSTEM_CHANGED';
  }

  // Rule 3: Fingerprint same + output different → MODEL_INSTABILITY
  if (currentFingerprint === previousFingerprint && outputDifferent) {
    console.log('determineRootCause: ROOT_CAUSE = MODEL_INSTABILITY (same prompt, different output)');
    return 'MODEL_INSTABILITY';
  }

  // Rule 4: Fingerprint same + user_input different → USER_INTENT_CHANGED
  if (currentFingerprint === previousFingerprint && currentUserHash !== previousUserHash) {
    console.log('determineRootCause: ROOT_CAUSE = USER_INTENT_CHANGED (user input changed)');
    return 'USER_INTENT_CHANGED';
  }

  // Rule 5: System hash unstable (ad_hoc classification) → PROMPT_AD_HOC
  if (currentClassification === 'ad_hoc') {
    console.log('determineRootCause: ROOT_CAUSE = PROMPT_AD_HOC (unstable prompt)');
    return 'PROMPT_AD_HOC';
  }

  // Default: Unknown
  console.log('determineRootCause: ROOT_CAUSE = UNKNOWN');
  return 'UNKNOWN';
}

/**
 * Calculate confidence score for root cause determination
 * @param {Object} params - Scoring parameters
 * @returns {number} - Confidence score 0.0-1.0
 */
export function calculateConfidenceScore({
  rootCause,
  currentClassification,
  previousClassification,
  seenCount,
  hasHistory
}) {
  console.log('calculateConfidenceScore: Calculating score');
  console.log('  Root cause:', rootCause);
  console.log('  Current classification:', currentClassification);
  console.log('  Seen count:', seenCount);

  let score = 0.5; // Default medium confidence

  // High confidence cases (0.8-1.0)
  if (rootCause === 'SYSTEM_CHANGED' && currentClassification === 'stable_template') {
    score = 0.95;
    console.log('calculateConfidenceScore: High confidence - stable template changed');
  } else if (rootCause === 'MODEL_INSTABILITY' && currentClassification === 'stable_template') {
    score = 0.90;
    console.log('calculateConfidenceScore: High confidence - stable prompt, output variance');
  } else if (currentClassification === 'stable_template' && previousClassification === 'stable_template') {
    score = 0.85;
    console.log('calculateConfidenceScore: High confidence - both templates stable');
  }
  // Medium-high confidence (0.6-0.8)
  else if (rootCause === 'SYSTEM_CHANGED' && seenCount >= 3) {
    score = 0.75;
    console.log('calculateConfidenceScore: Medium-high confidence - system changed, some history');
  } else if (rootCause === 'USER_INTENT_CHANGED' && currentClassification === 'stable_template') {
    score = 0.70;
    console.log('calculateConfidenceScore: Medium-high confidence - stable template, user changed');
  } else if (hasHistory && seenCount >= 2) {
    score = 0.65;
    console.log('calculateConfidenceScore: Medium-high confidence - has comparison history');
  }
  // Medium confidence (0.4-0.6)
  else if (rootCause === 'NO_PREVIOUS_DATA') {
    score = 0.50;
    console.log('calculateConfidenceScore: Medium confidence - no previous data');
  } else if (currentClassification === 'pending') {
    score = 0.55;
    console.log('calculateConfidenceScore: Medium confidence - pending classification');
  }
  // Low confidence (0.0-0.4)
  else if (rootCause === 'PROMPT_AD_HOC' || currentClassification === 'ad_hoc') {
    score = 0.30;
    console.log('calculateConfidenceScore: Low confidence - ad-hoc prompt');
  } else if (seenCount === 1) {
    score = 0.25;
    console.log('calculateConfidenceScore: Low confidence - seen only once');
  } else if (rootCause === 'UNKNOWN') {
    score = 0.20;
    console.log('calculateConfidenceScore: Low confidence - unknown root cause');
  }

  console.log('calculateConfidenceScore: Final score:', score.toFixed(2));
  return score;
}

/**
 * Save analysis result to TraceAnalysisResults table
 * @param {Object} params - Analysis result parameters
 * @returns {Object} - Saved analysis result
 */
export async function saveAnalysisResult({
  traceId,
  featureId,
  promptFingerprint,
  previousFingerprint,
  systemPromptClassification,
  rootCause,
  confidenceScore,
  analysisDetails,
  debugMetadata,
  createdBy = 0
}) {
  console.log('saveAnalysisResult: Saving analysis for trace:', traceId);

  try {
    const result = await pool.query(
      `INSERT INTO TraceAnalysisResults (
        trace_id, feature_id, prompt_fingerprint, previous_fingerprint,
        system_prompt_classification, root_cause, confidence_score,
        analysis_details, debug_metadata, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (trace_id) DO UPDATE
      SET feature_id = EXCLUDED.feature_id,
          prompt_fingerprint = EXCLUDED.prompt_fingerprint,
          previous_fingerprint = EXCLUDED.previous_fingerprint,
          system_prompt_classification = EXCLUDED.system_prompt_classification,
          root_cause = EXCLUDED.root_cause,
          confidence_score = EXCLUDED.confidence_score,
          analysis_details = EXCLUDED.analysis_details,
          debug_metadata = EXCLUDED.debug_metadata,
          created_at = NOW()
      RETURNING *`,
      [
        traceId, featureId, promptFingerprint, previousFingerprint,
        systemPromptClassification, rootCause, confidenceScore,
        JSON.stringify(analysisDetails), JSON.stringify(debugMetadata),
        createdBy
      ]
    );

    console.log('saveAnalysisResult: Analysis saved successfully');
    return result.rows[0];
  } catch (error) {
    console.error('saveAnalysisResult: Error saving analysis result:', error);
    throw error;
  }
}

/**
 * Get analysis result for a trace
 * @param {string} traceId - The trace ID
 * @returns {Object|null} - Analysis result or null
 */
export async function getAnalysisResult(traceId) {
  console.log('getAnalysisResult: Querying analysis for trace:', traceId);

  try {
    const result = await pool.query(
      `SELECT * FROM TraceAnalysisResults WHERE trace_id = $1`,
      [traceId]
    );

    if (result.rows.length > 0) {
      console.log('getAnalysisResult: Found analysis result');
      return result.rows[0];
    }

    console.log('getAnalysisResult: No analysis result found');
    return null;
  } catch (error) {
    console.error('getAnalysisResult: Error querying analysis result:', error);
    throw error;
  }
}

/**
 * Main drift analysis function - analyzes trace and determines drift root cause
 * @param {Object} trace - Trace object with observations
 * @param {number} featureId - Feature ID
 * @param {number} createdBy - User ID
 * @param {Object} options - Additional options
 * @returns {Object} - Complete drift analysis result
 */
export async function analyzePromptDrift(trace, featureId, createdBy = 0, options = {}) {
  console.log('====================================================');
  console.log('analyzePromptDrift: Starting drift analysis for trace:', trace.id);
  console.log('====================================================');

  try {
    // Step 1: Generate fingerprint for current trace
    console.log('[Step 1/5] Generating fingerprint for current trace...');
    const fingerprintResult = await analyzeTraceForFingerprint(trace, featureId, createdBy);

    if (!fingerprintResult.success) {
      console.log('analyzePromptDrift: Failed to generate fingerprint');
      return { success: false, error: fingerprintResult.error };
    }

    const currentFingerprint = fingerprintResult.fingerprint;
    const currentRecord = fingerprintResult.fingerprintRecord;
    const currentSystemHash = fingerprintResult.systemHash;
    const currentUserHash = fingerprintResult.userHash;

    console.log(`  ✓ Current fingerprint: ${currentFingerprint}`);
    console.log(`  ✓ Classification: ${currentRecord.classification}`);
    console.log(`  ✓ Seen count: ${currentRecord.seen_count}`);

    // Step 2: Find previous fingerprint for comparison
    console.log('[Step 2/5] Finding previous fingerprint...');
    const previousRecord = await findPreviousFingerprint(featureId, currentFingerprint);

    if (previousRecord) {
      console.log(`  ✓ Previous fingerprint: ${previousRecord.prompt_fingerprint}`);
      console.log(`  ✓ Previous classification: ${previousRecord.classification}`);
    } else {
      console.log('  ℹ No previous fingerprint found (first occurrence)');
    }

    // Step 3: Determine root cause
    console.log('[Step 3/5] Determining root cause...');
    const rootCause = determineRootCause({
      currentFingerprint,
      previousFingerprint: previousRecord?.prompt_fingerprint,
      currentSystemHash,
      previousSystemHash: previousRecord?.combined_system_hash,
      currentUserHash,
      previousUserHash: previousRecord?.combined_user_hash,
      currentClassification: currentRecord.classification,
      outputDifferent: options.outputDifferent || false
    });

    console.log(`  ✓ Root cause: ${rootCause}`);

    // Step 4: Calculate confidence score
    console.log('[Step 4/5] Calculating confidence score...');
    const confidenceScore = calculateConfidenceScore({
      rootCause,
      currentClassification: currentRecord.classification,
      previousClassification: previousRecord?.classification,
      seenCount: currentRecord.seen_count,
      hasHistory: !!previousRecord
    });

    console.log(`  ✓ Confidence score: ${confidenceScore.toFixed(2)}`);

    // Step 5: Save analysis result
    console.log('[Step 5/5] Saving analysis result...');
    const analysisDetails = {
      current_fingerprint: currentFingerprint,
      previous_fingerprint: previousRecord?.prompt_fingerprint || null,
      current_seen_count: currentRecord.seen_count,
      previous_seen_count: previousRecord?.seen_count || 0,
      model_params: fingerprintResult.modelParams
    };

    const debugMetadata = {
      trace_id: trace.id,
      feature_id: featureId,
      observations_count: Array.isArray(trace.observations) ? trace.observations.length : 1,
      system_hash: currentSystemHash,
      user_hash: currentUserHash,
      previous_system_hash: previousRecord?.combined_system_hash || null,
      timestamp: new Date().toISOString()
    };

    const savedResult = await saveAnalysisResult({
      traceId: trace.id,
      featureId,
      promptFingerprint: currentFingerprint,
      previousFingerprint: previousRecord?.prompt_fingerprint || null,
      systemPromptClassification: currentRecord.classification,
      rootCause,
      confidenceScore,
      analysisDetails,
      debugMetadata,
      createdBy
    });

    console.log('  ✓ Analysis result saved');

    // Step 6: Update feature risk flag if needed
    if (rootCause === 'SYSTEM_CHANGED' && confidenceScore >= 0.7) {
      console.log('[Step 6/5] Marking feature with prompt_changed_risk...');
      try {
        await pool.query(
          `UPDATE TestProjectFeatures
           SET prompt_changed_risk = TRUE, updated_at = NOW(), updated_by = $2
           WHERE id = $1`,
          [featureId, createdBy]
        );
        console.log('  ✓ Feature risk flag updated');
      } catch (error) {
        console.error('  ✗ Failed to update feature risk flag:', error);
      }
    }

    console.log('====================================================');
    console.log('✓ Drift analysis complete');
    console.log('====================================================');

    return {
      success: true,
      traceId: trace.id,
      featureId,
      fingerprint: currentFingerprint,
      previousFingerprint: previousRecord?.prompt_fingerprint || null,
      classification: currentRecord.classification,
      rootCause,
      confidenceScore,
      analysisRecord: savedResult,
      summary: {
        fingerprint_changed: currentFingerprint !== previousRecord?.prompt_fingerprint,
        is_first_occurrence: !previousRecord,
        stability: currentRecord.classification,
        risk_flagged: rootCause === 'SYSTEM_CHANGED' && confidenceScore >= 0.7
      }
    };
  } catch (error) {
    console.error('====================================================');
    console.error('analyzePromptDrift: Error during drift analysis:', error);
    console.error('====================================================');
    return { success: false, error: error.message || error };
  }
}

// // =====================================================
// // Test Run Drift Detection
// // =====================================================

// /**
//  * Detect prompt drift for a test case run
//  * Compares test case's original fingerprint with current fingerprint
//  * @param {Object} params - Detection parameters
//  * @returns {Object} - Drift detection result
//  */
// export async function detectTestRunDrift({
//   testCaseId,
//   traceId,
//   featureId,
//   userId = 0
// }) {
//   console.log('detectTestRunDrift: Starting drift detection for test case:', testCaseId);

//   try {
//     // 1. Get test case with original fingerprint
//     const testCaseResult = await pool.query(
//       `SELECT id, prompt_fingerprint, prompt_fingerprint_updated_at, trace_id, feature_id
//        FROM TestCases
//        WHERE id = $1 AND deleted = FALSE`,
//       [testCaseId]
//     );

//     if (testCaseResult.rows.length === 0) {
//       console.log('detectTestRunDrift: Test case not found');
//       return { success: false, error: 'Test case not found' };
//     }

//     const testCase = testCaseResult.rows[0];
//     const originalFingerprint = testCase.prompt_fingerprint;

//     if (!originalFingerprint) {
//       console.log('detectTestRunDrift: No original fingerprint stored, no drift detection possible');
//       return {
//         success: true,
//         driftDetected: false,
//         severity: 'none',
//         warning: 'No baseline fingerprint available for comparison'
//       };
//     }

//     // 2. Get current trace and calculate current fingerprint
//     console.log('detectTestRunDrift: Fetching current trace...');
//     const { getTraceDetail } = await import('../traces.js');
//     const currentTrace = await getTraceDetail({ id: traceId || testCase.trace_id, userId });

//     if (!currentTrace) {
//       console.log('detectTestRunDrift: Could not fetch current trace');
//       return {
//         success: true,
//         driftDetected: false,
//         severity: 'none',
//         warning: 'Could not fetch trace for comparison'
//       };
//     }

//     // 3. Calculate current fingerprint
//     console.log('detectTestRunDrift: Calculating current fingerprint...');
//     const currentFingerprintResult = await analyzeTraceForFingerprint(
//       currentTrace,
//       featureId || testCase.feature_id,
//       userId
//     );

//     if (!currentFingerprintResult.success || !currentFingerprintResult.fingerprint) {
//       console.log('detectTestRunDrift: Could not calculate current fingerprint');
//       return {
//         success: true,
//         driftDetected: false,
//         severity: 'none',
//         warning: 'Could not calculate current fingerprint'
//       };
//     }

//     const currentFingerprint = currentFingerprintResult.fingerprint;
//     const currentRecord = currentFingerprintResult.fingerprintRecord;

//     // 4. Compare fingerprints
//     console.log(`detectTestRunDrift: Comparing fingerprints:`);
//     console.log(`  Original: ${originalFingerprint.substring(0, 16)}...`);
//     console.log(`  Current:  ${currentFingerprint.substring(0, 16)}...`);

//     const driftDetected = originalFingerprint !== currentFingerprint;

//     if (!driftDetected) {
//       console.log('detectTestRunDrift: ✓ No drift detected - fingerprints match');
//       return {
//         success: true,
//         driftDetected: false,
//         severity: 'none',
//         originalFingerprint,
//         currentFingerprint,
//         message: 'Prompt has not changed since test case was created'
//       };
//     }

//     // 5. Drift detected - determine severity
//     console.log('detectTestRunDrift: ⚠️  Drift detected - calculating severity...');

//     // Get original fingerprint record for comparison
//     const originalFingerprintRecord = await getPromptFingerprint(originalFingerprint);

//     // Get analysis result for root cause
//     const analysisResult = await pool.query(
//       `SELECT root_cause, confidence_score
//        FROM TraceAnalysisResults
//        WHERE prompt_fingerprint = $1
//        ORDER BY created_at DESC
//        LIMIT 1`,
//       [currentFingerprint]
//     );

//     const rootCause = analysisResult.rows.length > 0 ? analysisResult.rows[0].root_cause : null;
//     const confidenceScore = analysisResult.rows.length > 0 ? parseFloat(analysisResult.rows[0].confidence_score) : 0.5;

//     // Determine severity
//     let severity = 'low';
//     let warning = 'Prompt has changed since test case was created';

//     // Check if feature has risk flag
//     const featureRisk = await pool.query(
//       `SELECT prompt_changed_risk
//        FROM TestProjectFeatures
//        WHERE id = $1`,
//       [featureId || testCase.feature_id]
//     );
//     const hasRiskFlag = featureRisk.rows.length > 0 && featureRisk.rows[0].prompt_changed_risk;

//     // High severity conditions
//     if (rootCause === 'SYSTEM_CHANGED' && confidenceScore >= 0.7) {
//       severity = 'high';
//       warning = 'System prompt has changed significantly - test expectations may be outdated';
//     } else if (hasRiskFlag) {
//       severity = 'high';
//       warning = 'Feature is marked as at-risk due to prompt changes';
//     }
//     // Medium severity conditions
//     else if (
//       originalFingerprintRecord?.classification === 'stable_template' &&
//       currentRecord.classification === 'ad_hoc'
//     ) {
//       severity = 'medium';
//       warning = 'Prompt changed from stable template to ad-hoc usage';
//     } else if (rootCause === 'SYSTEM_CHANGED' && confidenceScore >= 0.5) {
//       severity = 'medium';
//       warning = 'Prompt has likely changed - review test expectations';
//     }
//     // Low severity (default)
//     else {
//       severity = 'low';
//       warning = 'Minor prompt changes detected';
//     }

//     console.log(`detectTestRunDrift: Severity = ${severity}`);
//     console.log(`detectTestRunDrift: Root cause = ${rootCause || 'unknown'}`);
//     console.log(`detectTestRunDrift: Confidence = ${(confidenceScore * 100).toFixed(0)}%`);

//     return {
//       success: true,
//       driftDetected: true,
//       severity,
//       originalFingerprint,
//       currentFingerprint,
//       originalClassification: originalFingerprintRecord?.classification || 'unknown',
//       currentClassification: currentRecord.classification,
//       rootCause: rootCause || 'UNKNOWN',
//       confidenceScore,
//       warning,
//       details: {
//         original_seen_count: originalFingerprintRecord?.seen_count || 0,
//         current_seen_count: currentRecord.seen_count,
//         fingerprint_changed_at: new Date().toISOString()
//       }
//     };
//   } catch (error) {
//     console.error('detectTestRunDrift: Error during drift detection:', error);
//     return {
//       success: false,
//       error: error.message || error,
//       driftDetected: false,
//       severity: 'none'
//     };
//   }
// }
