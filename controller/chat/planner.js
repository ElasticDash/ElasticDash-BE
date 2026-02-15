import { chatCompletion } from './openai.js';
import { loadPrompt } from './prompts.js';
import { 
    loadPromptTemplate, 
    buildPlanValidationVars, 
    buildGoalValidationVars, 
    buildReplanVars 
} from './promptLoader.js';
import { executeStep, executeLoopStep } from './executor.js';

// Defaults
const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL;

function extractJsonBlock(text) {
    if (!text) return null;
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) return null;
    return match[0];
}

function parseJsonLoose(text) {
    const block = extractJsonBlock(text) || text;
    try {
        return JSON.parse(block);
    } catch (err) {
        // Fallback: simple replacements for common formatting quirks
        try {
            const cleaned = block
                .replace(/```json|```/gi, '')
                .replace(/：/g, ':')
                .replace(/，/g, ',')
                .replace(/[“”]/g, '"');
            return JSON.parse(cleaned);
        } catch (err2) {
            return null;
        }
    }
}

async function runLLM({ messages, temperature = 0.3, max_tokens = 1024, model = DEFAULT_MODEL }) {
    const res = await chatCompletion({ messages, temperature, maxTokens: max_tokens, model });
    const choice = res?.choices?.[0]?.message?.content;
    return choice || '';
}

export async function validateGoalCompletion({ refinedQuery, ragResults }) {
    // Build resources string for the validator to know what APIs/tables are available
    let resources = '[]';
    if (ragResults && ragResults.length > 0) {
        const enrichedResults = ragResults.map((r) => {
            if (r.content && r.content.length > 0) {
                return {
                    name: r.name || r.id,
                    type: 'table_schema',
                    schema: r.content,
                };
            }
            return {
                name: r.name || r.id,
                endpoint: r.endpoint || r.path || '',
                method: r.method || '',
                type: 'api',
            };
        });
        resources = JSON.stringify(enrichedResults, null, 2);
    }

    const prompt = loadPromptTemplate('prompt-goal-completion-validator.md', {
        refinedQuery,
        resources,
    });
    const content = await runLLM({ messages: [{ role: 'user', content: prompt }], temperature: 0.0, max_tokens: 64 });
    const verdict = content.trim();
    return verdict === 'GOAL_COMPLETED';
}

export async function analyzeIntent({ refinedQuery, usefulData, conversationContext }) {
    const prompt = loadPromptTemplate('prompt-intent-analyzer.md', {
        refinedQuery,
        usefulData: usefulData || 'none',
        conversationContext: conversationContext || 'none',
    });
    const content = await runLLM({ messages: [{ role: 'user', content: prompt }], temperature: 0.3, max_tokens: 256 });
    const obj = parseJsonLoose(content);
    if (!obj || !obj.type) throw new Error('Invalid intent analysis response');
    return { description: obj.description || refinedQuery, type: obj.type };
}

