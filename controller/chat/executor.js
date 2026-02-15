import axios from 'axios';
import { containsPlaceholderReference, resolvePlaceholders } from './placeholder.js';
import { findApiParameters, prepareApiSchema } from './schemaMapper.js';
import * as planStepDAO from './planStepDAO.js';
import { chatCompletion } from './openai.js';

/**
 * Extract values from an object using JSONPath-like syntax
 * Supports: $.field, $.array[0], $.array[*] (returns all items), $.nested.field
 */
function extractValuesByPath(obj, path) {
    if (!path || typeof path !== 'string') return [];
    
    // If obj is an array and path starts with $., extract from each array item
    if (Array.isArray(obj) && path.startsWith('$.')) {
        const field = path.substring(2); // Remove '$.'
        return obj.map(item => item?.[field]).filter(v => v !== undefined);
    }
    
    const parts = path.replace(/^\$\./, '').split('.');
    let current = obj;
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        // Handle array notation: field[*] or field[0]
        if (part.includes('[')) {
            const [fieldName, indexPart] = part.split('[');
            const index = indexPart.slice(0, -1);
            
            current = current?.[fieldName];
            if (Array.isArray(current)) {
                if (index === '*') {
                    // Return all items in array
                    return current;
                } else {
                    // Return specific index
                    current = current[parseInt(index)];
                }
            }
        } else {
            current = current?.[part];
        }
    }
    
    return Array.isArray(current) ? current : (current !== undefined ? [current] : []);
}

/**
 * Use LLM to expand a loop step into multiple iteration API calls
 * Single LLM call generates all iterations at once
 */
async function expandLoopWithLLM({ stepTemplate, sourceData }) {
    const prompt = `You are expanding a loop step into multiple API call iterations.

**Source Data from Previous Step:**
\`\`\`json
${JSON.stringify(sourceData, null, 2)}
\`\`\`

**Step Template (contains loop metadata):**
\`\`\`json
${JSON.stringify(stepTemplate, null, 2)}
\`\`\`

**Task:**
1. Analyze the source data structure and identify the array of items to iterate over
   - For SQL: usually \`result.rows\` array
   - For REST: usually \`data\` array or direct array
2. For EACH item in the array, construct a complete API call
3. Handle field mapping intelligently (e.g., \`id\` → \`teamId\`)
4. Replace path parameters: \`/teams/{teamId}\` → \`/teams/40\`
5. For POST/PUT, construct proper requestBody from item data

**Return ONLY valid JSON** in this exact format:
\`\`\`json
{
  "iterations": [
    {
      "step_number": <number>,
      "description": "<description for this iteration>",
      "api": {
        "method": "<METHOD>",
        "path": "<path with actual values>",
        "parameters": {<params with actual values>},
        "requestBody": {<body if needed>}
      }
    }
  ]
}
\`\`\`

**Important:**
- Do NOT include "loop" field in output
- Each iteration should be a complete, executable API call
- Use actual values from source data, not placeholders
- If source data is empty array, return empty iterations array`;

    try {
        const response = await chatCompletion({
            messages: [{ role: 'user', content: prompt }],
            model: process.env.OPENAI_DEFAULT_MODEL,
            temperature: 0,
            maxTokens: 4000,
            timeoutMs: 15000
        });

        const content = response.choices[0]?.message?.content;
        if (!content) {
            return { iterations: [], error: 'LLM returned empty response' };
        }

        // Extract JSON from code blocks if present
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        const jsonStr = jsonMatch ? jsonMatch[1] : content;
        
        const result = JSON.parse(jsonStr);
        
        if (!Array.isArray(result.iterations)) {
            return { iterations: [], error: 'LLM did not return valid iterations array' };
        }
        
        return { iterations: result.iterations };
        
    } catch (err) {
        console.error('[Chat.Executor] LLM loop expansion failed:', err);
        return { iterations: [], error: err.message || 'Failed to expand loop' };
    }
}

/**
 * Use LLM to construct API call for a loop iteration
 * Handles field mapping, POST bodies, and complex transformations
 */
// Basic sanitize to remove circulars / large fields
function sanitize(obj) {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]';
            seen.add(value);
            if (['request', 'socket', 'agent', 'res'].includes(key)) return '[Omitted]';
            if (key === 'config') return { method: value.method, url: value.url, data: value.data };
            if (key === 'headers' && value.constructor?.name === 'AxiosHeaders') return Object.fromEntries(Object.entries(value));
        }
        return value;
    }));
}

