import { pool } from '../../postgres';
import { snake2Camel } from '../general/tools';
import { createClient } from '@clickhouse/client';
import dotenv from 'dotenv';
import { testCaseRunAiCallResultEvaluationPrompt } from '../../src/constants.js';
const { getTraceDetail } = require('../traces');
dotenv.config();

const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

// Helper function to fetch feature from trace metadata
async function getFeatureFromTrace(traceId) {
  if (!traceId) return null;

  try {
    // Query ClickHouse for trace
    const traceQuery = `
      SELECT id, project_id, metadata
      FROM traces
      WHERE id = '${traceId}' AND is_deleted = 0
      LIMIT 1
    `;
    const traceResult = await clickhouseClient.query({ query: traceQuery })
    .catch(err => {
      console.error('Error querying trace from ClickHouse:', err);
      throw err;
    });

    const traceData = await traceResult.json();

    if (!traceData?.data || traceData.data.length === 0) {
      return null;
    }

    const trace = traceData.data[0];

    // Extract feature_id from metadata
    const featureId = trace.metadata?.feature_id;
    if (!featureId) {
      return null;
    }

    // Query PostgreSQL for feature
    const featureRes = await pool.query(
      `SELECT id, test_project_id, feature_name, feature_description, enabled
       FROM TestProjectFeatures
       WHERE id = $1 AND deleted = FALSE`,
      [parseInt(featureId)]
    )
    .catch(err => {
      console.error('Error querying feature from PostgreSQL:', err);
      throw err;
    });

    if (featureRes.rows.length === 0) {
      return null;
    }

    return featureRes.rows[0];
  } catch (err) {
    console.error('Error fetching feature from trace:', err);
    return null;
  }
}

  // Create a new test case