export async function generatePlan({ refinedQuery, intentType, ragResults, usefulData, conversationContext, forceFullPlan = false }) {
    const plannerSystemPrompt = loadPrompt(intentType === 'FETCH' ? 'prompt-planner-table.txt' : 'prompt-planner.txt');
    
    // Build resources string: For table schemas, include full content; for APIs, just metadata
    let resources = '[]';
    if (ragResults && ragResults.length > 0) {
        const enrichedResults = ragResults.map((r) => {
            // If this is a table schema (has content field), include it
            if (r.content && r.content.length > 0) {
                return {
                    name: r.name || r.id,
                    type: 'table_schema',
                    schema: r.content  // Full schema with examples
                };
            }
            // Otherwise just include basic API metadata
            return {
                name: r.name || r.id,
                endpoint: r.endpoint || r.path || '',
                method: r.method || '',
                type: 'api'
            };
        });
        resources = JSON.stringify(enrichedResults, null, 2);
    }

    let userPrompt;
    if (intentType === 'MODIFY') {
        userPrompt = loadPromptTemplate('prompt-plan-generation-modify.md', {
            conversationContextHeader: conversationContext ? `CONTEXT:\n${conversationContext}\n\n` : '',
            refinedQuery,
            resources,
            usefulData: usefulData || 'none',
            forceFullPlanNote: forceFullPlan ? '\nPRIOR RESPONSE WAS RESOLUTION-ONLY. RETURN FULL PLAN INCLUDING MUTATIONS.' : '',
        });
    } else {
        userPrompt = loadPromptTemplate('prompt-plan-generation-fetch.md', {
            conversationContextHeader: conversationContext ? `CONTEXT:\n${conversationContext}\n\n` : '',
            refinedQuery,
            resources,
            usefulData: usefulData || 'none',
        });
    }

    const content = await runLLM({
        messages: [
            { role: 'system', content: plannerSystemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0.5,
        max_tokens: 2048,
    });

    const planObj = parseJsonLoose(content);
    if (!planObj) throw new Error('Failed to parse planner response');
    return { plan: planObj, raw: content };
}

export async function validateSchema({ plan, ragResults }) {
    const resources = JSON.stringify(ragResults || [], null, 2);
    const prompt = loadPromptTemplate('prompt-schema-validator.md', {
        resources,
        plan: JSON.stringify(plan, null, 2),
    });
    const content = await runLLM({ messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 512 });
    const obj = parseJsonLoose(content) || {};
    return obj;
}

/**
 * Validate if the generated plan meets the user's goal
 * @param {Object} plan - The execution plan
 * @param {string} refinedQuery - The user's goal/request
 * @returns {Promise<{valid: boolean, reason?: string}>} Validation result
 */
export async function validatePlanMeetsGoal({ plan, refinedQuery }) {
    const vars = buildPlanValidationVars(plan, refinedQuery);
    const prompt = loadPromptTemplate('prompt-plan-validator.md', vars);

    const content = await runLLM({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,  // Very low temperature for strict validation
        max_tokens: 256,
    });

    const response = content.trim().toLowerCase();
    
    // Check for "true" at end of response (handles "...true." or "...true")
    if (response === 'true' || response.endsWith('true') || response.endsWith('true.')) {
        return { valid: true, reason: null };
    }
    
    // Check if response contains "true" preceded by period or line break
    if (/[.\n]\s*true\.?\s*$/.test(response)) {
        return { valid: true, reason: null };
    }
    
    // Otherwise, extract natural language feedback
    let feedback = content.trim();
    
    // Remove numbered lists like "1. X\n2. Y\n3. Z"
    if (/^\d+\.\s/.test(feedback)) {
        // If it starts with numbered list, extract the first meaningful line
        const lines = feedback.split('\n').filter(l => l.trim());
        // Try to find lines that aren't just "1. X" format
        const meaningfulLines = lines.filter(l => !(/^\d+\.\s+\w+$/.test(l.trim())));
        if (meaningfulLines.length > 0) {
            feedback = meaningfulLines[0];
        } else {
            // Fallback: provide a generic message
            feedback = 'Plan structure does not match goal requirements. Please review the plan and try again.';
        }
    }
    
    // If response ends with "True." or "true.", extract the reasoning before it
    const beforeTrue = feedback.match(/^(.*?)[.\s]+(True|true)[.\s]*$/);
    if (beforeTrue && beforeTrue[1]) {
        feedback = beforeTrue[1].trim();
    }
    
    return { valid: false, reason: feedback };
}

/**
 * Refine a plan based on validation feedback
 * @param {Object} plan - Current execution plan
 * @param {string} refinedQuery - User's goal
 * @param {Array} ragResults - Available resources
 * @param {string} feedbackReason - Reason why plan didn't meet goal
 * @param {number} iteration - Current iteration number
 * @returns {Promise<Object>} Refined plan
 */
export async function refinePlan({ plan, refinedQuery, ragResults, feedbackReason, iteration }) {
    const plannerSystemPrompt = loadPrompt('prompt-planner.txt');
    
    let resources = '[]';
    if (ragResults && ragResults.length > 0) {
        const enrichedResults = ragResults.map((r) => {
            if (r.content && r.content.length > 0) {
                return {
                    name: r.name || r.id,
                    type: 'table_schema',
                    schema: r.content,
                };
            }
            return {
                name: r.name || r.id,
                endpoint: r.endpoint || r.path || '',
                method: r.method || '',
                type: 'api',
            };
        });
        resources = JSON.stringify(enrichedResults, null, 2);
    }

    const userPrompt = loadPromptTemplate('prompt-plan-refinement.md', {
        iteration,
        refinedQuery,
        feedbackReason,
        planJson: JSON.stringify(plan, null, 2),
        resources,
    });

    const content = await runLLM({
        messages: [
            { role: 'system', content: plannerSystemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
    });

    const planObj = parseJsonLoose(content);
    if (!planObj) {
        console.error(`[Planner] Failed to parse plan response at iteration ${iteration}`);
        console.error(`[Planner] Raw response (first 500 chars): ${content.substring(0, 500)}`);
        throw new Error(`Failed to parse refined planner response at iteration ${iteration}`);
    }
    return { plan: planObj, raw: content };
}

/**
 * Extract entities mentioned in validation feedback
 * Used to determine what additional RAG searches might be needed during re-planning
 * @param {string} validationFeedback - Feedback from goal validation
 * @returns {Object} Extracted entities {missingItems, missingApis, missingTables}
 */
export function extractEntitiesFromFeedback(validationFeedback) {
    if (!validationFeedback) return { missingItems: [], missingApis: [], missingTables: [] };
    
    const feedback = validationFeedback.toLowerCase();
    const entities = {
        missingItems: [],
        missingApis: [],
        missingTables: [],
    };

    // Extract phrases like "missing X", "didn't create X", "X not found"
    const missingMatches = feedback.match(/missing\s+([^,.;]+)/gi) || [];
    missingMatches.forEach(match => {
        const item = match.replace(/^missing\s+/i, '').trim();
        if (item && !entities.missingItems.includes(item)) {
            entities.missingItems.push(item);
        }
    });

    // Extract API references
    if (feedback.includes('api') || feedback.includes('endpoint')) {
        const apiMatches = feedback.match(/(?:api|endpoint)\s+(?:for|to|create|add|update|delete)\s+([^,.;]+)/gi) || [];
        apiMatches.forEach(match => {
            const item = match.replace(/^(?:api|endpoint)\s+(?:for|to|create|add|update|delete)\s+/i, '').trim();
            if (item && !entities.missingApis.includes(item)) {
                entities.missingApis.push(item);
            }
        });
    }

    return entities;
}

/**
 * Validate if user's goal has been achieved post-execution
 * Checks both that all steps completed AND that the goal semantically matches the results
 * @param {string} refinedQuery - User's goal
 * @param {Array} executedSteps - Array of {step, response, api, description, error}
 * @param {string} executionContext - Serialized useful data from execution
 * @returns {Promise<Object>} {achieved: boolean, reason: string, missingItems: [], completedItems: []}
 */
export async function validateGoalAchieved(refinedQuery, executedSteps, executionContext) {
    if (!executedSteps || executedSteps.length === 0) {
        return { 
            achieved: false, 
            reason: 'No steps were executed',
            missingItems: [],
            completedItems: [],
        };
    }

    // Check for any step failures
    const failedSteps = executedSteps.filter(s => s.error);
    if (failedSteps.length > 0) {
        return {
            achieved: false,
            reason: `${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.description).join(', ')}`,
            missingItems: [],
            completedItems: executedSteps.filter(s => !s.error).map(s => s.description),
        };
    }
    
    // OPTIMIZATION: Detect empty results for list/fetch queries and treat as valid
    const isListQuery = /what.*in|show.*my|list|fetch|get|view|display|check/i.test(refinedQuery);
    if (isListQuery && executedSteps.length > 0) {
        const lastStep = executedSteps[executedSteps.length - 1];
        const response = lastStep.response;
        
        // Check for empty arrays or empty result sets
        const isEmpty = 
            (response?.result && Array.isArray(response.result) && response.result.length === 0) ||
            (response?.result?.rows && Array.isArray(response.result.rows) && response.result.rows.length === 0) ||
            (Array.isArray(response) && response.length === 0);
        
        if (isEmpty) {
            console.log('[Planner] Empty result detected for list query - treating as valid answer');
            return {
                achieved: true,
                reason: 'Successfully retrieved data. The result is empty (no items found).',
                completedItems: executedSteps.map(s => s.description),
                missingItems: [],
            };
        }
    }

    // Use LLM to semantically validate if goal was achieved
    const vars = buildGoalValidationVars(refinedQuery, executedSteps, executionContext);
    const validationPrompt = loadPromptTemplate('prompt-goal-achievement-validator.md', vars);

    const content = await runLLM({
        messages: [{ role: 'user', content: validationPrompt }],
        temperature: 0.1,  // Very strict validation
        max_tokens: 512,
    });

    try {
        const result = parseJsonLoose(content);
        if (result && typeof result === 'object') {
            return {
                achieved: result.achieved === true,
                reason: result.reason || '',
                completedItems: result.completedItems || [],
                missingItems: result.missingItems || [],
            };
        }
    } catch (e) {
        console.error('[Planner] Failed to parse goal validation response:', e.message);
    }

    // Fallback: if parsing fails, assume goal not achieved
    return {
        achieved: false,
        reason: 'Could not validate goal (parsing error)',
        missingItems: [],
        completedItems: executedSteps.map(s => s.description),
    };
}

export async function generateFinalAnswer({ refinedQuery, executedSteps, collectedData }) {
    // Detect empty results for list/fetch queries
    const isListQuery = /what.*in|show.*my|list|fetch|get|view|display|check/i.test(refinedQuery);
    
    if (isListQuery && executedSteps.length > 0) {
        const lastStep = executedSteps[executedSteps.length - 1];
        const response = lastStep.response;
        
        // Check for empty arrays or empty result sets
        const isEmpty = 
            (response?.result && Array.isArray(response.result) && response.result.length === 0) ||
            (response?.result?.rows && Array.isArray(response.result.rows) && response.result.rows.length === 0) ||
            (Array.isArray(response) && response.length === 0);
        
        if (isEmpty) {
            // Generate friendly empty-state message
            const queryLower = refinedQuery.toLowerCase();
            let entityType = 'items';
            
            if (/watchlist/i.test(queryLower)) entityType = 'Pokémon in your watchlist';
            else if (/team/i.test(queryLower)) entityType = 'teams';
            else if (/pokemon|pokémon/i.test(queryLower)) entityType = 'Pokémon';
            else if (/move/i.test(queryLower)) entityType = 'moves';
            else if (/ability|abilities/i.test(queryLower)) entityType = 'abilities';
            
            return `Your ${entityType} list is currently empty. ${
                /watchlist/i.test(queryLower) ? 'You can add Pokémon to your watchlist by searching for them and clicking "Add to Watchlist".' :
                /team/i.test(queryLower) ? 'You can create a new team to get started.' :
                'Try adding some items first.'
            }`;
        }
    }
    
    const stepsSummary = executedSteps.map((step, idx) => {
        const stepNum = idx + 1;
        const method = (step.api?.method || 'POST').toUpperCase();
        const path = step.api?.path || '';
        return `Step ${stepNum}: ${method} ${path}`;
    }).join('\n');

    const dataContext = Object.entries(collectedData || {})
        .map(([key, value]) => `${key}:\n${value}`)
        .join('\n\n');

    const prompt = loadPromptTemplate('prompt-final-answer.md', {
        refinedQuery,
        stepsSummary,
        dataContext: dataContext || 'No data retrieved',
    });

    const content = await runLLM({
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1024,
    });

    return content || 'Unable to generate final answer';
}

export async function runPlanningPipeline({ refinedQuery, intentType, ragResults, usefulData, conversationContext, forceFullPlan = false }) {
    // Step 0: goal validation - check if goal requires action or is already complete
    // IMPORTANT: DO NOT pass usefulData from previous conversations - only use RAG resources
    const completed = await validateGoalCompletion({ refinedQuery, ragResults });
    if (completed) {
        return {
            actionablePlan: { needs_clarification: false, execution_plan: [], message: 'Goal completed with existing data' },
            planResponse: JSON.stringify({ message: 'Goal completed with existing data' })
        };
    }

    // Step 1: intent analysis (unless caller provided intentType)
    let intent = intentType;
    let intentDesc = refinedQuery;
    if (!intent) {
        // Clear usefulData for fresh intent analysis
        const { description, type } = await analyzeIntent({ refinedQuery, usefulData: 'none', conversationContext });
        intent = type;
        intentDesc = description || refinedQuery;
    }

    // Step 2: plan generation with validation loop
    // IMPORTANT: Pass usefulData='none' to avoid using stale data from previous conversations
    let plan = null;
    let planRaw = null;
    let validationResult = null;
    let maxIterations = 10;
    let iteration = 0;

    console.log(`[Planner] Starting plan generation with validation loop for goal: ${refinedQuery}`);
    console.log(`[Planner] Detected intent type: ${intent}`);
    console.log(`[Planner] Intent description: ${intentDesc}`);

    while (iteration < maxIterations) {
        iteration++;
        console.log(`[Planner] Iteration ${iteration}/${maxIterations}`);

        // Generate or refine plan
        if (iteration === 1) {
            // IMPORTANT: Use usefulData='none' to ensure LLM checks fresh DB state, not stale conversation data
            const { plan: generatedPlan, raw } = await generatePlan({
                refinedQuery,
                intentType: intent,
                ragResults,
                usefulData: 'none',
                conversationContext,
                forceFullPlan
            });
            plan = generatedPlan;
            planRaw = raw;
        } else {
            console.log(`[Planner] Refining plan based on feedback: ${validationResult.reason}`);
            const { plan: refinedPlan, raw } = await refinePlan({
                plan,
                refinedQuery,
                ragResults,
                feedbackReason: validationResult.reason,
                iteration
            });
            plan = refinedPlan;
            planRaw = raw;
        }

        // Validate if plan meets goal
        console.log(`[Planner] Validating if plan meets goal...`);
        validationResult = await validatePlanMeetsGoal({ plan, refinedQuery });

        if (validationResult.valid) {
            console.log(`[Planner] ✓ Plan meets goal at iteration ${iteration}`);
            break;
        } else {
            console.log(`[Planner] ✗ Plan does not meet goal: ${validationResult.reason}`);
            if (iteration >= maxIterations) {
                console.log(`[Planner] Reached max iterations (${maxIterations}), returning best effort plan`);
            }
        }
    }

    // Step 3: schema validation (table-focused)
    const validation = await validateSchema({ plan, ragResults });

    return { actionablePlan: plan, planResponse: planRaw, validation, validationLoop: { iterations: iteration, maxIterations, goalMet: validationResult?.valid } };
}

/**
 * Create a new plan when post-execution goal validation fails
 * This replans based on what was achieved and what's still missing
 * @param {Object} options - Configuration
 * @param {string} options.refinedQuery - Original user goal
 * @param {Array} options.executedSteps - Steps that were executed
 * @param {string} options.executionContext - Serialized useful data from execution
 * @param {Object} options.goalValidation - Goal validation result {achieved, reason, completedItems, missingItems}
 * @param {Array} options.ragResults - RAG search results
 * @param {number} options.iteration - Current iteration in overall loop (for tracking)
 * @returns {Promise<Object>} {plan, reason}
 */
export async function createPostExecutionReplan({
    refinedQuery,
    executedSteps,
    executionContext,
    goalValidation,
    ragResults,
    iteration = 1,
}) {
    const plannerSystemPrompt = loadPrompt('prompt-planner.txt');
    
    const vars = buildReplanVars({
        refinedQuery,
        executedSteps,
        executionContext,
        goalValidation,
        ragResults,
        iteration,
    });

    const userPrompt = loadPromptTemplate('prompt-post-execution-replan.md', vars);

    const content = await runLLM({
        messages: [
            { role: 'system', content: plannerSystemPrompt },
            { role: 'user', content: userPrompt },
        ],
        temperature: 0.5,
        max_tokens: 2048,
    });

    const planObj = parseJsonLoose(content);
    if (!planObj || !planObj.execution_plan) {
        throw new Error('Failed to parse post-execution replan response');
    }

    return {
        plan: planObj,
        reason: `Goal not achieved. Missing: ${goalValidation.missingItems.join(', ')}`,
        raw: content,
    };
}

/**
 * Main iterative orchestration loop: planning → execution → validation → replanning
 * Implements the full iterative flow from Next.js reference (route.ts)
 * 
 * Flow:
 * 1. Run planning pipeline (with pre-validation and plan validation loops)
 * 2. Execute each step in the plan (with loop expansion and placeholder resolution)
 * 3. Validate if goal was achieved post-execution
 * 4. If not achieved, replan based on what was executed and missing items
 * 5. Repeat until goal achieved or max iterations reached
 * 
 * @param {Object} config - Configuration object
 * @param {string} config.refinedQuery - User's goal/request
 * @param {Array} config.ragResults - RAG search results (tables + APIs)
 * @param {string} config.usefulData - Previously collected useful data
 * @param {string} config.conversationContext - Conversation history context
 * @param {string} config.baseUrl - API base URL for execution
 * @param {string} config.userToken - Auth token for API calls
 * @param {Function} config.onStepExecuted - Callback for each executed step (for socket events)
 * @param {number} config.maxIterations - Max planning iterations (default: 20)
 * @returns {Promise<Object>} {achieved: boolean, steps: [], finalAnswer: string, iterations: number}
 */
export async function executeIterativePlanner({
    refinedQuery,
    ragResults,
    usefulData = '',
    conversationContext = '',
    baseUrl = process.env.API_BASE_URL || 'http://localhost:3000',
    userToken = '',
    onStepExecuted = null,
    maxIterations = 20,
}) {
    let planIteration = 0;
    let executedSteps = [];
    let currentPlan = null;
    let currentPlanResponse = null;
    let stoppedReason = '';
    let accumulatedResults = [];

    console.log(`[ExecutiveIterativePlanner] Starting iterative execution for goal: ${refinedQuery}`);
    console.log(`[ExecutiveIterativePlanner] Max iterations: ${maxIterations}`);

    while (planIteration < maxIterations) {
        planIteration++;
        console.log(`\n[ExecutiveIterativePlanner] ====== ITERATION ${planIteration}/${maxIterations} ======`);

        try {
            // ==================== STEP 1: PLANNING ====================
            console.log(`[ExecutiveIterativePlanner] Step 1: Running planning pipeline...`);
            
            const planResult = await runPlanningPipeline({
                refinedQuery,
                intentType: undefined,
                ragResults,
                usefulData: planIteration === 1 ? usefulData : 'none',
                conversationContext,
                forceFullPlan: planIteration > 1,
            });

            currentPlan = planResult.actionablePlan;
            currentPlanResponse = planResult.planResponse;

            if (!currentPlan || !currentPlan.execution_plan || currentPlan.execution_plan.length === 0) {
                console.log(`[ExecutiveIterativePlanner] Planning returned no execution steps`);
                stoppedReason = 'No execution steps generated';
                break;
            }

            console.log(`[ExecutiveIterativePlanner] Plan has ${currentPlan.execution_plan.length} steps`);

            // ==================== STEP 2: EXECUTION ====================
            console.log(`[ExecutiveIterativePlanner] Step 2: Executing ${currentPlan.execution_plan.length} steps...`);
            
            const stepResults = [];

            for (let stepIdx = 0; stepIdx < currentPlan.execution_plan.length; stepIdx++) {
                const step = currentPlan.execution_plan[stepIdx];
                const stepNum = step.step_number || (stepIdx + 1);

                console.log(`[ExecutiveIterativePlanner] Executing step ${stepNum}/${currentPlan.execution_plan.length}`);
                console.log(`[ExecutiveIterativePlanner]   Description: ${step.description}`);
                console.log(`[ExecutiveIterativePlanner]   Type: ${step.loop ? 'LOOP' : 'REGULAR'}`);

                let stepResult = null;

                try {
                    if (step.loop) {
                        // Handle loop expansion
                        console.log(`[ExecutiveIterativePlanner]   Expanding loop...`);
                        stepResult = await executeLoopStep({
                            step,
                            executedSteps,
                            baseUrl,
                            userToken,
                        });
                        
                        console.log(`[ExecutiveIterativePlanner]   Loop expanded to ${stepResult.iterations?.length || 0} iterations`);
                        
                        // Store each iteration result in executedSteps for placeholder resolution
                        stepResult.iterations?.forEach((iteration, idx) => {
                            const iterationResult = {
                                step: stepNum,
                                iteration: idx + 1,
                                description: `${step.description} (iteration ${idx + 1})`,
                                api: iteration.result.api || step.api,
                                response: iteration.result.response,
                                error: iteration.result.error,
                            };
                            
                            executedSteps.push(iterationResult);
                            if (onStepExecuted) {
                                onStepExecuted(iterationResult);
                            }
                        });
                    } else {
                        // Handle regular step execution
                        stepResult = await executeStep({
                            step,
                            baseUrl,
                            userToken,
                            executedSteps,
                        });

                        const executedStep = {
                            step: stepNum,
                            description: step.description,
                            api: step.api,
                            response: stepResult.response,
                            error: stepResult.error,
                        };

                        executedSteps.push(executedStep);
                        
                        if (onStepExecuted) {
                            onStepExecuted(executedStep);
                        }

                        console.log(`[ExecutiveIterativePlanner]   Response: ${JSON.stringify(stepResult.response).substring(0, 200)}`);
                    }

                    stepResults.push(stepResult);
                    accumulatedResults.push(stepResult);

                } catch (stepError) {
                    console.error(`[ExecutiveIterativePlanner] Step ${stepNum} execution failed:`, stepError);
                    
                    const failedStep = {
                        step: stepNum,
                        description: step.description,
                        api: step.api,
                        response: null,
                        error: stepError.message,
                    };

                    executedSteps.push(failedStep);
                    if (onStepExecuted) {
                        onStepExecuted(failedStep);
                    }

                    stoppedReason = `Step ${stepNum} execution failed: ${stepError.message}`;
                    break;
                }
            }

            // ==================== STEP 3: POST-EXECUTION VALIDATION ====================
            console.log(`[ExecutiveIterativePlanner] Step 3: Validating if goal achieved...`);

            // Build execution context from collected data
            let executionContext = '';
            try {
                executionContext = JSON.stringify(
                    accumulatedResults.map(r => ({
                        description: r.description || '',
                        response: r.response ? JSON.stringify(r.response).substring(0, 500) : null,
                        error: r.error || null,
                    })),
                    null,
                    2
                );
            } catch (e) {
                executionContext = 'Unable to serialize execution context';
            }

            const goalValidation = await validateGoalAchieved(
                refinedQuery,
                executedSteps,
                executionContext
            );

            console.log(`[ExecutiveIterativePlanner] Goal validation: achieved=${goalValidation.achieved}`);
            console.log(`[ExecutiveIterativePlanner]   Reason: ${goalValidation.reason}`);
            console.log(`[ExecutiveIterativePlanner]   Completed items: ${goalValidation.completedItems?.join(', ') || 'none'}`);
            console.log(`[ExecutiveIterativePlanner]   Missing items: ${goalValidation.missingItems?.join(', ') || 'none'}`);

            if (goalValidation.achieved) {
                console.log(`[ExecutiveIterativePlanner] ✓ GOAL ACHIEVED!`);
                
                // Generate final answer
                const finalAnswer = await generateFinalAnswer({
                    refinedQuery,
                    executedSteps,
                    collectedData: {},
                });

                return {
                    achieved: true,
                    steps: executedSteps,
                    finalAnswer,
                    iterations: planIteration,
                    stoppedReason: 'Goal achieved',
                };
            }

            // ==================== STEP 4: POST-EXECUTION REPLANNING ====================
            if (planIteration >= maxIterations) {
                console.log(`[ExecutiveIterativePlanner] Reached max iterations (${maxIterations})`);
                stoppedReason = `Max iterations (${maxIterations}) reached, goal not achieved`;
                break;
            }

            console.log(`[ExecutiveIterativePlanner] Step 4: Goal not achieved, replanning...`);
            console.log(`[ExecutiveIterativePlanner]   Missing: ${goalValidation.missingItems?.join(', ') || 'unknown'}`);

            try {
                const replanResult = await createPostExecutionReplan({
                    refinedQuery,
                    executedSteps,
                    executionContext,
                    goalValidation,
                    ragResults,
                    iteration: planIteration,
                });

                currentPlan = replanResult.plan;
                console.log(`[ExecutiveIterativePlanner] New plan created with ${currentPlan.execution_plan?.length || 0} steps`);

                // Continue to next iteration
            } catch (replanError) {
                console.error(`[ExecutiveIterativePlanner] Replanning failed:`, replanError);
                stoppedReason = `Replanning failed: ${replanError.message}`;
                break;
            }

        } catch (iterationError) {
            console.error(`[ExecutiveIterativePlanner] Iteration ${planIteration} failed:`, iterationError);
            stoppedReason = `Iteration ${planIteration} error: ${iterationError.message}`;
            break;
        }
    }

    // ==================== FINAL OUTCOME ====================
    console.log(`\n[ExecutiveIterativePlanner] ====== EXECUTION COMPLETE ======`);
    console.log(`[ExecutiveIterativePlanner] Total iterations: ${planIteration}`);
    console.log(`[ExecutiveIterativePlanner] Stopped reason: ${stoppedReason}`);
    console.log(`[ExecutiveIterativePlanner] Steps executed: ${executedSteps.length}`);

    // Generate final answer with what we have
    let finalAnswer = '';
    try {
        finalAnswer = await generateFinalAnswer({
            refinedQuery,
            executedSteps,
            collectedData: {},
        });
    } catch (err) {
        console.error('[ExecutiveIterativePlanner] Final answer generation failed:', err);
        finalAnswer = stoppedReason || 'Goal could not be achieved';
    }

    return {
        achieved: false,
        steps: executedSteps,
        finalAnswer,
        iterations: planIteration,
        stoppedReason,
    };
}

