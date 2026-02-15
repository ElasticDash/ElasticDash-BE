// worker/testCaseRunWorker.js
// Automated worker for processing pending TestCaseRun using sendRequestToOpenAiUnsupervised
// Concurrency: 3, FIFO order, robust error handling

import { pool } from '../postgres.js';
import { sendRequestToOpenAiUnsupervised, sendRequestToGeminiUnsupervised } from '../controller/general/aihandler.js';
import { testCaseRunAiCallResultEvaluationPrompt } from '../src/constants.js';
import { updateTestCaseRunRecordStatus } from '../controller/testcases/testCaseController.js';

const MAX_CONCURRENT = 3;
export const POLL_INTERVAL_MS = 5000;

let activeWorkers = 0;

async function fetchPendingRuns(limit = MAX_CONCURRENT) {
  const res = await pool.query(
    `SELECT * FROM TestCaseRun WHERE status = 'pending' ORDER BY started_at ASC, id ASC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

async function claimRun(runId) {
  // Atomically claim the run if still pending
  const res = await pool.query(
    `UPDATE TestCaseRun SET status = 'running', started_at = NOW(), updated_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING *`,
    [runId]
  );
  return res.rows[0];
}

async function fetchAiCalls(testCaseId) {
  const res = await pool.query(
    `SELECT * FROM AiCalls
    WHERE test_case_id = $1
    AND deleted = FALSE
    AND input IS NOT NULL
    AND expected_output IS NOT NULL
    ORDER BY step_order ASC`,
    [testCaseId]
  );
  return res.rows;
}

async function getModelInfo(modelName) {
  if (!modelName || typeof modelName !== 'string' || modelName.trim() === '') {
    return null;
  }
  const res = await pool.query(
    `SELECT id, model_name, provider_id, display_name FROM SupportedAiModels
     WHERE LOWER(model_name) = LOWER($1)
     AND deleted = FALSE
     LIMIT 1`,
    [modelName.trim()]
  );
  return res.rows.length > 0 ? res.rows[0] : null;
}

// Helper to insert a failed TestCaseRunAICall row, including ai_model and api_endpoint
async function insertFailedTestCaseRunAICall({ runId, aiCallId, input, failureReason, createdBy, aiModel, apiEndpoint }) {
  await pool.query(
    `INSERT INTO TestCaseRunAICall (test_case_run_id, ai_call_id, input, output, status, failure_reason, ai_model, api_endpoint, started_at, completed_at, created_by, updated_by)
     VALUES ($1, $2, $3, NULL, 'failed', $4, $5, $6, NOW(), NOW(), $7, $7)`,
    [
      runId,
      aiCallId,
      typeof input === 'string' ? input : JSON.stringify(input),
      failureReason,
      aiModel,
      apiEndpoint,
      createdBy
    ]
  );
}

// Helper to insert a result TestCaseRunAICall row (success or failed), including ai_model and api_endpoint
async function insertResultTestCaseRunAICall({
  runId,
  aiCallId,
  input,
  output,
  status,
  failureReason,
  promptDriftRisk = false,
  promptDriftDetails = null,
  createdBy,
  aiModel,
  apiEndpoint
}) {
  await pool.query(
    `INSERT INTO TestCaseRunAICall (test_case_run_id, ai_call_id, input, output, status, failure_reason, ai_model, api_endpoint, prompt_drift_risk, prompt_drift_details, started_at, completed_at, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW(), $11, $11)`,
    [
      runId,
      aiCallId,
      input,
      output,
      status,
      failureReason,
      aiModel,
      apiEndpoint,
      promptDriftRisk,
      promptDriftDetails,
      createdBy
    ]
  );
}

async function getProjectTokens(testCaseId) {
  // Get the test case's project_id
  const testCaseRes = await pool.query(
    `SELECT tc.project_id FROM TestCases tc WHERE tc.id = $1 AND tc.deleted = FALSE`,
    [testCaseId]
  );

  if (testCaseRes.rows.length === 0) {
    return {};
  }

  const projectId = testCaseRes.rows[0].project_id;
  if (!projectId) {
    return {};
  }

  // Get all tokens for this project from TestProjectLlms
  const tokensRes = await pool.query(
    `SELECT llm_provider_id, llm_token FROM TestProjectLlms
     WHERE project_id = $1 AND deleted = FALSE`,
    [projectId]
  );

  // Build a map of provider_id -> token
  const tokenMap = {};
  for (const row of tokensRes.rows) {
    if (row.llm_token) {
      tokenMap[row.llm_provider_id] = row.llm_token;
    }
  }

  return tokenMap;
}

async function validateRequiredTokens(aiCalls, projectTokens) {
  // Collect all unique provider_ids needed for this test case
  const requiredProviders = new Set();
  const providerNames = {
    1: 'OpenAI',
    2: 'Google Gemini'
  };

  for (const aiCall of aiCalls) {
    const modelInfo = await getModelInfo(aiCall.ai_model);
    if (modelInfo && modelInfo.provider_id) {
      requiredProviders.add(modelInfo.provider_id);
    }
  }

  // Check if all required providers have tokens
  const missingProviders = [];
  for (const providerId of requiredProviders) {
    if (!projectTokens[providerId]) {
      missingProviders.push(providerNames[providerId] || `Provider ${providerId}`);
    }
  }

  return {
    valid: missingProviders.length === 0,
    missingProviders: missingProviders
  };
}

async function executeAiCall(modelInfo, input, providerToken) {
  // Route to the correct provider based on provider_id
  // provider_id: 1 = OpenAI, 2 = Google Gemini
  const providerId = modelInfo.provider_id;
  const modelName = modelInfo.model_name;

  // Ensure input has the model specified
  const inputWithModel = {
    ...input,
    model: modelName
  };

  switch(providerId) {
    case 1: // OpenAI
      return await sendRequestToOpenAiUnsupervised(inputWithModel, providerToken);
    case 2: // Google Gemini
      return await sendRequestToGeminiUnsupervised(inputWithModel, providerToken);
    default:
      // Fallback to OpenAI for unknown providers
      console.warn(`Unknown provider_id: ${providerId}, falling back to OpenAI`);
      return await sendRequestToOpenAiUnsupervised(inputWithModel, providerToken);
  }
}

// async function triggerSystemApi(run, testCase) {
//   // Trigger the actual API on the system being tested
//   // This will generate a trace with testCaseId and testCaseRunId metadata
//   console.log(`🚀 Triggering system API for test case ${testCase.id}, run ${run.id}...`);

//   try {
//     // Get the test project to find the base URL
//     const projectRes = await pool.query(
//       `SELECT api_base_url, oauth_token FROM TestProjects WHERE id = $1 AND deleted = FALSE`,
//       [testCase.project_id]
//     );

//     if (projectRes.rows.length === 0 || !projectRes.rows[0].api_base_url) {
//       console.log(`⚠️  No API base URL found for test case ${testCase.id}, skipping system API trigger`);
//       return { success: false, reason: 'No API base URL configured' };
//     }

//     const baseUrl = projectRes.rows[0].api_base_url;
//     const oauthToken = projectRes.rows[0].oauth_token;
//     const apiUrl = testCase.api_url;
//     const httpMethod = testCase.http_method || 'POST';
//     const body = testCase.body;

//     console.log(`  Base URL: ${baseUrl}`);
//     console.log(`  API URL: ${apiUrl}`);
//     console.log(`  OAuth Token: ${oauthToken ? '******' : 'None'}`);

//     if (!apiUrl) {
//       console.log(`⚠️  No API URL found for test case ${testCase.id}, skipping system API trigger`);
//       return { success: false, reason: 'No API URL configured' };
//     }

//     // Build full endpoint URL
//     let endpoint = baseUrl;
//     if (!endpoint.endsWith('/')) endpoint += '/';
//     endpoint += apiUrl.startsWith('/') ? apiUrl.substring(1) : apiUrl;

//     console.log(`  Calling: ${httpMethod} ${endpoint}`);
//     console.log(`  Metadata: testCaseId=${testCase.id}, testCaseRunId=${run.id}`);

//     // Make the API call with metadata headers
//     const fetch = (await import('node-fetch')).default;
//     const response = await fetch(endpoint, {
//       method: httpMethod,
//       headers: {
//         'Content-Type': 'application/json',
//         'X-Test-Case-Id': String(testCase.id),
//         'X-Test-Case-Run-Id': String(run.id),
//         'Authorization': oauthToken ? `Bearer ${oauthToken}` : undefined
//       },
//       body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined
//     });

//     const responseText = await response.text();
//     console.log(`  Response: ${response.status} ${response.statusText}`);

//     return {
//       success: response.ok,
//       status: response.status,
//       statusText: response.statusText,
//       body: responseText
//     };
//   } catch (err) {
//     console.error(`❌ Error triggering system API for test case ${testCase.id}:`, err);
//     return {
//       success: false,
//       error: err.message
//     };
//   }
// }

async function processRun(run) {
  try {
    // Step 0: Fetch test case details
    const testCaseRes = await pool.query(
      `SELECT * FROM TestCases WHERE id = $1 AND deleted = FALSE`,
      [run.test_case_id]
    );

    if (testCaseRes.rows.length === 0) {
      throw new Error(`Test case ${run.test_case_id} not found`);
    }

    // const testCase = testCaseRes.rows[0];

    // Step 0.5: Trigger the actual system API to generate a trace with metadata
    // This trace will be analyzed and create a draft for this run
    // const apiResult = await triggerSystemApi(run, testCase);
    // console.log(`  System API trigger result:`, apiResult.success ? '✓ Success' : '✗ Failed');

    // // Step 1: Detect prompt drift before executing test
    // console.log(`\n🔍 Checking for prompt drift for test case ${run.test_case_id}...`);
    // let driftResult = null;
    // try {
    //   driftResult = await detectTestRunDrift({
    //     testCaseId: run.test_case_id,
    //     traceId: null, // Will use test case's trace_id
    //     featureId: null, // Will use test case's feature_id
    //     userId: run.created_by
    //   });

    //   if (driftResult.success) {
    //     // Update TestCaseRun with drift information
    //     await pool.query(
    //       `UPDATE TestCaseRun
    //        SET prompt_fingerprint_at_run = $1,
    //            prompt_drift_detected = $2,
    //            prompt_drift_severity = $3,
    //            updated_at = NOW()
    //        WHERE id = $4`,
    //       [
    //         driftResult.currentFingerprint || null,
    //         driftResult.driftDetected || false,
    //         driftResult.severity || 'none',
    //         run.id
    //       ]
    //     );

    //     if (driftResult.driftDetected) {
    //       console.log(`⚠️  Prompt drift detected for test case ${run.test_case_id}:`);
    //       console.log(`  Severity: ${driftResult.severity}`);
    //       console.log(`  Warning: ${driftResult.warning}`);
    //       console.log(`  Root cause: ${driftResult.rootCause}`);
    //       console.log(`  Confidence: ${(driftResult.confidenceScore * 100).toFixed(0)}%`);
    //     } else {
    //       console.log(`✓ No prompt drift detected`);
    //     }
    //   }
    // } catch (driftErr) {
    //   console.error(`Error detecting drift for test case ${run.test_case_id}:`, driftErr);
    //   // Continue with test execution even if drift detection fails
    // }

    // Step 2: Fetch and execute AI calls
    const aiCalls = await fetchAiCalls(run.test_case_id);
    let anyCallFailed = false;

    // Step 2.5: Validate that user has provided tokens for all required providers
    const projectTokens = await getProjectTokens(run.test_case_id);
    const tokenValidation = await validateRequiredTokens(aiCalls, projectTokens);

    if (!tokenValidation.valid) {
      const missingProvidersStr = tokenValidation.missingProviders.join(', ');
      const errorMessage = `Missing LLM token(s) for provider(s): ${missingProvidersStr}`;

      console.error(`Test case ${run.test_case_id} run ${run.id} failed: ${errorMessage}`);

      // Fail the entire test run
      await pool.query(
        `UPDATE TestCaseRun SET status = 'failed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [run.id]
      );

      // Record failure reason for each AI call using helper
      for (const aiCall of aiCalls) {
        await insertFailedTestCaseRunAICall({
          runId: run.id,
          aiCallId: aiCall.id,
          input: aiCall.input,
          failureReason: errorMessage,
          createdBy: run.created_by,
          aiModel: aiCall.ai_model,
          apiEndpoint: aiCall.api_endpoint
        });
      }

      // Update TestCaseRunRecords status if this run is part of a record
      if (run.test_case_run_record_id) {
        try {
          await updateTestCaseRunRecordStatus(run.test_case_run_record_id);
        } catch (updateErr) {
          console.error('Error updating TestCaseRunRecords status:', updateErr);
        }
      }

      return; // Exit early, do not execute any AI calls
    }

    // Execute ALL AI calls regardless of individual failures
    for (const aiCall of aiCalls) {
      const originalInput = aiCall.input; // Keep original for storage
      let aiInput = aiCall.input;
      let aiOutput, error, evalResult = { passed: false, reason: null };

      // Validate that the AI model is supported and get model info
      const modelInfo = await getModelInfo(aiCall.ai_model);
      if (!modelInfo) {
        error = new Error('Model not supported');
        evalResult.reason = 'Model not supported';
        console.error(`AI model '${aiCall.ai_model}' is not supported for call ${aiCall.id}`);
      }

      // Parse JSON string to object if needed
      if (!error && typeof aiInput === 'string') {
        try {
          aiInput = JSON.parse(aiInput);
        } catch (parseErr) {
          error = new Error(`Invalid JSON format in AI call input: ${parseErr.message}`);
          console.error(`Error parsing AI call input for call ${aiCall.id}:`, parseErr);
        }
      }

      if (Array.isArray(aiInput)) {
        aiInput = { messages: aiInput };
      }

      // Validate that input has the required structure for AI providers
      if (!error && (!aiInput || typeof aiInput !== 'object' || !aiInput.messages)) {
        error = new Error(`AI call input must be an object with 'messages' property. Received: ${JSON.stringify(aiInput)}`);
        console.error(`Invalid AI call input structure for call ${aiCall.id}`);
      }

      try {
        if (!error) {
          // Get provider token for this model
          const providerToken = projectTokens[modelInfo.provider_id];
          // Route to the correct provider based on model info
          aiOutput = await executeAiCall(modelInfo, aiInput, providerToken);
        }
      } catch (err) {
        error = err;
      }

      // Process output if successful
      if (!error) {
        try {
          aiOutput = aiOutput.choices[0].message.content;
          // Use output_match_type from aiCall, default to 'same_meaning' if missing
          const matchType = aiCall.output_match_type || 'same_meaning';
          // Use validation_prompt from aiCall if provided, otherwise use default based on matchType
          const validationPrompt = aiCall.validation_prompt || null;
          evalResult = await evaluateOutput(aiOutput, aiCall.expected_output, matchType, validationPrompt);
        } catch (err) {
          error = err;
        }
      }
      let status = (!error && evalResult.passed) ? 'success' : 'failed';
      if (evalResult.reason === 'passed') {
        status = 'success';
      }

      // // Determine if this AI call is at risk due to drift
      // const isAtRisk = driftResult && driftResult.driftDetected && driftResult.severity !== 'none';
      // const driftDetails = isAtRisk ? {
      //   root_cause: driftResult.rootCause,
      //   confidence_score: driftResult.confidenceScore,
      //   original_classification: driftResult.originalClassification,
      //   current_classification: driftResult.currentClassification,
      //   severity: driftResult.severity,
      //   warning: driftResult.warning
      // } : null;

      // Record the AI call result with drift information
      // Use originalInput (string) for storage, not the parsed object
      if (originalInput && typeof originalInput === 'string' && !originalInput.startsWith('{')) {
        // Wrap in JSON if it was a plain string
        originalInput = JSON.stringify({ messages: [{ role: 'user', content: originalInput }] });
      }
      let processedInput = (typeof originalInput === 'string') ? originalInput : JSON.stringify(originalInput);
      processedInput = Array.isArray(processedInput) ? { messages: processedInput } : processedInput;
      // console.log('originalInput: ', originalInput);

      await insertResultTestCaseRunAICall({
        runId: run.id,
        aiCallId: aiCall.id,
        input: processedInput,
        output: aiOutput || null,
        status,
        failureReason: error ? String(error) : (evalResult.reason || null),
        // promptDriftRisk: isAtRisk, // Uncomment and pass if drift logic is restored
        // promptDriftDetails: driftDetails ? JSON.stringify(driftDetails) : null,
        promptDriftRisk: false,
        promptDriftDetails: null,
        createdBy: run.created_by,
        aiModel: aiCall.ai_model,
        apiEndpoint: aiCall.api_endpoint
      });

      if (status === 'failed') {
        // Log the failure but continue processing remaining AI calls
        console.error('AI call failed for run', run.id, 'call', aiCall.id, 'error:', error, 'reason:', evalResult.reason);
        anyCallFailed = true;
      }
    }

    // After ALL AI calls are executed, determine overall run status
    const finalStatus = anyCallFailed ? 'failed' : 'success';
    await pool.query(
      `UPDATE TestCaseRun SET status = $1, completed_at = NOW(), updated_at = NOW() WHERE id = $2`,
      [finalStatus, run.id]
    );

    console.log(`Run ${run.id} completed with status: ${finalStatus} (${anyCallFailed ? 'some calls failed' : 'all calls succeeded'})`);

    // Update TestCaseRunRecords status if this run is part of a record
    if (run.test_case_run_record_id) {
      try {
        await updateTestCaseRunRecordStatus(run.test_case_run_record_id);
      } catch (updateErr) {
        console.error('Error updating TestCaseRunRecords status:', updateErr);
        // Don't fail the run if status update fails
      }
    }
  } catch (err) {
    // Fallback error handling for unexpected errors
    console.error('Processing failed for run', run.id, 'error:', err);
    await pool.query(
      `UPDATE TestCaseRun SET status = 'failed', updated_at = NOW() WHERE id = $1`,
      [run.id]
    );

    // Update TestCaseRunRecords status even on failure
    if (run.test_case_run_record_id) {
      try {
        await updateTestCaseRunRecordStatus(run.test_case_run_record_id);
      } catch (updateErr) {
        console.error('Error updating TestCaseRunRecords status:', updateErr);
        // Don't fail the run if status update fails
      }
    }

    console.error('Worker error for run', run.id, err);
  }
}

async function evaluateOutput(output, expectedOutput, matchType = 'same_meaning', validationPrompt = null) {
  console.log('Evaluating output, matchType:', matchType);
  // Import countTokens lazily to avoid circular deps
  // const { countTokens } = await import('../controller/general/aihandler.js');
  // const TOKEN_LIMIT = 8000;

  let outputToUse = output;
  let expectedToUse = expectedOutput;

  // Determine which validation prompt to use
  // Priority: validationPrompt > default prompt based on matchType
  let systemPrompt;
  if (validationPrompt && validationPrompt.trim() !== '') {
    systemPrompt = validationPrompt;
    console.log('Using custom validation_prompt for evaluation');
  } else {
    // Use default prompt based on matchType
    systemPrompt = testCaseRunAiCallResultEvaluationPrompt[matchType] || testCaseRunAiCallResultEvaluationPrompt.same_meaning;
    console.log(`Using default validation prompt for matchType: ${matchType}`);
  }

  // Prepare a fake prompt to count tokens
  // const promptForCount = {
  //   model: process.env.OPENAI_DEFAULT_MODEL,
  //   messages: [
  //     { role: 'system', content: systemPrompt },
  //     { role: 'user', content: `Output: ${output}\nExpected Output: ${expectedOutput}.` }
  //   ]
  // };
  // let tokenCount = 0;
  // try {
  //   tokenCount = await countTokens(promptForCount);
  // } catch (err) {
  //   console.warn('Token counting failed, proceeding without summarization.', err);
  // }

  // if (tokenCount > TOKEN_LIMIT) {
  //   // Truncate both output and expectedOutput to fit within the limit
  //   // Simple approach: cut each to half the limit in chars
  //   const maxLen = 2000; // chars per field, rough estimate
  //   const summarize = (str) => {
  //     if (!str) return '';
  //     if (str.length <= maxLen) return str;
  //     return str.slice(0, maxLen) + `\n...[truncated, total length: ${str.length}]`;
  //   };
  //   outputToUse = summarize(output);
  //   expectedToUse = summarize(expectedOutput);
  //   console.warn('Output/expectedOutput truncated for token limit.');
  // }

  const messages = [
    {
      role: 'system',
      content: systemPrompt
    },
    {
      role: 'user',
      content: `Output: ${outputToUse}\nExpected Output: ${expectedToUse}.`
    }
  ];
  const input = {
    model: process.env.OPENAI_DEFAULT_MODEL,
    messages: messages,
    temperature: 0,
    // maxTokens: TOKEN_LIMIT - 100, // leave room
  };
  const aiResponse = await sendRequestToOpenAiUnsupervised(input);
  const evaluation = aiResponse.choices[0].message.content.trim();
  // Normalize for comparison only (lowercase, remove punctuation/symbols, trim)
  const normalized = evaluation.toLowerCase().replace(/[^a-z]/g, '');
  if (normalized.startsWith('passed')) {
    return { passed: true, reason: null };
  } else {
    return { passed: false, reason: evaluation };
  }
}

export async function workerLoop() {
  if (activeWorkers >= MAX_CONCURRENT) return;
  const runs = await fetchPendingRuns(MAX_CONCURRENT - activeWorkers);
  for (const run of runs) {
    const claimed = await claimRun(run.id);
    if (!claimed) continue;
    activeWorkers++;
    processRun(claimed).finally(() => {
      activeWorkers--;
    });
  }
}

