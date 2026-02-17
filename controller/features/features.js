import { pool } from '../../postgres.js';
import { createClient } from '@clickhouse/client';
import { sendRequestToOpenAI } from '../general/aihandler.js';
import { createTestCaseRunFromTrace } from '../testcases/testCaseController.js';
import dotenv from 'dotenv';
dotenv.config();

const clickhouseClient = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

// Helper function to get user's test project
export async function getUserTestProjectStringIdAndId(userId) {
    const query = `
        SELECT id, project_id
        FROM TestProjects
        WHERE user_id = $1 AND deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
    `;
    try {
        const result = await pool.query(query, [userId]);
        if (result.rowCount > 0) {
            return result.rows[0];
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching user test project:', error);
        throw error;
    }
}

export async function listFeaturesByTestProjectIdStr(testProjectIdStr) {
    console.log('listFeaturesByTestProjectIdStr is triggered');
    console.log('Input:', { testProjectIdStr });

    try {
        const query = `
            SELECT tpf.id, tpf.test_project_id, tpf.feature_name, tpf.displayed_name, tpf.feature_description, tpf.enabled,
                tpf.prompt_changed_risk, tpf.created_at, tpf.created_by, tpf.updated_at, tpf.updated_by
            FROM TestProjectFeatures tpf, TestProjects tp
            WHERE tpf.test_project_id = tp.id 
            AND tp.project_id = $1
            AND tpf.deleted = FALSE
            AND tp.deleted = FALSE
            ORDER BY tpf.created_at DESC
        `;

        const result = await pool.query(query, [testProjectIdStr])
        .catch(err => {
            console.error('Error fetching features by test project ID:', err);
            throw err;
        });

        return result.rows;
    }
    catch (err) {
        console.error('Error in listFeaturesByTestProjectIdStr:', err);
        throw err;
    }
}

// 1. List Features by test_project_id
export async function listFeatures(myId) {
    console.log('listFeatures is triggered');
    console.log('Input:', { myId });
    let testProjectId;
  
    const project = await getUserTestProjectStringIdAndId(myId);
    if (project) {
        testProjectId = project.id;
    } else {
        throw { status: 404, message: 'Test project not found for user' };
    }

    try {
        const query = `
            SELECT tpf.id, tpf.test_project_id, tpf.feature_name, tpf.displayed_name, tpf.feature_description, tpf.enabled,
                tpf.prompt_changed_risk, tpf.created_at, tpf.created_by, tpf.updated_at, tpf.updated_by
            FROM TestProjectFeatures tpf, TestProjects tp
            WHERE tpf.test_project_id = tp.id 
            AND tp.id = $1
            AND tpf.deleted = FALSE
            AND tp.deleted = FALSE
            ORDER BY tpf.created_at DESC
        `;
        const values = [testProjectId];
        const result = await pool.query(query, values)
        .catch(err => {
            console.error('Error fetching features by test project ID:', err);
            throw err;
        });

        if (result.rowCount === 0) {
            console.log('No features found for test project ID:', testProjectId);
            console.log('query: ', query);
            console.log('values: ', values);
            console.log('result: ', result);
        }
        return result.rows;
    } catch (err) {
        console.error('Error in listFeatures:', err);
        throw err;
    }
}

// 2. Get Feature By ID
export async function getFeatureById(id, userId) {
    console.log('getFeatureById is triggered');
    console.log('Input:', { id, userId });
    let testProjectId;
    // Get user's test project to validate ownership
    const project = await getUserTestProjectStringIdAndId(userId);
    if (!project) {
        throw { status: 404, message: 'Test project not found for user' };
    }
    testProjectId = project.id;

    const query = `
        SELECT id, test_project_id, feature_name, displayed_name, feature_description, enabled,
               prompt_changed_risk, created_at, created_by, updated_at, updated_by
        FROM TestProjectFeatures
        WHERE id = $1 AND test_project_id = $2 AND deleted = FALSE
    `;

    try {
        const result = await pool.query(query, [id, testProjectId]);
        if (result.rows.length === 0) {
            throw { status: 404, message: 'Feature not found' };
        }
        return result.rows[0];
    } catch (err) {
        console.error('Error in getFeatureById:', err);
        throw err;
    }
}

// 3. Create Feature
export async function createFeature(testProjectId, featureName, featureDescription, enabled, userId) {
    console.log('createFeature is triggered');
    console.log('Input:', { testProjectId, featureName, featureDescription, enabled, userId });

    if (typeof testProjectId === 'string') {
        const projectQuery = `
            SELECT id FROM TestProjects
            WHERE project_id = $1 AND deleted = FALSE;
        `;

        const projectResult = await pool.query(projectQuery, [testProjectId]);
        if (projectResult.rows.length === 0) {
            throw { status: 404, message: 'Test project not found' };
        }
        testProjectId = projectResult.rows[0].id;
    }

    const query = `
        INSERT INTO TestProjectFeatures
        (test_project_id, feature_name, displayed_name, feature_description, enabled, created_by, updated_by)
        VALUES ($1, $2, $2, $3, $4, $5, $5)
        RETURNING id, test_project_id, feature_name, displayed_name, feature_description, enabled,
                  created_at, created_by, updated_at, updated_by
    `;

    try {
        const result = await pool.query(query, [
            testProjectId,
            featureName,
            featureDescription,
            enabled !== undefined ? enabled : true,
            userId
        ]);
        return result.rows[0];
    } catch (err) {
        console.error('Error in createFeature:', err);
        throw err;
    }
}

// 4. Update Feature
export async function updateFeature(id, displayedName, enabled, userId) {
    console.log('updateFeature is triggered');
    console.log('Input:', { id, displayedName, enabled, userId });

    // Get user's test project to validate ownership
    const project = await getUserTestProjectStringIdAndId(userId);
    if (!project) {
        throw { status: 404, message: 'Test project not found for user' };
    }
    let testProjectId = project.id;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (displayedName !== undefined) {
        updates.push(`displayed_name = $${paramCount}`);
        values.push(displayedName);
        paramCount++;
    }

    if (enabled !== undefined) {
        updates.push(`enabled = $${paramCount}`);
        values.push(enabled);
        paramCount++;
    }

    if (updates.length === 0) {
        throw { status: 400, message: 'No fields to update' };
    }

    updates.push(`updated_by = $${paramCount}`);
    values.push(userId);
    paramCount++;

    updates.push(`updated_at = NOW()`);

    values.push(id);
    values.push(testProjectId);

    const query = `
        UPDATE TestProjectFeatures
        SET ${updates.join(', ')}
        WHERE id = $${paramCount} AND test_project_id = $${paramCount + 1} AND deleted = FALSE
        RETURNING id, test_project_id, feature_name, displayed_name, enabled,
                  created_at, created_by, updated_at, updated_by
    `;

    try {
        const result = await pool.query(query, values);
        if (result.rows.length === 0) {
            throw { status: 404, message: 'Feature not found' };
        }
        return result.rows[0];
    } catch (err) {
        console.error('Error in updateFeature:', err);
        throw err;
    }
}

// 5. Delete Feature (soft delete)
export async function deleteFeature(id, userId) {
    console.log('deleteFeature is triggered');
    console.log('Input:', { id, userId });
    let testProjectId;
    // Get user's test project to validate ownership
    const project = await getUserTestProjectStringIdAndId(userId);
    if (!project) {
        throw { status: 404, message: 'Test project not found for user' };
    }
    testProjectId = project.id;

    const query = `
        UPDATE TestProjectFeatures
        SET deleted = TRUE, updated_by = $1, updated_at = NOW()
        WHERE id = $2 AND test_project_id = $3 AND deleted = FALSE
        RETURNING id
    `;

    try {
        const result = await pool.query(query, [userId, id, testProjectId]);
        if (result.rows.length === 0) {
            throw { status: 404, message: 'Feature not found' };
        }
        return { success: true };
    } catch (err) {
        console.error('Error in deleteFeature:', err);
        throw err;
    }
}

// // Helper function to build LLM prompt for prompt drift detection
// function buildPromptDriftDetectionPrompt(currentObservations, prevObservations) {
//     // For simplicity, compare all current prompts to previous prompts
//     // LLM will decide if any prompt in the current flow is significantly changed compared to previous
//     const currentPrompts = currentObservations.map((obs, idx) => `Current Prompt ${idx + 1}: ${typeof obs.input === 'string' ? obs.input.substring(0, 500) : JSON.stringify(obs.input).substring(0, 500)}`).join('\n');
//     const prevPrompts = prevObservations.map((obs, idx) => `Previous Prompt ${idx + 1}: ${typeof obs.input === 'string' ? obs.input.substring(0, 500) : JSON.stringify(obs.input).substring(0, 500)}`).join('\n');
//     return `You are comparing two sets of prompts (inputs) from two traces of the same feature in an AI system.\n\nCURRENT PROMPTS:\n${currentPrompts}\n\nPREVIOUS PROMPTS:\n${prevPrompts}\n\nTASK:\n- Determine if any prompt in the current set appears to have changed in intent, structure, or meaning compared to the previous set.\n- If any prompt is changed, respond with { "prompt_changed": true }\n- If all prompts are essentially the same, respond with { "prompt_changed": false }\n- Only mark as changed if the difference is likely to affect the feature's behavior or output.\n\nResponse format (valid JSON only):\n{ "prompt_changed": boolean }`;
// }

// 6. Analyze Trace Feature (AI-Powered)
export async function analyzeTraceFeature(traceId) {
    console.log('analyzeTraceFeature is triggered');
    console.log('Input:', { traceId });

    try {
        // Step 2: Fetch trace details with observations from ClickHouse
        const traceQuery = `SELECT * FROM traces WHERE id = '${traceId}' AND is_deleted = 0 LIMIT 1`;
        const traceResult = await clickhouseClient.query({ query: traceQuery });
        const traceData = await traceResult.json();

        if (!traceData || !traceData.data || traceData.data.length === 0) {
            throw { status: 404, message: 'Trace not found' };
        }

        const trace = traceData.data[0];

        // Fetch observations with valid input/output
        // Use mapGet for Map(String, String) metadata column in ClickHouse
        const observationQuery = `
            SELECT
                o.id,
                o.input,
                o.output,
                o.provided_model_name,
                o.name,
                o.type,
                o.metadata,
                o.trace_id,
                JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') AS obs_input,
                JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') AS obs_output,
                JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') AS obs_model_name
            FROM observations AS o
            WHERE o.trace_id = '${traceId}'
                AND o.name != 'handleChatRequest'
                AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') IS NOT NULL
                AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.input') != ''
                AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') IS NOT NULL
                AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.output') != ''
                AND (
                    (JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') IS NOT NULL AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model.name') != '')
                    OR
                    (JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model') IS NOT NULL AND JSONExtractString(o.metadata['attributes'], 'elasticdash.observation.model') != '')
                )
            LIMIT 100
        `;
        const observationResult = await clickhouseClient.query({ query: observationQuery });
        const observationData = await observationResult.json();
        let observations = observationData?.data || [];
        // Patch input/output/modelName from metadata if missing in top-level fields
        // If patched, also update the ClickHouse observation row
        for (const obs of observations) {
            if (!obs || !obs.metadata) continue;
            let attrs = obs.metadata.attributes;
            if (typeof attrs === 'string') {
                try { attrs = JSON.parse(attrs); } catch { attrs = {}; }
            }
            let needsUpdate = false;
            let newInput = obs.input;
            let newOutput = obs.output;
            obs.modelName = obs.provided_model_name;
            if (attrs) {
                if ((!obs.input || obs.input === '' || obs.input === '{}') && obs.obs_input) {
                    newInput = obs.obs_input;
                    needsUpdate = true;
                }
                if ((!obs.output || obs.output === '' || obs.output === '{}') && obs.obs_output) {
                    newOutput = obs.obs_output;
                    needsUpdate = true;
                }
                // Optionally patch model name if needed (not used in main logic, but for completeness)
                if (!obs.modelName) {
                    if (attrs['elasticdash.observation.model'] && typeof attrs['elasticdash.observation.model'] === 'object' && attrs['elasticdash.observation.model'].name) {
                        obs.modelName = attrs['elasticdash.observation.model'].name;
                    } else if (attrs['elasticdash.observation.model.name']) {
                        obs.modelName = attrs['elasticdash.observation.model.name'];
                    }
                }
            }
            // If we patched input/output, update ClickHouse
            if (needsUpdate) {
                console.log(`Patching observation ${obs.id} with new input/output from metadata`);
                try {
                    // Safely escape single quotes for ClickHouse string literals
                    const inputStr = JSON.stringify(newInput).replace(/'/g, "''");
                    const outputStr = JSON.stringify(newOutput).replace(/'/g, "''");
                    const obsIdStr = obs.id.replace(/'/g, "''");
                    const updateQuery = `ALTER TABLE observations UPDATE input = '${inputStr}', output = '${outputStr}' WHERE id = '${obsIdStr}'`;
                    await clickhouseClient.query({ query: updateQuery });
                    // Check if the observation was updated by selecting the new values
                    const checkQuery = `SELECT id, input, output FROM observations WHERE id = '${obsIdStr}' AND input != '' AND input != '{}' AND output != '' AND output != '{}'`;
                    const checkRes = await clickhouseClient.query({ query: checkQuery });
                    const checkData = await checkRes.json();
                    if (!checkData || !checkData.data || checkData.data.length === 0) {
                        console.warn(`Failed to patch observation ${obs.id}: No rows found after update`);
                        console.log(`Update query executed: ${updateQuery}`);
                        console.log(`Check query executed: ${checkQuery}`);
                        continue;
                    }
                    const updatedObs = checkData.data[0];
                    obs.input = updatedObs.input;
                    obs.output = updatedObs.output;
                    console.log(`Observation ${obs.id} patched successfully. Updated input/output.`);
                } catch (err) {
                    console.error('Failed to update observation in ClickHouse:', err);
                }
            }
        }

        const metadatas = observations.map(obs => ({
            ...obs.metadata
        }))
        const attributes = metadatas.map(md => {
            return md?.attributes ? (typeof md.attributes === 'string' ? JSON.parse(md.attributes) : md.attributes) : {};
        });
        let testCaseId = (attributes.find(md => md && md['elasticdash.trace.metadata.testCaseId'])) ? attributes.find(md => md && md['elasticdash.trace.metadata.testCaseId'])['elasticdash.trace.metadata.testCaseId'] : null;
        if (testCaseId && isNaN(Number(testCaseId))) {
            testCaseId = null;
        }

        let testCaseRunRecordId = (attributes.find(md => md && md['elasticdash.trace.metadata.testCaseRunRecordId'])) ? attributes.find(md => md && md['elasticdash.trace.metadata.testCaseRunRecordId'])['elasticdash.trace.metadata.testCaseRunRecordId'] : null;
        if (testCaseRunRecordId && isNaN(Number(testCaseRunRecordId))) {
            testCaseRunRecordId = null;
        }

        console.log('Fetched observations count:', observations.length);
        console.log('TestCaseId:', testCaseId, 'TestCaseRunRecordId:', testCaseRunRecordId);


        if (observations.length === 0) {
            throw { status: 400, message: 'No valid observations found for this trace' };
        }

        // Step 3: Fetch all existing features for the test project
        const existingFeatures = await listFeaturesByTestProjectIdStr(trace.project_id);

        // Step 4: Call LLM to analyze and match
        const prompt = buildFeatureMatchingPrompt(observations, existingFeatures);

        const llmResponse = await sendRequestToOpenAI({
            model: process.env.OPENAI_DEFAULT_MODEL,
            messages: [
                {
                    role: 'system',
                    content: 'You are an expert AI system analyzer. Your task is to identify features/capabilities from trace data. Always respond with valid JSON.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' }
        });

        let analysisResult;
        let message = llmResponse.choices[0].message.content;
        if (message.startsWith('```')) {
            // Extract JSON from code block
            const match = message.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
            if (match) {
                message = match[1];
            }
        }
        try {
            analysisResult = JSON.parse(message);
        } catch (parseErr) {
            console.error('Error parsing LLM response:', parseErr);
            console.error('LLM Response Content:', message);
            throw { status: 500, message: 'Failed to parse AI analysis result' };
        }

        let feature;
        let isNewFeature = false;
        let featureId;

        // Step 5 & 6: Match existing or create new feature
        if (analysisResult.match_found && analysisResult.feature_id) {
            // Match found
            featureId = analysisResult.feature_id;
            feature = existingFeatures.find(f => f.id === featureId);
            if (!feature) {
                throw { status: 500, message: 'AI returned invalid feature_id' };
            }
        } else if (analysisResult.new_feature) {
            // Create new feature
            feature = await createFeature(
                trace.project_id,
                analysisResult.new_feature.feature_name,
                analysisResult.new_feature.feature_description,
                true,
                0
            );
            featureId = feature.id;
            isNewFeature = true;
        } else {
            throw { status: 500, message: 'AI analysis returned invalid result' };
        }


        // Step 7: Update trace metadata in ClickHouse
        await updateTraceMetadata(traceId, featureId);

        // Step 8: Prompt drift detection (high risk marking)
        let promptChangedRisk = false;
        // if (!isNewFeature) {
        //     // Find the most recent previous trace with the same feature (excluding this trace)
        //     const prevTraceQuery = `
        //         SELECT id FROM traces
        //         WHERE id != '${traceId}'
        //           AND is_deleted = 0
        //           AND metadata['feature_id'] = '${featureId}'
        //         ORDER BY created_at DESC, timestamp DESC
        //         LIMIT 1
        //     `;
        //     const prevTraceResult = await clickhouseClient.query({ query: prevTraceQuery });
        //     const prevTraceData = await prevTraceResult.json();
        //     if (prevTraceData?.data && prevTraceData.data.length > 0) {
        //         const prevTraceId = prevTraceData.data[0].id;
        //         // Fetch observations for previous trace
        //         const prevObsQuery = `
        //             SELECT input, output, name, type
        //             FROM observations
        //             WHERE trace_id = '${prevTraceId}'
        //             AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
        //             AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
        //             AND o.name != 'handleChatRequest'
        //             LIMIT 100
        //         `;
        //         const prevObsResult = await clickhouseClient.query({ query: prevObsQuery });
        //         const prevObsData = await prevObsResult.json();
        //         const prevObservations = prevObsData?.data || [];
        //         // Compare prompts (inputs) using LLM
        //         // Build LLM prompt for drift detection
        //         const driftPrompt = buildPromptDriftDetectionPrompt(observations, prevObservations);
        //         const driftLlmResponse = await sendRequestToOpenAI({
        //             model: process.env.OPENAI_DEFAULT_MODEL,
        //             messages: [
        //                 {
        //                     role: 'system',
        //                     content: 'You are an expert at detecting prompt changes in AI system flows. Always respond with valid JSON.'
        //                 },
        //                 {
        //                     role: 'user',
        //                     content: driftPrompt
        //                 }
        //             ],
        //             temperature: 0.1,
        //             response_format: { type: 'json_object' }
        //         });
        //         let driftResult;
        //         let driftMessage = driftLlmResponse.choices[0].message.content;
        //         if (driftMessage.startsWith('```')) {
        //             const match = driftMessage.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        //             if (match) driftMessage = match[1];
        //         }
        //         try {
        //             driftResult = JSON.parse(driftMessage);
        //         } catch (parseErr) {
        //             console.error('Error parsing LLM drift response:', parseErr);
        //             console.error('LLM Drift Response Content:', driftMessage);
        //             driftResult = { prompt_changed: false };
        //         }
        //         if (driftResult && driftResult.prompt_changed) {
        //             promptChangedRisk = true;
        //             // Mark feature as high risk
        //             await pool.query(
        //                 `UPDATE TestProjectFeatures SET prompt_changed_risk = TRUE, updated_at = NOW() WHERE id = $1`,
        //                 [featureId]
        //             );
        //         }
        //     }
        // }

        // Fetch updated trace
        const updatedTraceResult = await clickhouseClient.query({ query: traceQuery });
        const updatedTraceData = await updatedTraceResult.json();
        const updatedTrace = updatedTraceData.data[0];

        if (testCaseId && testCaseRunRecordId) {
            createTestCaseRunFromTrace({testCaseId, traceId, testCaseRunRecordId, createdBy: 0, isRerun: true}).then((result) => {
                console.log(`✓ Created TestCaseRun from analyzed trace ${traceId}:`);
                console.log(`  - Created TestCaseRun: ${result.testCaseRunId}`);
                console.log(`  - Created ${result.aiCallsCreated} TestCaseRunAICall entries`);
                console.log(`  - Test case: ${testCaseId}`);
                console.log(`  - Run record: ${testCaseRunRecordId}`);
            }).catch((err) => {
                console.error(`✗ Error creating TestCaseRun from analyzed trace ${traceId}:`, err.message || err);
            });
        }

        return {
            trace: updatedTrace,
            feature: feature,
            isNewFeature: isNewFeature,
            promptChangedRisk: promptChangedRisk
        };

    } catch (err) {
        console.error('Error in analyzeTraceFeature:', err);
        throw err;
    }
}

// Helper function to build the LLM prompt
function buildFeatureMatchingPrompt(observations, existingFeatures) {
    const observationsSummary = observations.slice(0, 20).map((obs, idx) => {
        return `Observation ${idx + 1}:
  Type: ${obs.type || 'unknown'}
  Name: ${obs.name || 'unnamed'}
  Input: ${typeof obs.input === 'string' ? obs.input.substring(0, 500) : JSON.stringify(obs.input).substring(0, 500)}
  Output: ${typeof obs.output === 'string' ? obs.output.substring(0, 500) : JSON.stringify(obs.output).substring(0, 500)}`;
    }).join('\n\n');

    const featuresList = existingFeatures.length > 0
        ? existingFeatures.map(f => `ID: ${f.id}, Name: "${f.feature_name}", Description: "${f.feature_description}"`).join('\n')
        : 'No existing features';

    return `  
You are analyzing an AI system trace to identify the USER-FACING FEATURE or CAPABILITY it provides.

IMPORTANT DEFINITION:
A "feature" is defined as a BUSINESS-LEVEL CAPABILITY that delivers value or accomplishes a user goal.
A feature must describe WHAT the system achieves for the user, not HOW it is implemented internally.

TRACE OBSERVATIONS (${observations.length} total, showing first 20):
${observationsSummary}

EXISTING FEATURES (business-level only):
${featuresList}

TASK:

Step 1 — Infer User Intent
Based on the full trace, infer the most likely USER INTENT or BUSINESS GOAL.
Answer this internally:
"What was the user ultimately trying to accomplish or decide?"

Step 2 — Abstract Away Implementation
Ignore:
- Number of API calls
- Number of SQL queries
- Parallelism or sequencing
- Tool names, libraries, or protocols
- Data formats (JSON, SQL, REST, etc.)

These are NOT features by themselves.

Step 3 — Match Against Existing Features
Determine whether the inferred user intent and outcome matches ANY existing feature.
A match requires:
- Same user goal
- Same business outcome
- Not just similar technical behavior

Step 4 — Create a New Feature (if needed)
If no match exists, define a NEW feature that:
- A non-technical business stakeholder could understand
- Describes the capability in outcome-oriented language
- Would still be valid even if the implementation changed

Feature naming rules:
- 2–5 words
- Action- or outcome-oriented
- No technical terms (e.g. SQL, API, async, batch, vector)

Feature description rules:
- 1–2 sentences
- Describe the user value or decision enabled
- Avoid technical or system-internal language

EXAMPLES:
❌ Bad feature: "Multiple SQL Calls"
✅ Good feature: "Customer Data Aggregation"

❌ Bad feature: "Parallel Tool Execution"
✅ Good feature: "Multi-Source Risk Evaluation"

❌ Bad feature: "JSON Response Normalization"
✅ Good feature: "Standardized Report Generation"

FINAL CHECK (MANDATORY):
Before returning your answer, verify:
"Would a business user understand what this feature does without knowing how it works?"

If not, revise it.

Response format (valid JSON only):
{
  "match_found": boolean,
  "feature_id": number or null,
  "new_feature": {
    "feature_name": "string",
    "feature_description": "string"
  } or null
}`;
}

// Helper function to update trace metadata in ClickHouse
async function updateTraceMetadata(traceId, featureId) {
    console.log('updateTraceMetadata is triggered');
    console.log('Input:', { traceId, featureId });

    try {
        // ClickHouse ALTER TABLE UPDATE syntax
        // Use mapUpdate to preserve existing metadata keys and add/update feature_id
        const query = `
            ALTER TABLE traces
            UPDATE metadata = mapUpdate(metadata, map('feature_id', toString(${featureId})))
            WHERE id = '${traceId}'
        `;

        await clickhouseClient.query({ query });

        console.log('Trace metadata updated successfully');
        return { success: true };
    } catch (err) {
        console.error('Error updating trace metadata:', err);
        throw err;
    }
}