function buildAuthHeader(userToken) {
    const token = userToken || process.env.ELASTICDASH_TOKEN || process.env.NEXT_PUBLIC_ELASTICDASH_TOKEN || '';
    if (!token) return {};
    return { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` };
}

// Normalize base URL + path safely and ensure BACKEND_URL is applied
function buildApiUrl({ baseUrl, path }) {
    // If planner returned an absolute URL, respect it
    if (path?.startsWith('http://') || path?.startsWith('https://')) {
        return path;
    }
    const envBase = baseUrl || process.env.BACKEND_URL || process.env.ELASTICDASH_API_URL || '';
    if (!envBase) {
        throw new Error('BACKEND_URL is not configured');
    }
    const trimmedBase = envBase.endsWith('/') ? envBase.slice(0, -1) : envBase;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${trimmedBase}${normalizedPath}`;
}

export async function executeStep({ step, baseUrl, userToken, executedSteps, recordToDb = false, planId = null }) {
    if (!step?.api || !step.api.path || !step.api.method) {
        return { response: null, error: 'Invalid step api', stepId: null };
    }

    let stepId = null;

    // Create step record in database if requested
    if (recordToDb && planId) {
        try {
            const stepRecord = await planStepDAO.insertStep({
                planId,
                stepNumber: step.step_number || executedSteps.length + 1,
                description: step.description,
                apiPath: buildApiUrl({ baseUrl, path: step.api.path }),
                apiMethod: step.api.method,
            });
            stepId = stepRecord.id;
        } catch (dbError) {
            console.error('Error creating step record:', dbError);
            // Continue without recording to DB
        }
    }

    // Resolve placeholders before execution
    const stepClone = JSON.parse(JSON.stringify(step));
    if (containsPlaceholderReference(stepClone)) {
        const resolved = await resolvePlaceholders(stepClone, executedSteps);
        if (!resolved.resolved) {
            if (stepId) {
                try {
                    await planStepDAO.recordStepExecution({
                        stepId,
                        status: 'failed',
                        apiRequest: stepClone.api || null,
                        apiResponse: null,
                        errorMessage: resolved.reason || 'Failed to resolve placeholders',
                        durationMs: 0,
                    });
                } catch (dbError) {
                    console.error('Error recording step failure:', dbError);
                }
            }
            return { response: null, error: resolved.reason || 'Failed to resolve placeholders', stepId };
        }
    }

    // Merge input/parameters into schema and apply parameter mapping
    const parametersSchema = findApiParameters(stepClone.api.path, stepClone.api.method);
    const apiSchema = prepareApiSchema(stepClone, parametersSchema);

    // Replace path params
    let finalPath = apiSchema.path;
    console.log('Preparing API Call:');
    console.log(`  - Method: ${apiSchema.method}`);
    console.log(`  - finalPath: ${finalPath}`);
    const params = apiSchema.parameters || {};
    if (params && typeof params === 'object') {
        Object.entries(params).forEach(([k, v]) => {
            const placeholder = `{${k}}`;
            if (finalPath.includes(placeholder)) {
                finalPath = finalPath.replace(placeholder, String(v));
            }
        });
    }

    let finalUrl;
    try {
        finalUrl = buildApiUrl({ baseUrl, path: finalPath });
    } catch (error) {
        console.error('Error building API URL:', error?.message || error);
        return { response: null, error: error?.message || 'BACKEND_URL is not configured', stepId };
    }

    const config = {
        method: apiSchema.method.toLowerCase(),
        url: finalUrl,
        data: apiSchema.requestBody || undefined,
        headers: {
            'Content-Type': 'application/json',
            ...buildAuthHeader(userToken),
        },
    };

    const startTime = Date.now();
    try {
        const res = await axios(config);
        const duration = Date.now() - startTime;

        // Record successful execution to database
        if (stepId) {
            try {
                await planStepDAO.recordStepExecution({
                    stepId,
                    status: 'success',
                    apiRequest: {
                        method: config.method,
                        url: config.url,
                        data: config.data,
                    },
                    apiResponse: res.data,
                    errorMessage: null,
                    durationMs: duration,
                });
            } catch (dbError) {
                console.error('Error recording step execution:', dbError);
            }
        }

        return { response: res.data, error: null, stepId };
    } catch (err) {
        const duration = Date.now() - startTime;
        const statusCode = err?.response?.status || err?.statusCode;
        const payload = {
            success: false,
            error: true,
            statusCode: statusCode || 500,
            message: err?.message || 'API request failed',
            details: err?.response?.data || err?.data || null,
        };

        // Record failed execution to database
        if (stepId) {
            try {
                await planStepDAO.recordStepExecution({
                    stepId,
                    status: 'failed',
                    apiRequest: {
                        method: config.method,
                        url: config.url,
                        data: config.data,
                    },
                    apiResponse: payload,
                    errorMessage: err?.message || 'API request failed',
                    durationMs: duration,
                });
            } catch (dbError) {
                console.error('Error recording step failure:', dbError);
            }
        }

        return { response: payload, error: null, stepId };
    }
}

/**
 * Execute a loop step multiple times, once for each item
 * @param {Object} step - The loop step with loop metadata
 * @param {Array} executedSteps - Previously executed steps
 * @param {Object} config - Execution config: {baseUrl, userToken, recordToDb, planId}
 * @returns {Promise<Array>} Array of execution results, one for each loop iteration
 */
export async function executeLoopStep({ step, executedSteps, baseUrl, userToken, recordToDb = false, planId = null }) {
    if (!step?.loop) {
        return { error: 'Step is not a loop step', iterations: [] };
    }

    const { over, extractPath, as } = step.loop;
    
    // Resolve the source data (e.g., "resolved_from_step_1")
    let sourceData;
    if (over.startsWith('resolved_from_step_')) {
        const sourceStepNum = parseInt(over.split('_').pop());
        const sourceStep = executedSteps.find(s => 
            s.step === sourceStepNum || s.stepNumber === sourceStepNum || s.step?.step_number === sourceStepNum
        );
        
        if (!sourceStep) {
            return { error: `Could not find source step ${sourceStepNum}`, iterations: [] };
        }
        
        sourceData = sourceStep.response;
    } else {
        sourceData = over;
    }

    // DEBUG: Log source data
    console.log(`[Chat.Executor] Loop source data:`, JSON.stringify(sourceData).substring(0, 500));
    console.log(`[Chat.Executor] Loop step template:`, JSON.stringify(step).substring(0, 300));
    
    // Use LLM to expand loop into all iterations at once
    const expansion = await expandLoopWithLLM({
        stepTemplate: step,
        sourceData
    });
    
    if (expansion.error) {
        console.error(`[Chat.Executor] Failed to expand loop: ${expansion.error}`);
        return { error: expansion.error, iterations: [] };
    }
    
    const iterations = expansion.iterations;
    
    console.log(`[Chat.Executor] LLM expanded loop into ${iterations.length} iterations`);
    
    if (iterations.length === 0) {
        console.warn(`[Chat.Executor] Loop step ${step.step_number} expanded to 0 iterations`);
        return { error: null, iterations: [] };
    }

    console.log(`[Chat.Executor] Loop step ${step.step_number} will execute ${iterations.length} times`);

    const results = [];

    // Execute each iteration API call
    for (let i = 0; i < iterations.length; i++) {
        const iterationStep = iterations[i];
        
        console.log(`[Chat.Executor] Loop iteration ${i + 1}/${iterations.length}`);
        console.log(`[Chat.Executor] → API Call: ${iterationStep.api.method.toUpperCase()} ${iterationStep.api.path}`);
        if (iterationStep.api.parameters) {
            console.log(`[Chat.Executor] → Parameters:`, JSON.stringify(iterationStep.api.parameters));
        }
        if (iterationStep.api.requestBody) {
            console.log(`[Chat.Executor] → Body:`, JSON.stringify(iterationStep.api.requestBody).substring(0, 200));
        }
        
        // Execute this iteration
        const result = await executeStep({
            step: iterationStep,
            baseUrl,
            userToken,
            executedSteps,
            recordToDb,
            planId,
        });
        
        console.log(`[Chat.Executor] → Response:`, JSON.stringify(result.response).substring(0, 200));
        
        results.push({
            iteration: i + 1,
            result,
        });
        
        // If any iteration fails, record the error but continue
        if (result.error) {
            console.error(`[Chat.Executor] Loop iteration ${i + 1} failed: ${result.error}`);
        } else if (result.response?.error || result.response?.success === false) {
            console.warn(`[Chat.Executor] Loop iteration ${i + 1} API returned error:`, result.response);
        }
    }

    return { error: null, iterations: results };
}

export function sanitizeForSerialization(obj) {
    return sanitize(obj);
}