export async function createTestCase({ name, description, traceId, featureId, createdBy = 0 }) {
  console.log('createTestCase is triggered');
  console.log('Input:', { name, description, traceId, featureId, createdBy });

  // If traceId provided but no featureId, fetch it from trace
  let finalFeatureId = featureId;
  let apiUrl = null;
  let httpMethod = null;
  let body = null;
  if (traceId) {
    // Fetch trace metadata for api_url and http_method
    const traceQuery = `SELECT metadata FROM traces WHERE id = '${traceId}' AND is_deleted = 0 LIMIT 1`;
    const observationQuery = `SELECT metadata FROM observations WHERE trace_id = '${traceId}' AND name = 'handleChatRequest' AND is_deleted = 0 LIMIT 1`;
    try {
      const traceResult = await clickhouseClient.query({ query: traceQuery })
      .catch(err => {
        console.error('Error querying trace for api_url/http_method:', err);
        throw err;
      });
      const traceData = await traceResult.json();
      const observationResult = await clickhouseClient.query({ query: observationQuery })
      .catch(err => {
        console.error('Error querying observation for api_url/http_method:', err);
        throw err;
      });
      const observationData = await observationResult.json();
      if (traceData?.data && traceData.data.length > 0) {
        const meta = traceData.data[0].metadata || {};
        const obsMeta = (observationData?.data && observationData.data.length > 0) ? observationData.data[0].metadata || {} : {};
        console.log('metadata retrieved for api_url/http_method:', meta);
        const attributes = JSON.parse(meta.attributes) || {};
        const obsAttributes = JSON.parse(obsMeta.attributes) || {};
        apiUrl = attributes.http?.target || attributes['http.target'] || attributes['elasticdash.trace.metadata.http.target'] || null;
        httpMethod = attributes.http?.method || attributes['http.method'] || attributes['elasticdash.trace.metadata.http.method'] || null;
        body = obsAttributes.elasticdash?.trace?.metadata?.body || obsAttributes['elasticdash.trace.metadata.body'] || attributes['elasticdash.trace.metadata.http.body'] || null;
        if (body && typeof body === 'object') {
          body = JSON.stringify(body);
        }
        console.log(`Fetched api_url: ${apiUrl}, http_method: ${httpMethod} from trace metadata`);
      }
      else {
        console.log('Failed to fetch trace metadata for api_url/http_method: Trace not found');
      }
    } catch (err) {
      console.error('Error fetching trace metadata for api_url/http_method:', err);
    }
    if (!featureId) {
      const feature = await getFeatureFromTrace(traceId);
      if (feature) {
        finalFeatureId = feature.id;
        console.log(`Auto-populated feature_id ${finalFeatureId} from trace ${traceId}`);
      }
    }
  }

  const result = await pool.query(
    `INSERT INTO TestCases (name, description, trace_id, feature_id, api_url, http_method, body, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
    [name, description, traceId, finalFeatureId, apiUrl, httpMethod, body, createdBy]
  )
  .catch((error) => {
    console.error('Error creating test case:', error);
    throw error;
  });
  return result.rows[0];
}

// Edit an existing test case
export async function editTestCase({ id, name, description, updated_by = 0 }) {
  console.log('editTestCase is triggered for id:', id);
  const result = await pool.query(
    `UPDATE TestCases
      SET name = $1, description = $2, updated_at = NOW(), updated_by = $3
      WHERE id = $4
      RETURNING *`,
    [name, description, updated_by, id]
  )
  .catch(err => {
    console.error('Error editing test case:', err);
    throw err;
  });
  return result.rows[0];
}

// List test cases with flexible filtering/searching (like traces/list)
export async function listTestCases({ limit = 100, offset = 0, filter = '', search = '', myId } = {}) {
  console.log('listTestCases is triggered');
  console.log('Input:', { limit, offset, filter, search });
  let whereClause = 'tc.deleted = FALSE';
  if (myId) {
    whereClause += ` AND tc.created_by = ${myId}`;
  }
  if (filter) {
    // If filter contains a name search, expand to name and description
    if (/name\s+LIKE/i.test(filter)) {
      const nameLikeMatch = filter.match(/name\s+LIKE\s*'([^']+)'/i);
      if (nameLikeMatch) {
        const likeValue = nameLikeMatch[1];
        const filterWithoutName = filter.replace(/name\s+LIKE\s*'[^']+'/i, '');
        whereClause += ` AND ((tc.name LIKE '${likeValue}') OR (tc.description LIKE '${likeValue}'))`;
        if (filterWithoutName.trim()) {
          whereClause += ` AND (${filterWithoutName.trim()})`;
        }
      } else {
        whereClause += ` AND (${filter})`;
      }
    } else {
      whereClause += ` AND (${filter})`;
    }
  }
  if (search) {
    // Simple search: look for search string in name or description
    const safeSearch = search.replace(/'/g, "''");
    whereClause += ` AND (tc.name ILIKE '%${safeSearch}%' OR tc.description ILIKE '%${safeSearch}%')`;
  }
  const query = `
  SELECT tc.id, tc.name, tc.feature_id, tc.project_id, tc.trace_id, tc.api_url, tc.http_method,
  tc.deleted, tc.created_at, tc.updated_at, COUNT(a.*)::INT, COUNT(tcr.*)::INT AS rerun_count
  FROM TestCases tc
  LEFT JOIN AiCalls a ON tc.id = a.test_case_id AND a.deleted = FALSE
  LEFT JOIN TestCaseRun tcr ON tc.id = tcr.test_case_id AND tcr.test_case_run_record_id IS NULL AND tcr.deleted = FALSE AND tcr.is_rerun = TRUE
  WHERE ${whereClause} 
  GROUP BY tc.id, tc.name, tc.feature_id, tc.project_id, tc.trace_id, tc.api_url, tc.http_method,
  tc.deleted, tc.created_at, tc.updated_at
  ORDER BY tc.id DESC LIMIT $1 OFFSET $2`;

  const testCasesRes = await pool.query(query, [parseInt(limit), parseInt(offset)])
  .catch(err => {
    console.error('Error listing test cases:', err);
    throw err;
  });

  // Fetch feature for each test case
  const testCasesWithFeatures = await Promise.all(
    testCasesRes.rows.map(async (testCase) => {
      const feature = await getFeatureFromTrace(testCase.trace_id);
      return {
        ...testCase,
        feature: feature && (typeof feature === 'object' || Array.isArray(feature)) ? snake2Camel(feature) : null
      };
    })
  );

  const countQuery = `SELECT COUNT(tc.*) FROM TestCases tc WHERE ${whereClause}`;
  const countResult = await pool.query(countQuery);
  const total = parseInt(countResult.rows[0].count);

  const result = {
    testCases: snake2Camel(testCasesWithFeatures),
    total: total
  }

  return result;
}

// Soft delete a test case
export async function deleteTestCase(id, updated_by = 0) {
  console.log('deleteTestCase is triggered for id:', id);
  await pool.query(
    `UPDATE TestCases
      SET deleted = TRUE, updated_at = NOW(), updated_by = $2
      WHERE id = $1`,
    [id, updated_by]
  )
  .catch(err => {
    console.error('Error deleting test case:', err);
    throw err;
  });
  return { success: true };
}

// Get test case detail and its AI calls
export async function getTestCaseDetail(id) {
  console.log('Fetching test case detail for id:', id);
  const testCaseRes = await pool.query(
    `SELECT * FROM TestCases WHERE id = $1 AND deleted = FALSE`,
    [id]
  )
  .catch(err => {
    console.error('Error fetching test case detail:', err);
    throw err;
  });
  const aiCallsRes = await pool.query(
    `SELECT * FROM AiCalls 
    WHERE test_case_id = $1 
    AND deleted = FALSE 
    AND input IS NOT NULL
    AND expected_output IS NOT NULL
    ORDER BY step_order`,
    [id]
  )
  .catch(err => {
    console.error('Error fetching AI calls for test case:', err);
    throw err;
  });

  const testCase = testCaseRes.rows[0];

  // Fetch feature from trace
  const feature = await getFeatureFromTrace(testCase.trace_id);

  const rerunQuery = `
    SELECT id, created_at FROM TestCaseRun
    WHERE test_case_id = $1 
    AND test_case_run_record_id IS NULL
    AND is_rerun = TRUE 
    AND deleted = FALSE
    ORDER BY created_at DESC LIMIT 1
  `;

  const rerunRes = await pool.query(rerunQuery, [id])
  .catch(err => {
    console.error('Error checking for rerun test case run:', err);
    throw err;
  });

  const rerunAiCallQuery = `
    SELECT * FROM TestCaseRunAICall
    WHERE test_case_run_id = $1
    AND deleted = FALSE
    ORDER BY created_at ASC
  `;

  const rerunData = {
    id: rerunRes.rows.length > 0 ? rerunRes.rows[0].id : null,
    aiCalls: [],
    createdAt: rerunRes.rows.length > 0 ? rerunRes.rows[0].created_at : null
  }

  if (rerunRes.rows.length > 0) {
    const rerunTestCaseRunId = rerunRes.rows[0].id;
    const rerunAiCallsRes = await pool.query(rerunAiCallQuery, [rerunTestCaseRunId])
    .catch(err => {
      console.error('Error fetching AI calls for rerun test case run:', err);
      throw err;
    });

    rerunData.aiCalls = snake2Camel(rerunAiCallsRes.rows);
  }

  // Process AI calls to populate validation_prompt with default if null
  const aiCalls = snake2Camel(aiCallsRes.rows).map(aiCall => {
    if (!aiCall.validationPrompt || aiCall.validationPrompt.trim() === '') {
      const matchType = aiCall.outputMatchType || 'same_meaning';
      aiCall.validationPrompt = testCaseRunAiCallResultEvaluationPrompt[matchType] || testCaseRunAiCallResultEvaluationPrompt.same_meaning;
    }
    return aiCall;
  });

  return {
    testCase: {
      ...snake2Camel(testCase),
      feature: snake2Camel(feature)
    },
    aiCalls: aiCalls,
    rerun: rerunData
  };
}

// Create a new AI call for a test case
export async function createAiCall({ test_case_id, step_order, ai_model, api_endpoint, input, expected_output, output_match_type, createdBy = 0 }) {
  console.log('createAiCall is triggered');
  console.log('Input:', { test_case_id, step_order, ai_model, api_endpoint });
  let finalExpectedOutput = expected_output;
  if (typeof expected_output === 'string') {
    try {
      const parsed = JSON.parse(expected_output);
      if (parsed && typeof parsed === 'object' && parsed.role && parsed.content) {
        finalExpectedOutput = parsed.content;
      }
    } catch (e) {
      // Not JSON, use as is
    }
  }
  if (typeof input !== 'string') {
    input = JSON.stringify(input);
  }
  const result = await pool.query(
    `INSERT INTO AiCalls (test_case_id, step_order, ai_model, api_endpoint, input, expected_output, output_match_type, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
    [test_case_id, step_order, ai_model, api_endpoint, input, finalExpectedOutput, output_match_type, createdBy]
  )
  .catch((error) => {
    console.error('Error creating AI call:', error);
    console.log('input:', input);
    console.log('expected_output:', expected_output);
    throw error;
  });

  return result.rows[0];
}

// Edit an existing AI call
export async function editAiCall({ id, step_order, ai_model, api_endpoint, input, expected_output, output_match_type, updated_by = 0 }) {
  console.log('editAiCall is triggered for id:', id);
  const result = await pool.query(
    `UPDATE AiCalls
      SET step_order = $1, ai_model = $2, api_endpoint = $3, input = $4, expected_output = $5, output_match_type = $6, updated_at = NOW(), updated_by = $7
      WHERE id = $8
      RETURNING *`,
    [step_order, ai_model, api_endpoint, input, expected_output, output_match_type, updated_by, id]
  )
  .catch(err => {
    console.error('Error editing AI call:', err);
    throw err;
  });
  return result.rows[0];
}

// Soft delete an AI call
export async function deleteAiCall(id, updated_by = 0) {
  console.log('deleteAiCall is triggered for id:', id);
  await pool.query(
    `UPDATE AiCalls
      SET deleted = TRUE, updated_at = NOW(), updated_by = $2
      WHERE id = $1`,
    [id, updated_by]
  )
  .catch(err => {
    console.error('Error deleting AI call:', err);
    throw err;
  });
  return { success: true };
}

// Update validation_prompt for an AI call
export async function updateAiCallValidationPrompt({ id, validation_prompt, updated_by = 0 }) {
  console.log('updateAiCallValidationPrompt is triggered for id:', id);
  const result = await pool.query(
    `UPDATE AiCalls
      SET validation_prompt = $1, updated_at = NOW(), updated_by = $2
      WHERE id = $3 AND deleted = FALSE
      RETURNING *`,
    [validation_prompt, updated_by, id]
  )
  .catch(err => {
    console.error('Error updating validation_prompt for AI call:', err);
    throw err;
  });

  if (result.rows.length === 0) {
    throw { status: 404, message: 'AI call not found' };
  }

  return result.rows[0];
}

// Create a test case draft (for pending approval)
export async function createTestCaseDraft({ testCaseId, testCaseRunRecordId, name, description, traceId, featureId, apiUrl, httpMethod, body, createdBy = 0 }) {
  console.log('createTestCaseDraft is triggered');
  console.log('Input:', { testCaseId, testCaseRunRecordId, name, description, traceId, featureId });

  const result = await pool.query(
    `INSERT INTO TestCaseDrafts
      (test_case_id, test_case_run_record_id, name, description, trace_id, feature_id, api_url, http_method, body, status, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, $10)
      RETURNING *`,
    [testCaseId, testCaseRunRecordId, name, description, traceId, featureId, apiUrl, httpMethod, body, createdBy]
  )
  .catch(err => {
    console.error('Error creating TestCaseDraft:', err);
    throw err;
  });
  return result.rows[0];
}

// Create an AI call for a test case draft
export async function createDraftAiCall({ testCaseDraftId, stepOrder, aiModel, apiEndpoint, input, expectedOutput, outputMatchType, createdBy = 0 }) {
  console.log('createDraftAiCall is triggered');
  console.log('Input:', { testCaseDraftId, stepOrder, aiModel });

  let finalExpectedOutput = expectedOutput;
  if (typeof expectedOutput === 'string') {
    try {
      const parsed = JSON.parse(expectedOutput);
      if (parsed && typeof parsed === 'object' && parsed.role && parsed.content) {
        finalExpectedOutput = parsed.content;
      }
    } catch (e) {
      // Not JSON, use as is
    }
  }

  if (typeof input !== 'string') {
    input = JSON.stringify(input);
  }

  const result = await pool.query(
    `INSERT INTO TestCaseDraftAiCalls
      (test_case_draft_id, step_order, ai_model, api_endpoint, input, expected_output, output_match_type, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
      RETURNING *`,
    [testCaseDraftId, stepOrder, aiModel, apiEndpoint, input, finalExpectedOutput, outputMatchType, createdBy]
  )
  .catch(err => {
    console.error('Error creating TestCaseDraftAiCall:', err);
    throw err;
  });

  return result.rows[0];
}

// Create TestCaseRun and TestCaseRunAICall from a trace (for re-evaluation)
export async function createTestCaseRunFromTrace({ testCaseId, traceId, testCaseRunRecordId, createdBy = 0, isRerun = false }) {
  console.log('createTestCaseRunFromTrace is triggered');
  console.log('Input:', { testCaseId, traceId, testCaseRunRecordId, createdBy });

  try {
    // 1. Validate inputs
    if (!testCaseId || !traceId) {
      throw { status: 400, message: 'testCaseId and traceId are required' };
    }

    // 2. Fetch the trace details with observations from ClickHouse
    const trace = await getTraceDetail({ id: traceId, userId: createdBy });

    if (!trace) {
      throw { status: 404, message: 'Trace not found' };
    }

    console.log('Trace fetched for test case run creation:', trace.id);

    // 3. Get observations for the trace
    const observations = Array.isArray(trace.observations) ? trace.observations : [trace];

    // Filter valid observations
    const validObservations = observations.filter(o =>
      o.input &&
      o.output &&
      o.input !== '' &&
      o.output !== '' &&
      o.input !== 'null' &&
      o.output !== 'null' &&
      o.input !== 'undefined' &&
      o.output !== 'undefined' &&
      o.input !== '{}' &&
      o.output !== '{}' &&
      /[\w\d\u4e00-\u9fa5]/.test(String(o.input)) &&
      /[\w\d\u4e00-\u9fa5]/.test(String(o.output))
    );

    if (validObservations.length === 0) {
      throw { status: 400, message: 'No valid observations found in trace' };
    }

    console.log(`Found ${validObservations.length} valid observations out of ${observations.length} total`);

    // (Rerun only) Delete all prevous test case run for this case and this record that are also reruns
    /*

        `UPDATE TestCaseRun
          SET deleted = TRUE, updated_at = NOW(), updated_by = 0
          WHERE test_case_id = 34 AND test_case_run_record_id = 27 AND is_rerun = TRUE AND deleted = FALSE`
    */
    if (isRerun) {
      await pool.query(
        `UPDATE TestCaseRun
          SET deleted = TRUE, updated_at = NOW(), updated_by = $1
          WHERE test_case_id = $2 AND is_rerun = TRUE AND deleted = FALSE`,
        [createdBy, testCaseId]
      )
      .catch(err => {
        console.error('Error deleting previous rerun TestCaseRun entries:', err);
        throw err;
      });

      console.log(`Deleted previous rerun TestCaseRun entries for test case ${testCaseId}`);
    }

    // 4. Create TestCaseRun entry
    const runRes = await pool.query(
      `INSERT INTO TestCaseRun (test_case_id, status, is_rerun, created_by, updated_by, started_at, completed_at)
        VALUES ($1, 'Success', $2, $3, $3, NOW(), NOW())
        RETURNING *`,
      [testCaseId, isRerun, createdBy]
    )
    .catch(err => {
      console.error('Error creating TestCaseRun:', err);
      throw err;
    });

    const testCaseRun = runRes.rows[0];
    console.log(`Created TestCaseRun ${testCaseRun.id} for test case ${testCaseId}`);

    // 5. Get the test case's AI calls to match against
    const aiCallsRes = await pool.query(
      `SELECT * FROM AiCalls WHERE test_case_id = $1 AND deleted = FALSE ORDER BY step_order`,
      [testCaseId]
    )
    .catch(err => {
      console.error('Error fetching AI calls:', err);
      throw err;
    });
    const expectedAiCalls = aiCallsRes.rows;

    // 6. Create TestCaseRunAICall entries for each observation
    let step = 1;
    for (const observation of validObservations) {
      let parsedInput = observation.input;
      let parsedOutput = observation.output;

      // Parse input if it's a string
      if (typeof observation.input === 'string') {
        try {
          parsedInput = JSON.parse(observation.input);
        } catch (e) {
          parsedInput = observation.input;
        }
      }

      // Ensure input is properly formatted
      if (typeof parsedInput !== 'string') {
        parsedInput = JSON.stringify(parsedInput);
      }

      // Parse output if needed
      if (typeof observation.output === 'string') {
        parsedOutput = observation.output;
      } else {
        parsedOutput = JSON.stringify(observation.output);
      }

      // Find corresponding expected AI call (by step order)
      const expectedAiCall = expectedAiCalls.find(ac => ac.step_order === step);
      const aiCallId = expectedAiCall ? expectedAiCall.id : null;

      // Create TestCaseRunAICall
      await pool.query(
        `INSERT INTO TestCaseRunAICall
          (test_case_run_id, ai_call_id, input, output, status, started_at, completed_at, created_by, updated_by)
          VALUES ($1, $2, $3, $4, 'Success', NOW(), NOW(), $5, $5)`,
        [testCaseRun.id, aiCallId, parsedInput, parsedOutput, createdBy]
      )
      .catch(err => {
        console.error('Error creating TestCaseRunAICall:', err);
        throw err;
      });

      console.log(`Created TestCaseRunAICall ${step}/${validObservations.length} for run ${testCaseRun.id}`);
      step++;
    }

    console.log(`Successfully created TestCaseRun and ${validObservations.length} TestCaseRunAICall entries`);

    return {
      success: true,
      testCaseRunId: testCaseRun.id,
      testCaseId: testCaseId,
      traceId: traceId,
      aiCallsCreated: validObservations.length
    };

  } catch (error) {
    console.error('Error in createTestCaseRunFromTrace:', error);
    throw error;
  }
}

// Create a test case and AI calls from traces by session id
export async function createTestCaseFromTrace({ traceId, name = '', description = '', testCaseId = 0, testCaseRunRecordId = null, createdBy = 2 }) {
  console.log('createTestCaseFromTrace is triggered, traceId:', traceId, 'testCaseId:', testCaseId);
  try {
    // 1. Validate that traceId is always provided
    if (!traceId) {
      console.error('traceId is required to create test case from trace');
      return { success: false, error: 'traceId is required.' };
    }

    // 2. Fetch the trace by id
    const trace = await getTraceDetail({ id: traceId, userId: createdBy });
    if (!trace) {
      console.log('Trace not found for id:', traceId);
      return { success: false, error: 'Trace not found.' };
    }
    console.log('Trace fetched for test case creation:', trace.id);

    // 3. Get observations for the trace
    // If observations are a property, use them; otherwise, fallback to single trace
    const observations = Array.isArray(trace.observations) ? trace.observations : [trace];
    const shortenedObservations = observations.map(o => ({
      id: o.id,
      trace_id: o.trace_id,
    }));
    console.log('Observations extracted for test case creation:', shortenedObservations);

    // Filter observations with both input and output
    const validObservations = observations.filter(o =>
      o.input &&
      o.output &&
      o.input !== '' &&
      o.output !== '' &&
      o.input !== 'null' &&
      o.output !== 'null' &&
      o.input !== 'undefined' &&
      o.output !== 'undefined' &&
      o.input !== '{}' &&
      o.output !== '{}' &&
      /[\w\d\u4e00-\u9fa5]/.test(String(o.input)) &&
      /[\w\d\u4e00-\u9fa5]/.test(String(o.output))
    );
    if (validObservations.length === 0) {
      console.error(`No valid observations found. Total observations: ${observations.length}, Valid: 0`);
      return { success: false, error: `No valid observations with both input and output. Total observation found: ${observations.length}` };
    }
    console.log(`Found ${validObservations.length} valid observations out of ${observations.length} total observations`);

    // 4. Determine if we're creating a new test case, updating an existing one, or creating a draft
    let testCase;
    let isDraft = false;
    let draft = null;

    if (testCaseId && testCaseId > 0 && (!testCaseRunRecordId || testCaseRunRecordId <= 0)) {
      // Create a draft instead of directly updating
      // console.log(`Creating draft for test case ${testCaseId} (no or invalid run record: ${testCaseRunRecordId})`);

      // Fetch the existing test case to get its current data
      const testCaseRes = await pool.query(
        `SELECT * FROM TestCases WHERE id = $1 AND deleted = FALSE`,
        [testCaseId]
      )
      .catch(err => {
        console.error('Error fetching existing test case for draft creation:', err);
        throw err;
      });
      if (testCaseRes.rows.length === 0) {
        return { success: false, error: 'Test case not found.' };
      }
      testCase = testCaseRes.rows[0];

      // Get feature from trace
      const feature = await getFeatureFromTrace(traceId);
      const featureId = feature ? feature.id : testCase.feature_id;

      // Create draft with data from trace
      const draftName = name || testCase.name;
      const draftDescription = description || testCase.description;

      draft = await module.exports.createTestCaseDraft({
        testCaseId: testCaseId,
        testCaseRunRecordId: null,
        name: draftName,
        description: draftDescription,
        traceId: traceId,
        featureId: featureId,
        apiUrl: testCase.api_url,
        httpMethod: testCase.http_method,
        body: testCase.body,
        createdBy
      });

      isDraft = true;
      console.log(`Created draft ${draft.id} for test case ${testCaseId}`);
    } else if (testCaseId && testCaseId > 0) {
      // Update existing test case: mark all existing AI calls as deleted
      console.log(`Updating existing test case ${testCaseId}, marking old AI calls as deleted`);
      const deleteResult = await pool.query(
        `UPDATE AiCalls
          SET deleted = TRUE, updated_at = NOW(), updated_by = $2
          WHERE test_case_id = $1 AND deleted = FALSE`,
        [testCaseId, createdBy]
      );
      console.log(`Marked ${deleteResult.rowCount} AI calls as deleted for test case ${testCaseId}`);

      // Fetch the existing test case
      const testCaseRes = await pool.query(
        `SELECT * FROM TestCases WHERE id = $1 AND deleted = FALSE`,
        [testCaseId]
      )
      .catch(err => {
        console.error('Error fetching existing test case:', err);
        throw err;
      });
      if (testCaseRes.rows.length === 0) {
        return { success: false, error: 'Test case not found.' };
      }
      testCase = testCaseRes.rows[0];
      console.log(`Using existing test case: ${testCase.id}`);
    } else {
      // Create new test case
      const testCaseName = name || `Test Case for Trace ${traceId}`;
      const testCaseDesc = description || `Auto-generated from observations of trace ${traceId}`;
      testCase = await module.exports.createTestCase({
        name: testCaseName,
        description: testCaseDesc,
        traceId: traceId,  // Pass traceId to auto-populate feature_id
        createdBy
      });
      console.log(`Created new test case: ${testCase.id}`);
    }

    // 5. Create AI calls for each observation (or draft AI calls if creating a draft)
    if (isDraft) {
      console.log(`Starting to create ${validObservations.length} draft AI calls for draft ${draft.id}`);
      let step = 1;
      for (const o of validObservations) {
        let parsedInput = o.input;
        let parsedOutput = o.output;
        let apiBody = null;
        let modelName = o.name || '';

        if (o.metadata && o.metadata.attributes) {
          console.log('Processing observation metadata for draft body update:', o.id);
          const attributes = JSON.parse(o.metadata.attributes);

          // Extract model name from metadata
          if (attributes['elasticdash.observation.model.name']) {
            modelName = attributes['elasticdash.observation.model.name'];
          }

          if (attributes['elasticdash.trace.metadata.body']) {
            apiBody = attributes['elasticdash.trace.metadata.body'];
            try {
              const updateDraftQuery = `
                UPDATE TestCaseDrafts
                SET body = $1, updated_at = NOW(), updated_by = $2
                WHERE id = $3
              `;

              const updateDraftValues = [JSON.stringify(apiBody), createdBy, draft.id];
              await pool.query(updateDraftQuery, updateDraftValues)
              .catch(err => {
                console.error('Error updating draft body:', err);
                throw err;
              });
              console.log('Updated draft body from observation metadata for draft id:', draft.id);
            } catch (e) {
              console.error('Error updating draft body:', e);
            }
          }
        }

        if (typeof o.input === 'string') {
          try {
            parsedInput = JSON.parse(o.input);
          } catch (e) {
            parsedInput = o.input;
          }
        }
        if (typeof o.output === 'string') {
          parsedOutput = o.output;
        } else {
          parsedOutput = JSON.stringify(o.output);
        }

        await module.exports.createDraftAiCall({
          testCaseDraftId: draft.id,
          stepOrder: step,
          aiModel: modelName,
          apiEndpoint: o.metadata && o.metadata.api_endpoint ? o.metadata.api_endpoint : '',
          input: parsedInput,
          expectedOutput: parsedOutput,
          outputMatchType: 'same_meaning',
          createdBy
        });
        console.log(`Created draft AI call ${step}/${validObservations.length} for draft ${draft.id}`);
        step++;
      }
      console.log(`Successfully created ${validObservations.length} draft AI calls for draft ${draft.id}`);
    } else {
      console.log(`Starting to create ${validObservations.length} AI calls for test case ${testCase.id}`);
      let step = 1;
      for (const o of validObservations) {
        let parsedInput = o.input;
        let parsedOutput = o.output;
        let apiBody = null;
        let modelName = o.name || '';

        if (o.metadata && o.metadata.attributes) {
          console.log('Processing observation metadata for test case body update:', o.id);
          const attributes = JSON.parse(o.metadata.attributes);

          // Extract model name from metadata
          if (attributes['elasticdash.observation.model.name']) {
            modelName = attributes['elasticdash.observation.model.name'];
          }

          if (attributes['elasticdash.trace.metadata.body']) {
            apiBody = attributes['elasticdash.trace.metadata.body'];
            try {
              const updateTCQuery = `
                UPDATE TestCases
                SET body = $1, updated_at = NOW(), updated_by = $2
                WHERE id = $3
              `;

              const updateTCValues = [JSON.stringify(apiBody), createdBy, testCase.id];
              await pool.query(updateTCQuery, updateTCValues)
              .catch(err => {
                console.error('Error updating test case body:', err);
                throw err;
              });
              console.log('Updated test case body from observation metadata for test case id:', testCase.id);
            } catch (e) {
              console.error('Error updating test case body:', e);
            }
          }
        }
        if (typeof o.input === 'string') {
          try {
            parsedInput = JSON.parse(o.input);
          } catch (e) {
            parsedInput = o.input;
          }
        }
        if (typeof o.output === 'string') {
          parsedOutput = o.output;
        }
        else {
          parsedOutput = JSON.stringify(o.output);
        }
        await module.exports.createAiCall({
          test_case_id: testCase.id,
          step_order: step,
          ai_model: modelName,
          api_endpoint: o.metadata && o.metadata.api_endpoint ? o.metadata.api_endpoint : '',
          input: parsedInput,
          expected_output: parsedOutput,
          output_match_type: 'same_meaning',
          createdBy
        });
        console.log(`Created AI call ${step}/${validObservations.length} for test case ${testCase.id}`);
        step++;
      }
      console.log(`Successfully created ${validObservations.length} AI calls for test case ${testCase.id}`);
    }

    // // 6. Calculate and store prompt fingerprint (only for actual test cases, not drafts)
    // if (!isDraft) {
    //   console.log(`Calculating prompt fingerprint for test case ${testCase.id}...`);
    //   try {
    //     const fingerprintResult = await analyzeTraceForFingerprint(trace, testCase.feature_id || null, createdBy);

    //     if (fingerprintResult.success && fingerprintResult.fingerprint) {
    //       // Update test case with fingerprint
    //       await pool.query(
    //         `UPDATE TestCases
    //          SET prompt_fingerprint = $1,
    //              prompt_fingerprint_updated_at = NOW(),
    //              updated_at = NOW(),
    //              updated_by = $2
    //          WHERE id = $3`,
    //         [fingerprintResult.fingerprint, createdBy, testCase.id]
    //       )
    //       .catch(err => {
    //         console.error('Error updating test case with prompt fingerprint:', err);
    //         throw err;
    //       });
    //       console.log(`✓ Stored prompt fingerprint for test case ${testCase.id}: ${fingerprintResult.fingerprint.substring(0, 16)}...`);
    //     } else {
    //       console.log(`⚠️  Could not calculate fingerprint for test case ${testCase.id}: ${fingerprintResult.error || 'Unknown error'}`);
    //     }
    //   } catch (fingerprintErr) {
    //     console.error(`✗ Error calculating fingerprint for test case ${testCase.id}:`, fingerprintErr);
    //     // Don't fail the entire operation if fingerprint calculation fails
    //   }
    // }

    // 7. Return test case detail or draft detail
    if (isDraft) {
      // Return draft information
      return {
        success: true,
        isDraft: true,
        draft: snake2Camel(draft),
        testCaseId: testCase.id,
        message: 'Draft created successfully and pending approval'
      };
    } else {
      return await module.exports.getTestCaseDetail(testCase.id);
    }
  }
  catch (error) {
    console.error('Error creating test case from trace:', error);
    return { success: false, error: error.message || error };
  }
}

// Get test case run details (AI calls and results)
export async function getTestCaseRunDetail(runId) {
  console.log('getTestCaseRunDetail is triggered for runId:', runId);
  // Get run info and test case name
  const runRes = await pool.query(
    `SELECT r.*, t.name as test_case_name
      FROM TestCaseRun r
      JOIN TestCases t ON r.test_case_id = t.id
      WHERE r.id = $1`,
    [runId]
  )
  .catch(err => {
    console.error('Error fetching test case run detail:', err);
    throw err;
  });
  if (!runRes.rows.length) return null;
  // Get all AI calls and their results for this run
  const aiCallsRes = await pool.query(
    `SELECT a.*, rac.input as run_input,
            rac.output as run_output, rac.validation_score,
            rac.status as run_status, rac.started_at as run_started_at,
            rac.completed_at as run_completed_at, rac.failure_reason,
            rac.prompt_drift_risk, rac.prompt_drift_details,
            rac.human_validation, rac.id AS rac_id
      FROM TestCaseRunAICall rac 
      LEFT JOIN AiCalls a ON a.id = rac.ai_call_id 
      AND a.test_case_id = $2
      AND a.input IS NOT NULL
      AND a.expected_output IS NOT NULL
      WHERE rac.test_case_run_id = $1
      AND rac.input IS NOT NULL
      AND rac.output IS NOT NULL
      AND rac.deleted = FALSE
      ORDER BY a.step_order ASC, rac.created_at ASC`,
    [runId, runRes.rows[0].test_case_id]
  )
  .catch(err => {
    console.error('Error fetching AI calls for test case run:', err);
    throw err;
  });
  return {
    run: snake2Camel(runRes.rows[0]),
    aiCalls: snake2Camel(aiCallsRes.rows),
  };
}

// List all test case runs with test case name, time, and status
export async function listTestCaseRuns(myId) {
  console.log('listTestCaseRuns is triggered');
  console.log('Input myId:', myId);
  const result = await pool.query(
    `SELECT r.id, r.test_case_id, t.name as test_case_name, r.status, r.started_at, r.completed_at,
            r.prompt_drift_detected, r.prompt_drift_severity
      FROM TestCaseRun r
      JOIN TestCases t ON r.test_case_id = t.id
      WHERE t.deleted = FALSE
        AND t.created_by = $1
      ORDER BY r.started_at DESC, r.id DESC`,
    [myId]
  )
  .catch(err => {
    console.error('Error listing test case runs:', err);
    throw err;
  });
  return result.rows;
}

export async function humanApproveTestCaseRunAICall({ testCaseRunAICallId, approved, reviewerId = 0 }) {
  console.log('humanApproveTestCaseRunAICall is triggered');
  console.log('Input:', { testCaseRunAICallId, approved, reviewerId });
  const result = await pool.query(
    `UPDATE TestCaseRunAICall
      SET human_validation = $1,
          updated_at = NOW(),
          updated_by = $2
      WHERE id = $3
      RETURNING *`,
    [approved, reviewerId, testCaseRunAICallId]
  )
  .catch(err => {
    console.error('Error updating human approval for TestCaseRunAICallId:', testCaseRunAICallId, err);
    throw err;
  });
  console.log('Update result:', result.rows[0]);
  return result.rows[0];
}

// Create a new test case run
export async function createTestCaseRun({ testCaseId, createdBy = 0 }) {
  console.log('createTestCaseRun is triggered');
  // Insert a new run with status 'pending', return the new run
  const result = await pool.query(
    `INSERT INTO TestCaseRun (test_case_id, status, created_by, updated_by, started_at)
    VALUES ($1, 'pending', $2, $2, NOW())
    RETURNING *`,
    [testCaseId, createdBy]
  )
  .catch(err => {
    console.error('Error creating test case run for testCaseId:', testCaseId, err);
    throw err;
  });
  return result.rows[0];
}

// Create a test case run record (batch execution)
export async function createTestCaseRunRecord({ testCaseIds, times = 1, createdBy = 0 }) {
  console.log('createTestCaseRunRecord is triggered');
  console.log('Input:', { testCaseIds, times, createdBy });

  // Validation
  if (!Array.isArray(testCaseIds) || testCaseIds.length === 0) {
    throw { status: 400, message: 'test_case_ids must be a non-empty array' };
  }

  if (times < 1) {
    throw { status: 400, message: 'times must be at least 1' };
  }

  if (times > 100) {
    throw { status: 400, message: 'times cannot exceed 100' };
  }

  // Verify all test cases exist
  const testCasesRes = await pool.query(
    `SELECT id FROM TestCases WHERE id = ANY($1) AND deleted = FALSE`,
    [testCaseIds]
  )
  .catch(err => {
    console.error('Error verifying test cases for testCaseIds:', testCaseIds, err);
    throw err;
  });

  if (testCasesRes.rows.length !== testCaseIds.length) {
    const foundIds = testCasesRes.rows.map(r => r.id);
    const missingIds = testCaseIds.filter(id => !foundIds.includes(id));
    throw { status: 404, message: `Test case(s) not found: ${missingIds.join(', ')}` };
  }

  // Create TestCaseRunRecords entry
  const recordRes = await pool.query(
    `INSERT INTO TestCaseRunRecords (test_case_ids, times, status, started_at, created_by, updated_by)
      VALUES ($1, $2, 'pending', NOW(), $3, $3)
      RETURNING *`,
    [testCaseIds, times, createdBy]
  )
  .catch(err => {
    console.error('Error creating TestCaseRunRecords entry:', err);
    throw err;
  });

  const record = recordRes.rows[0];
  let totalRunsCreated = 0;

  // Create TestCaseRun entries for each test case * times
  for (const testCaseId of testCaseIds) {
    for (let i = 0; i < times; i++) {
      await pool.query(
        `INSERT INTO TestCaseRun (test_case_id, test_case_run_record_id, status, created_by, updated_by, started_at)
          VALUES ($1, $2, 'pending', $3, $3, NOW())`,
        [testCaseId, record.id, createdBy]
      )
      .catch(err => {
        console.error('Error creating TestCaseRun for testCaseId:', testCaseId, 'recordId:', record.id, err);
        throw err;
      });
      totalRunsCreated++;
    }
  }

  return {
    ...record,
    total_runs_created: totalRunsCreated
  };
}

// Get test case run record detail with all associated runs
export async function getTestCaseRunRecordDetail(recordId) {
  console.log('getTestCaseRunRecordDetail is triggered');
  console.log('Input:', { recordId });

  // Get the record
  const recordRes = await pool.query(
    `SELECT * FROM TestCaseRunRecords WHERE id = $1 AND deleted = FALSE`,
    [recordId]
  );

  if (recordRes.rows.length === 0) {
    throw { status: 404, message: 'Test case run record not found' };
  }

  const record = recordRes.rows[0];

  // Get all TestCaseRun entries for this record using foreign key
  const runsRes = await pool.query(
    `SELECT r.id, r.test_case_id, t.name as test_case_name, r.status,
            r.started_at, r.completed_at, r.is_rerun, r.created_at
      FROM TestCaseRun r
      JOIN TestCases t ON r.test_case_id = t.id
      WHERE r.test_case_run_record_id = $1 AND r.deleted = FALSE
      ORDER BY r.test_case_id, r.started_at`,
    [recordId]
  )
  .catch(err => {
    console.error('Error fetching test case runs for recordId:', recordId, err);
    throw err;
  });

  const runs = runsRes.rows;

  // Calculate summary
  const summary = {
    total: runs.length,
    pending: runs.filter(r => r.status === 'pending').length,
    running: runs.filter(r => r.status === 'running').length,
    success: runs.filter(r => r.status === 'success').length,
    failed: runs.filter(r => r.status === 'failed').length
  };

  // Update record status based on runs
  let updatedStatus = record.status;
  if (summary.running > 0) {
    updatedStatus = 'Running';
  } else if (summary.pending === 0 && summary.running === 0) {
    updatedStatus = 'Success';
  }

  // Update record status if changed
  if (updatedStatus !== record.status) {
    await pool.query(
      `UPDATE TestCaseRunRecords
        SET status = $1::VARCHAR(50),
            completed_at = CASE 
            WHEN $1::VARCHAR(50) = 'Success' 
            THEN NOW() 
            ELSE completed_at END,
            updated_at = NOW()
        WHERE id = $2 AND deleted = FALSE`,
      [updatedStatus, recordId]
    )
    .catch(err => {
      console.error('Error updating test case run record status for recordId:', recordId, err);
      throw err;
    });
    record.status = updatedStatus;
    if (updatedStatus === 'Success') {
      record.completed_at = new Date();
    }
  }

  return {
    record: snake2Camel(record),
    runs: snake2Camel(runs),
    summary: summary
  };
}

// List all test case run records with aggregated statistics
export async function listTestCaseRunRecords(myId) {
  console.log('listTestCaseRunRecords is triggered');

  const caseList = await pool.query(
    `SELECT id
    FROM TestCases
    WHERE deleted = FALSE
    AND created_by = $1`, [myId]
  );

  const testCaseIds = caseList.rows.map(r => r.id);

  const recordsRes = await pool.query(
    `
      SELECT *
      FROM TestCaseRunRecords
      WHERE deleted = FALSE
        AND test_case_ids && $1
      ORDER BY created_at DESC;
    `,
    [testCaseIds]
  );

  const records = recordsRes.rows;
  const results = [];

  for (const record of records) {
    // Get run statistics for this record using foreign key
    const statsRes = await pool.query(
      `SELECT
          COUNT(*) as total_runs,
          COUNT(CASE WHEN LOWER(status) = 'success' THEN 1 END) as successful_runs,
          COUNT(CASE WHEN LOWER(status) = 'failed' THEN 1 END) as failed_runs,
          COUNT(CASE WHEN LOWER(status) = 'pending' THEN 1 END) as pending_runs,
          COUNT(CASE WHEN LOWER(status) = 'running' THEN 1 END) as running_runs,
          ARRAY_AGG(id) as run_ids
        FROM TestCaseRun
        WHERE test_case_run_record_id = $1 AND deleted = FALSE`,
      [record.id]
    )
    .catch(err => {
      console.error('Error fetching run statistics for record:', record.id, err);
      throw err;
    });

    const stats = statsRes.rows[0];

    const testCaseRunIds = stats.run_ids || [];

    const aiCallRes = await pool.query(
      `SELECT COUNT(*) as total_ai_calls,
          COUNT(CASE WHEN (
            (LOWER(status) = 'success' AND human_validation IS NULL) OR
            (human_validation = TRUE)
          ) THEN 1 END) as successful_ai_calls,
          COUNT(CASE WHEN LOWER(status) = 'failed' THEN 1 END) as failed_ai_calls
        FROM TestCaseRunAICall
        WHERE test_case_run_id = ANY($1) 
        AND input IS NOT NULL
        AND output IS NOT NULL
        AND deleted = FALSE`,
      [testCaseRunIds]
    )
    .catch(err => {
      console.error('Error fetching AI call statistics for record:', record.id, err);
      throw err;
    });

    const aiCallStats = aiCallRes.rows[0];

    results.push({
      id: record.id,
      test_case_ids: record.test_case_ids,
      times: record.times,
      status: record.status,
      total_runs: parseInt(stats.total_runs),
      successful_runs: parseInt(stats.successful_runs),
      failed_runs: parseInt(stats.failed_runs),
      pending_runs: parseInt(stats.pending_runs),
      running_runs: parseInt(stats.running_runs),
      total_ai_calls: parseInt(aiCallStats.total_ai_calls),
      successful_ai_calls: parseInt(aiCallStats.successful_ai_calls),
      failed_ai_calls: parseInt(aiCallStats.failed_ai_calls),
      created_at: record.created_at,
      started_at: record.started_at,
      completed_at: record.completed_at
    });
  }

  return snake2Camel(results);
}

// Update TestCaseRunRecords status based on associated runs
export async function updateTestCaseRunRecordStatus(recordId) {
  console.log('updateTestCaseRunRecordStatus is triggered');
  console.log('Input:', { recordId });

  // Get all runs for this record
  const runsRes = await pool.query(
    `SELECT status FROM TestCaseRun WHERE test_case_run_record_id = $1`,
    [recordId]
  )
  .catch(err => {
    console.error('Error fetching runs for record:', recordId, err);
    throw err;
  });

  const runs = runsRes.rows;
  if (runs.length === 0) {
    return null; // No runs associated
  }

  const allDone = runs.every(r => r.status === 'success' || r.status === 'failed');
  const anyRunning = runs.some(r => r.status === 'running');

  let newStatus = 'pending';
  if (anyRunning) {
    newStatus = 'running';
  } else if (allDone) {
    newStatus = 'Success';
  }

  // Update record status
  await pool.query(
    `UPDATE TestCaseRunRecords
      SET status = $1::VARCHAR(50),
          completed_at = CASE 
          WHEN $1::VARCHAR(50) = 'Success' 
          THEN NOW() 
          ELSE completed_at END,
          updated_at = NOW()
      WHERE id = $2`,
    [newStatus, recordId]
  )
  .catch(err => {
    console.error('Error updating status for record:', recordId, err);
    throw err;
  });

  console.log(`TestCaseRunRecords ${recordId} status updated to: ${newStatus}`);
  return newStatus;
}

export async function listTestCaseDraftsByTestCaseId(testCaseId, myId) {
  console.log('listTestCaseDraftsByTestCaseId is triggered');
  console.log('Input:', { testCaseId, myId });

  if (!testCaseId) {
    throw { status: 400, message: 'testCaseId is required' };
  }

  const query = `
    SELECT d.*, t.name as test_case_name
    FROM TestCaseDrafts d
    JOIN TestCases t ON d.test_case_id = t.id
    WHERE d.test_case_id = $1
      AND t.created_by = $2
      AND d.deleted = FALSE
    ORDER BY d.created_at DESC
  `;

  const result = await pool.query(query, [testCaseId, myId])
  .catch(err => {
    console.error('Error fetching test case drafts for test case:', testCaseId, err);
    throw err;
  });
  return snake2Camel(result.rows);
}

// List test case drafts by test case run record ID
export async function listTestCaseDrafts(testCaseRunRecordId) {
  console.log('listTestCaseDrafts is triggered');
  console.log('Input:', { testCaseRunRecordId });

  if (!testCaseRunRecordId) {
    throw { status: 400, message: 'testCaseRunRecordId is required' };
  }

  const query = `
    SELECT d.*, t.name as test_case_name
    FROM TestCaseDrafts d
    JOIN TestCases t ON d.test_case_id = t.id
    WHERE d.test_case_run_record_id = $1
      AND d.deleted = FALSE
    ORDER BY d.created_at DESC
  `;

  const result = await pool.query(query, [testCaseRunRecordId])
  .catch(err => {
    console.error('Error fetching test case drafts for record:', testCaseRunRecordId, err);
    throw err;
  });
  return snake2Camel(result.rows);
}

// Get test case draft detail with AI calls
export async function getTestCaseDraftDetail(draftId) {
  console.log('getTestCaseDraftDetail is triggered');
  console.log('Input:', { draftId });

  // Get draft info
  const draftRes = await pool.query(
    `SELECT d.*, t.name as test_case_name
      FROM TestCaseDrafts d
      JOIN TestCases t ON d.test_case_id = t.id
      WHERE d.id = $1 AND d.deleted = FALSE`,
    [draftId]
  )
  .catch(err => {
    console.error('Error fetching draft detail for draft:', draftId, err);
    throw err;
  });

  if (draftRes.rows.length === 0) {
    throw { status: 404, message: 'Draft not found' };
  }

  // Get all draft AI calls
  const aiCallsRes = await pool.query(
    `SELECT * FROM TestCaseDraftAiCalls
      WHERE test_case_draft_id = $1
      AND input IS NOT NULL
      AND expected_output IS NOT NULL
      AND deleted = FALSE
      ORDER BY step_order`,
    [draftId]
  )
  .catch(err => {
    console.error('Error fetching draft AI calls for draft:', draftId, err);
    throw err;
  });

  return {
    draft: snake2Camel(draftRes.rows[0]),
    aiCalls: snake2Camel(aiCallsRes.rows)
  };
}

// Approve a draft and apply changes to test case
export async function approveDraft(draftId, userId = 0) {
  console.log('approveDraft is triggered');
  console.log('Input:', { draftId, userId });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get draft details
    const draftRes = await client.query(
      `SELECT * FROM TestCaseDrafts WHERE id = $1 AND deleted = FALSE`,
      [draftId]
    )
    .catch(err => {
      console.error('Error fetching draft details for draft:', draftId, err);
      throw err;
    });

    if (draftRes.rows.length === 0) {
      throw { status: 404, message: 'Draft not found' };
    }

    const draft = draftRes.rows[0];

    if (draft.status === 2) {
      throw { status: 400, message: 'Draft already approved' };
    }

    if (draft.status === 3) {
      throw { status: 400, message: 'Draft was rejected and cannot be approved' };
    }

    // Update draft status to approved
    await client.query(
      `UPDATE TestCaseDrafts
        SET status = 2, updated_at = NOW(), updated_by = $2
        WHERE id = $1`,
      [draftId, userId]
    )
    .catch(err => {
      console.error('Error updating draft status to approved for draft:', draftId, err);
      throw err;
    });

    // Mark all existing AI calls for the test case as deleted
    await client.query(
      `UPDATE AiCalls
        SET deleted = TRUE, updated_at = NOW(), updated_by = $2
        WHERE test_case_id = $1 AND deleted = FALSE`,
      [draft.test_case_id, userId]
    )
    .catch(err => {
      console.error('Error marking existing AI calls as deleted for test case:', draft.test_case_id, err);
      throw err;
    });

    // Get all draft AI calls
    const draftAiCallsRes = await client.query(
      `SELECT * FROM TestCaseDraftAiCalls
        WHERE test_case_draft_id = $1
        ORDER BY step_order`,
      [draftId]
    );

    // Create new AI calls from draft
    for (const draftAiCall of draftAiCallsRes.rows) {
      await client.query(
        `INSERT INTO AiCalls
          (test_case_id, step_order, ai_model, api_endpoint, input, expected_output, output_match_type, created_by, updated_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          draft.test_case_id,
          draftAiCall.step_order,
          draftAiCall.ai_model,
          draftAiCall.api_endpoint,
          draftAiCall.input,
          draftAiCall.expected_output,
          draftAiCall.output_match_type,
          userId
        ]
      )
      .catch(err => {
        console.error('Error creating AI call from draft for test case:', draft.test_case_id, err);
        throw err;
      });
    }

    // Update test case with draft data if needed
    await client.query(
      `UPDATE TestCases
        SET trace_id = $2,
            api_url = $3,
            http_method = $4,
            body = $5,
            updated_at = NOW(),
            updated_by = $6
        WHERE id = $1`,
      [
        draft.test_case_id,
        draft.trace_id,
        draft.api_url,
        draft.http_method,
        draft.body,
        userId
      ]
    )
    .catch(err => {
      console.error('Error updating test case with draft data for test case:', draft.test_case_id, err);
      throw err;
    });

    await client.query('COMMIT');

    console.log(`Draft ${draftId} approved and applied to test case ${draft.test_case_id}`);

    return {
      success: true,
      message: 'Draft approved and applied successfully',
      testCaseId: draft.test_case_id
    };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error approving draft:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Reject a draft
export async function rejectDraft(draftId, userId = 0) {
  console.log('rejectDraft is triggered');
  console.log('Input:', { draftId, userId });

  // Get draft to check status
  const draftRes = await pool.query(
    `SELECT status FROM TestCaseDrafts WHERE id = $1 AND deleted = FALSE`,
    [draftId]
  )
  .catch(err => {
    console.error('Error fetching draft details for draft:', draftId, err);
    throw err;
  });

  if (draftRes.rows.length === 0) {
    throw { status: 404, message: 'Draft not found' };
  }

  const draft = draftRes.rows[0];

  if (draft.status === 2) {
    throw { status: 400, message: 'Draft already approved and cannot be rejected' };
  }

  if (draft.status === 3) {
    throw { status: 400, message: 'Draft already rejected' };
  }

  // Update draft status to rejected
  await pool.query(
    `UPDATE TestCaseDrafts
      SET status = 3, updated_at = NOW(), updated_by = $2
      WHERE id = $1`,
    [draftId, userId]
  )
  .catch(err => {
    console.error('Error updating draft status to rejected for draft:', draftId, err);
    throw err;
  });

  console.log(`Draft ${draftId} rejected`);

  return {
    success: true,
    message: 'Draft rejected successfully'
  };
}

// Reset a test case's flow by fetching new flow from project URL and trace metadata
export async function resetTestCaseFlow({ testCaseId, testCaseRunRecordId, userId }) {
  console.log('resetTestCaseFlow is triggered for testCaseId:', testCaseId);
  console.log('[resetTestCaseFlow] Step 1: Fetching test case from DB...');
  try {
    // 1. Fetch test case
    const testCaseRes = await pool.query(
      `SELECT * FROM TestCases WHERE id = $1 AND deleted = FALSE`,
      [testCaseId]
    )
    .catch(err => {
      console.error('Error fetching test case for testCaseId:', testCaseId, err);
      throw err;
    });
    if (!testCaseRes.rows.length) {
      throw { success: false, message: 'Test case not found' };
    }
    const testCase = testCaseRes.rows[0];

    console.log('[resetTestCaseFlow] Step 2: Fetching associated test project...');
    // 2. Fetch associated test project
    const projectRes = await pool.query(
      `SELECT * FROM TestProjects WHERE id = $1 AND deleted = FALSE`,
      [testCase.test_project_id || testCase.project_id]
    )
    .catch(err => {
      console.error('Error fetching test project for test case id:', testCaseId, err);
      throw err;
    });
    if (!projectRes.rows.length) {
      console.log('Test project not found for test case id:', testCaseId);
      throw { success: false, message: 'Test project not found' };
    }
    const testProject = projectRes.rows[0];
    if (!testProject.api_base_url) {
      console.log('Test project does not have a base URL for test case id:', testCaseId);
      throw { success: false, message: 'Test project does not have a base URL' };
    }

    console.log('[resetTestCaseFlow] Step 3: Fetching latest trace from ClickHouse...');
    const route = testCase.api_url;
    const method = testCase.http_method;
    if (testCase.body) {
      console.log('testCase.body: ', testCase.body);
    }
    const body = testCase.body ? (
      typeof testCase.body === 'object' ? testCase.body :
        JSON.parse(testCase.body)
    ) : null;
    if (!route) {
      throw { success: false, message: 'Trace does not contain API route in metadata' };
    }

    console.log('[resetTestCaseFlow] Step 4: Building endpoint URL...');
    // 4. Build endpoint URL
    let endpoint = testProject.api_base_url;
    if (!endpoint.endsWith('/') && !route.startsWith('/')) endpoint += '/';
    endpoint += route.startsWith('/') ? route : '/' + route;

    console.log('[resetTestCaseFlow] Step 5: Calling endpoint to fetch new flow...');
    // 5. Call endpoint to fetch new flow, include X-Reset-Test-Case header
    console.log('Fetching new flow from endpoint:', endpoint);
    console.log('Using method:', method);
    const fetch = (await import('node-fetch')).default;
    let flowResponse;
    try {
      const headers = {
        'X-Reset-Test-Case': String(testCaseId),
        'X-Reset-Test-Case-Run-Record': String(testCaseRunRecordId),
        'X-User-Id': String(userId),
        'Authorization': testProject.oauth_token ? `Bearer ${testProject.oauth_token}` : undefined
      };
      console.log('Using headers:', headers);
      console.log('Using body:', body);
      flowResponse = fetch(endpoint, {
        method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined
      });
    } catch (err) {
      throw { success: false, message: 'Failed to call test project endpoint: ' + err.message };
    }
    // if (!flowResponse.ok) {
    //   throw { success: false, message: `Failed to fetch new flow: ${flowResponse.status} ${flowResponse.statusText}` };
    // }
    // let newFlow;
    // try {
    //   newFlow = await flowResponse.json();
    // } catch (err) {
    //   throw { success: false, message: 'Failed to parse new flow as JSON: ' + err.message };
    // }
    // if (!Array.isArray(newFlow) && typeof newFlow !== 'object') {
    //   throw { success: false, message: 'Fetched flow is not valid JSON array/object' };
    // }

    console.log('[resetTestCaseFlow] Step 6: Flow fetched and parsed successfully. Returning result.');
    return {
      success: true,
      message: 'Test case flow reset successfully. Old AI calls deleted. Please create new AI calls based on the fetched flow.',
      testCaseId,
      // newFlow
    };
  } catch (err) {
    console.error('Error in resetTestCaseFlow:', err);
    throw { success: false, message: err.message || err };
  }
}
// Accept a rerun: mark others outdated, replace AI calls
export async function acceptTestCaseRerun({ testCaseRunId, userId }) {
  console.log('acceptTestCaseRerun is triggered for testCaseRunId:', testCaseRunId);
  // Input validation
  if (!testCaseRunId) {
    throw { status: 400, message: 'testCaseRunId is required' };
  }

  // Start processing
  try {
    // 1. Fetch the test case run
    const runRes = await pool.query(
      `UPDATE TestCaseRun 
      SET status = 'benchmark', 
      updated_at = NOW(), 
      updated_by = $2,
      deleted = TRUE
      WHERE id = $1 
      AND deleted = FALSE 
      RETURNING *`,
      [testCaseRunId, userId]
    )
    .catch(err => {
      console.error('Error updating test case run to benchmark for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    if (!runRes.rows.length) {
      throw { status: 404, message: 'Test case run not found' };
    }
    const run = runRes.rows[0];
    if (!run.is_rerun) {
      throw { status: 400, message: 'This test case run is not a rerun and cannot be accepted.' };
    }
    // 2. Mark all other runs as outdated
    await pool.query(
      `UPDATE TestCaseRun SET status = 'outdated', updated_at = NOW(), updated_by = $1, deleted = TRUE
      WHERE test_case_id = $2 AND test_case_run_record_id = $3 
      AND status != 'outdated' AND deleted = FALSE
      AND id != $4
      RETURNING id`,
      [userId, run.test_case_id, run.test_case_run_record_id, testCaseRunId]
    )
    .catch(err => {
      console.error('Error marking other test case runs as outdated for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    // 3. Delete all existing AI calls for the test case
    await pool.query(
      `UPDATE AiCalls SET deleted = TRUE, updated_at = NOW(), updated_by = $1 
      WHERE test_case_id = $2 AND deleted = FALSE`,
      [userId, run.test_case_id]
    )
    .catch(err => {
      console.error('Error marking existing AI calls as deleted for test case:', run.test_case_id, err);
      throw err;
    });
    // 4. Get all AI calls from this run
    const aiCallRes = await pool.query(
      `
        SELECT * FROM TestCaseRunAICall 
        WHERE test_case_run_id = $1 
        AND input IS NOT NULL
        AND output IS NOT NULL
        AND deleted = FALSE
      `,
      [testCaseRunId]
    )
    .catch(err => {
      console.error('Error fetching AI calls for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    const aiCalls = aiCallRes.rows;
    // 5. Create new AI calls for the test case
    for (const call of aiCalls) {
      // Ensure input is valid JSON for Postgres JSON column
      let input = call.input;
      if (typeof input !== 'string') {
        input = JSON.stringify(input);
      }
      let expectedOutput = call.output;
      if (typeof expectedOutput !== 'string') {
        expectedOutput = JSON.stringify(expectedOutput);
      }
      await pool.query(
        `INSERT INTO AiCalls 
        (
          test_case_id, 
          step_order, 
          ai_model, 
          api_endpoint, 
          input, 
          expected_output, 
          output_match_type, 
          created_by, 
          updated_by
        )
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          run.test_case_id,
          call.step_order || 1,
          call.ai_model || '',
          call.api_endpoint || '',
          input,
          expectedOutput || '',
          call.output_match_type || 'exact',
          userId
        ]
      )
      .catch(err => {
        console.error('Error inserting AI call during rerun acceptance:', err);
        throw err;
      });
    }

    console.log(`Accepted rerun ${testCaseRunId} for test case ${run.test_case_id}, created ${aiCalls.length} new AI calls.`);

    return { success: true };
  }
  catch (err) {
    console.error('Error accepting test case rerun:', err);
    throw { success: false, message: err.message || err };
  }
}
// Reject a rerun: mark it as deleted
export async function rejectTestCaseRerun({ testCaseRunId, userId }) {
  console.log('rejectTestCaseRerun is triggered for testCaseRunId:', testCaseRunId);
  // Input validation
  if (!testCaseRunId) {
    throw { status: 400, message: 'testCaseRunId is required' };
  }

  // Start processing
  try {
    // 1. Fetch the test case run
    const runRes = await pool.query(
      `UPDATE TestCaseRun 
      SET deleted = TRUE, 
      updated_at = NOW(), 
      updated_by = $2
      WHERE id = $1 
      AND deleted = FALSE 
      RETURNING *`,
      [testCaseRunId, userId]
    )
    .catch(err => {
      console.error('Error updating test case run to deleted for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    if (!runRes.rows.length) {
      throw { status: 404, message: 'Test case run not found' };
    }
    const run = runRes.rows[0];
    if (!run.is_rerun) {
      throw { status: 400, message: 'This test case run is not a rerun and cannot be rejected.' };
    }

    console.log(`Rejected rerun ${testCaseRunId} for test case ${run.test_case_id}.`);

    return { success: true };
  }
  catch (err) {
    console.error('Error rejecting test case rerun:', err);
    throw { success: false, message: err.message || err };
  }
}
export async function createTestCaseByRerun({ testCaseRunId, name, userId = 0 }) {
  console.log('createTestCaseByRerun is triggered for testCaseRunId:', testCaseRunId);
  // Input validation
  if (!testCaseRunId) {
    throw { status: 400, message: 'testCaseRunId is required' };
  }

  try {
    // 1. Fetch the test case run
    const runRes = await pool.query(
      `SELECT * FROM TestCaseRun 
      WHERE id = $1 
      AND deleted = FALSE`,
      [testCaseRunId]
    )
    .catch(err => {
      console.error('Error fetching test case run for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    if (!runRes.rows.length) {
      throw { status: 404, message: 'Test case run not found' };
    }
    const run = runRes.rows[0];
    if (!run.is_rerun) {
      throw { status: 400, message: 'This test case run is not a rerun and cannot be used to create a new test case.' };
    }
    // 2. Create a new test case based on the run's test case
    const originalTestCaseRes = await pool.query(
      `SELECT * FROM TestCases 
      WHERE id = $1 
      AND deleted = FALSE`,
      [run.test_case_id]
    )
    .catch(err => {
      console.error('Error fetching original test case for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    if (!originalTestCaseRes.rows.length) {
      throw { status: 404, message: 'Original test case not found' };
    }
    const originalTestCase = originalTestCaseRes.rows[0];
    const newTestCaseRes = await pool.query(
      `INSERT INTO TestCases 
      (name, description, project_id, trace_id, api_url, http_method, body, created_by, updated_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8) 
      RETURNING *`,
      [
        name || originalTestCase.name + ' (Rerun Copy)',
        originalTestCase.description,
        originalTestCase.project_id,
        originalTestCase.trace_id,
        originalTestCase.api_url,
        originalTestCase.http_method,
        originalTestCase.body,
        userId,
      ]
    );
    const newTestCase = newTestCaseRes.rows[0];
    // 3. Copy AI calls from the rerun to the new test case
    const aiCallRes = await pool.query(
      `
        SELECT * FROM TestCaseRunAICall
        WHERE test_case_run_id = $1
        AND input IS NOT NULL
        AND output IS NOT NULL
        AND deleted = FALSE
      `,
      [testCaseRunId]
    )
    .catch(err => {
      console.error('Error fetching AI calls for testCaseRunId:', testCaseRunId, err);
      throw err;
    });
    const aiCalls = aiCallRes.rows;
    for (const call of aiCalls) {
      // Ensure input is valid JSON for Postgres JSON column
      let input = call.input;
      if (typeof input !== 'string') {
        input = JSON.stringify(input);
      }
      let expectedOutput = call.output;
      if (typeof expectedOutput !== 'string') {
        expectedOutput = JSON.stringify(expectedOutput);
      }
      await pool.query(
        `INSERT INTO AiCalls 
        (
          test_case_id, 
          step_order, 
          ai_model, 
          api_endpoint, 
          input, 
          expected_output, 
          output_match_type, 
          created_by, 
          updated_by
        )
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
        [
          newTestCase.id,
          call.step_order || 1,
          call.ai_model || '',
          call.api_endpoint || '',
          input,
          expectedOutput || '',
          call.output_match_type || 'exact',
          userId
        ]
      )
      .catch(err => {
        console.error('Error inserting AI call during test case creation from rerun:', err);
        throw err;
      });
    }

    console.log(`Created new test case ${newTestCase.id} from rerun ${testCaseRunId}, copied ${aiCalls.length} AI calls.`);

    await rejectTestCaseRerun({ testCaseRunId, userId });

    return { success: true, testCase: snake2Camel(newTestCase) };
  }
  catch (err) {
    console.error('Error creating test case from rerun:', err);
    throw { success: false, message: err.message || err };
  }
}

export async function listSupportedAiModels(searchTerm = '') {
  console.log('listSupportedAiModels is triggered');
  console.log('Input:', { searchTerm });

  const query = `
    SELECT * FROM SupportedAiModels
    WHERE deleted = FALSE
    AND (name ILIKE $1 OR description ILIKE $1)
    ORDER BY created_at DESC
  `;

  const result = await pool.query(query, [`%${searchTerm}%`])
  .catch(err => {
    console.error('Error fetching supported AI models with search term:', searchTerm, err);
    throw err;
  });
  return snake2Camel(result.rows);
}
