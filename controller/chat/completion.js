import { runPlanningPipeline, generateFinalAnswer, validateGoalAchieved, extractEntitiesFromFeedback, createPostExecutionReplan, executeIterativePlanner } from './planner.js';
import { semanticSearch } from './vectorStore.js';
import { sessionStore } from './sessionStore.js';
import { initUsefulDataContext, serializeUsefulDataInOrder, recordUsefulData } from './usefulData.js';
import { executeStep, executeLoopStep, sanitizeForSerialization } from './executor.js';
import * as conversationDAO from './conversationDAO.js';
import * as messageDAO from './messageDAO.js';
import * as planDAO from './planDAO.js';
import * as planStepDAO from './planStepDAO.js';
import * as sessionDAO from './sessionDAO.js';
import { sanitizeDbError } from '../../postgres.js';
import { fetchOrCreateLatestProject } from '../project/staging.js';
import JSON5 from 'json5';

const SOCKET_EVENT_PLAN_RESULT = 'chat:plan:result';

// Simple session id generator (hash-lite)
function generateSessionId(messages = []) {
    const keyMessages = messages.slice(0, Math.min(3, messages.length));
    const content = keyMessages.map((m) => `${m.role}:${m.content || ''}`).join('|');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const c = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash |= 0;
    }
    return `session_${Math.abs(hash)}`;
}

function filterPlanMessages(messages = []) {
    return messages.filter((m) => {
        const content = (m.content || '').toLowerCase();
        if (m.role === 'assistant' && (
            content.includes('execution_plan') ||
            content.includes('needs_clarification') ||
            content.includes('phase') ||
            content.includes('would you like me to') ||
            content.includes('approval')
        )) return false;
        if (m.role === 'user' && /^(approve|yes|no|reject|cancel|proceed|ok|confirm|go ahead)$/i.test(content.trim())) return false;
        return true;
    });
}

function getAuthToken(req) {
    const header = req.headers?.authorization || req.headers?.Authorization;
    if (!header) return '';
    return header.startsWith('Bearer ') ? header.slice(7) : header;
}

export function emitSessionEvent(sessionId, payload) {
    try {
        if (!sessionId || !global?.io) return;
        global.io.to(sessionId).emit(SOCKET_EVENT_PLAN_RESULT, payload);
    } catch (err) {
        console.error('[Chat] Failed to emit socket event', err);
    }
}

function buildPlanSummary(plan, refinedQuery) {
    const steps = (plan.execution_plan || []).map((s, idx) => `Step ${idx + 1}: ${s.description || ''} (${(s.api?.method || '').toUpperCase()} ${s.api?.path || ''})`).join('\n');
    return `Plan for: ${refinedQuery}\n${steps}`;
}

// ==================== ENHANCED HELPER FUNCTIONS FROM route.js ====================

/**
 * Sanitize planner response by extracting and validating JSON using jaison library
 * Handles various JSON formatting issues and invalid characters
 */
function sanitizePlannerResponse(response) {
    try {
        console.log('[Chat] Sanitizing planner response...');
        const firstMatch = response.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!firstMatch) {
            throw new Error('No JSON object or array found in response');
        }
        
        let cleaned = firstMatch[0];
        const jsonFixed = JSON5.parse(cleaned);
        
        if (jsonFixed) {
            return JSON.stringify(jsonFixed);
        }
        throw new Error('Jaison parsing failed');
    } catch (error) {
        console.error('[Chat] Error sanitizing planner response:', error);
        throw error;
    }
}

/**
 * Detect if query intent is resolution (checking state) vs execution (modifying state)
 */
async function detectResolutionVsExecution(refinedQuery, executionPlan, apiKey) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_DEFAULT_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are a query intent classifier.
RESOLUTION queries: check/verify state, ask "has X been done?", retrieve info to verify
EXECUTION queries: perform actions, add/delete/update data
Respond with ONLY ONE WORD: "resolution" or "execution"`,
                    },
                    {
                        role: 'user',
                        content: `Query: ${refinedQuery}\nExecution Plan: ${JSON.stringify(executionPlan, null, 2)}\nIntent:`,
                    },
                ],
                temperature: 0.1,
                max_tokens: 10,
            }),
        });

        if (!response.ok) {
            console.warn('[Chat] Resolution detection failed, defaulting to execution');
            return 'execution';
        }

        const data = await response.json();
        const intent = data.choices[0]?.message?.content?.trim().toLowerCase();
        console.log(`[Chat] Detected intent: ${intent}`);
        
        return intent === 'resolution' ? 'resolution' : 'execution';
    } catch (error) {
        console.error('[Chat] Error detecting resolution vs execution:', error);
        return 'execution';
    }
}

/**
 * Extract JSON from mixed content (text + JSON)
 */
function extractJSON(content) {
    try {
        const trimmed = content.trim();
        const objStart = trimmed.indexOf('{');
        const arrStart = trimmed.indexOf('[');

        if (objStart === -1 && arrStart === -1) {
            return null;
        }

        let jsonStart = -1;
        let jsonEnd = -1;

        if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
            jsonStart = objStart;
            let depth = 0;
            for (let i = objStart; i < trimmed.length; i++) {
                if (trimmed[i] === '{') depth++;
                if (trimmed[i] === '}') {
                    depth--;
                    if (depth === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }
        } else {
            jsonStart = arrStart;
            let depth = 0;
            for (let i = arrStart; i < trimmed.length; i++) {
                if (trimmed[i] === '[') depth++;
                if (trimmed[i] === ']') {
                    depth--;
                    if (depth === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
            }
        }

        if (jsonStart === -1 || jsonEnd === -1) {
            return null;
        }

        const json = trimmed.substring(jsonStart, jsonEnd);
        const text = trimmed.substring(0, jsonStart).trim();
        JSON.parse(json); // Validate
        
        return { json, text };
    } catch {
        return null;
    }
}

/**
 * Summarize a single message while preserving critical data
 */
async function summarizeMessage(message, apiKey) {
    if (message.content.length < 500 || message.role === 'system') {
        return message;
    }

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_DEFAULT_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `Summarize this message preserving ALL critical data: names, IDs, numbers, entities, relationships. Remove only fluff and explanations.`,
                    },
                    {
                        role: 'user',
                        content: message.content,
                    },
                ],
                temperature: 0.1,
                max_tokens: 1024,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            return {
                ...message,
                content: data.choices[0]?.message?.content || message.content,
            };
        }
    } catch (error) {
        console.warn('[Chat] Message summarization failed:', error);
    }

    return message;
}

/**
 * Summarize old messages to reduce token usage
 */
async function summarizeMessages(messages, apiKey) {
    if (messages.length <= 10) {
        return messages;
    }

    const recentMessages = messages.slice(-5);
    const oldMessages = messages.slice(0, -5);

    console.log(`[Chat] Summarizing ${oldMessages.length} old messages, keeping ${recentMessages.length} recent`);

    try {
        const summarizedOldMessages = await Promise.all(
            oldMessages.map(msg => summarizeMessage(msg, apiKey))
        );
        return [...summarizedOldMessages, ...recentMessages];
    } catch (error) {
        console.warn('[Chat] Error summarizing messages:', error);
        return recentMessages;
    }
}

// ==================== END ENHANCED HELPER FUNCTIONS ====================

/**
 * Get or create a conversation for the user
 * @param {number} userId - Internal user ID
 * @param {string} customerUserId - External customer user ID (optional)
 * @returns {Promise<number>} Conversation ID
 */
async function getOrCreateConversation(userId, customerUserId) {
    try {
        console.log(`[Chat.DAO] Creating conversation for userId=${userId}, customerUserId=${customerUserId || 'N/A'}`);
        const conv = await conversationDAO.createConversation({
            userId,
            customerUserId,
            title: `Chat ${new Date().toISOString().split('T')[0]}`,
            description: 'Chat conversation',
        });
        console.log(`[Chat.DAO] Conversation created successfully: id=${conv.id}`);
        return conv.id;
    } catch (error) {
        console.error(`[Chat.DAO] Error creating conversation:`, error);
        throw error;
    }
}

/**
 * Create and store plan in database
 * @param {Object} params - Parameters
 * @returns {Promise<number>} Plan ID
 */
async function createAndStorePlan({ conversationId, userId, actionablePlan, sessionId }) {
    try {
        console.log(`[Chat.DAO] Creating plan with ${(actionablePlan.execution_plan || []).length} steps`);
        const plan = await planDAO.createPlan({
            conversationId,
            userId,
            userMessageId: null,
            planJson: actionablePlan,
            intentType: actionablePlan.intent_type || 'UNKNOWN',
        });
        console.log(`[Chat.DAO] Plan created successfully: id=${plan.id}, status=${plan.status}`);
        return plan.id;
    } catch (error) {
        console.error(`[Chat.DAO] Error creating plan:`, error);
        throw error;
    }
}

/**
 * Execute plan and persist all results to database
 * @param {Object} pending - Pending plan from session store
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID
 * @param {string} userToken - Auth token
 * @returns {Promise<Object>} Response object
 */
async function executeAndPersistPlan(pending, userId, conversationId, userToken) {
    const executedSteps = [];
    const context = initUsefulDataContext();
    const collectedData = {}; // Track all collected data from responses
    const baseUrl = process.env.BACKEND_URL || process.env.ELASTICDASH_API_URL || '';
    const planId = pending.planId; // Get the planId from pending data
    
    console.log(`[Chat.Executor] Starting execution of ${(pending.plan.execution_plan || []).length} steps for planId=${planId}`);

    try {
        for (const step of pending.plan.execution_plan || []) {
            console.log(`[Chat.Executor] Executing step ${step.step_number}: ${step.description}`);
            const startTime = Date.now();
            
            // Check if this is a loop step
            if (step.loop) {
                console.log(`[Chat.Executor] Step ${step.step_number} is a LOOP step`);
                const loopResult = await executeLoopStep({ 
                    step, 
                    executedSteps, 
                    baseUrl, 
                    userToken, 
                    recordToDb: true,
                    planId
                });
                
                if (loopResult.error) {
                    const duration = Date.now() - startTime;
                    console.error(`[Chat.Executor] Loop step ${step.step_number} failed: ${loopResult.error}`);
                    executedSteps.push({ 
                        step: step.step_number || executedSteps.length + 1, 
                        response: null,
                        api: step.api,
                        description: step.description,
                        error: loopResult.error,
                        isLoop: true,
                        iterations: [],
                    });
                    return {
                        message: loopResult.error,
                        error: loopResult.error,
                        executedSteps,
                        accumulatedResults: executedSteps,
                        refinedQuery: pending.refinedQuery,
                    };
                }
                
                const duration = Date.now() - startTime;
                console.log(`[Chat.Executor] Loop step ${step.step_number} completed with ${loopResult.iterations.length} iterations in ${duration}ms`);
                
                // Record the loop execution as one compound step with all iterations
                if (conversationId) {
                    try {
                        // Create a summary response showing all iterations
                        const iterationSummary = loopResult.iterations.map(iter => ({
                            iteration: iter.iteration,
                            value: iter.value,
                            success: !iter.result.error,
                        }));
                        
                        await planStepDAO.recordStepExecution({
                            stepId: step.id,
                            status: 'success',
                            apiRequest: step.api || null,
                            apiResponse: { loopIterations: iterationSummary },
                            errorMessage: null,
                            durationMs: duration,
                        });
                        console.log(`[Chat.DAO] Loop step ${step.step_number} execution recorded to database`);
                    } catch (dbError) {
                        console.error(`[Chat.DAO] Error recording loop step execution:`, dbError);
                    }
                }
                
                // Store loop results in executedSteps
                const aggregatedResponse = loopResult.iterations.map(iter => iter.result.response);
                const sanitized = sanitizeForSerialization(aggregatedResponse);
                
                executedSteps.push({ 
                    step: step.step_number || executedSteps.length + 1, 
                    response: sanitized,
                    api: step.api,
                    description: step.description,
                    error: null,
                    isLoop: true,
                    iterations: loopResult.iterations.length,
                });
                
                // Record useful data from loop iterations
                const key = `${(step.api?.method || 'post').toLowerCase()} ${step.api?.path || ''}`;
                const dataStr = JSON.stringify(sanitized);
                recordUsefulData(context, key, dataStr);
                collectedData[key] = dataStr;
                
            } else {
                // Regular (non-loop) step execution
                const { response, error } = await executeStep({ step, baseUrl, userToken, executedSteps, recordToDb: true, planId });
                const duration = Date.now() - startTime;
                const sanitized = sanitizeForSerialization(response);
                
                executedSteps.push({ 
                    step: step.step_number || executedSteps.length + 1, 
                    response: sanitized,
                    api: step.api,
                    description: step.description,
                    error: error || null,
                });
                
                console.log(`[Chat.Executor] Step ${step.step_number} completed in ${duration}ms, error=${error ? 'yes' : 'no'}`);
                
                // Record step execution to database
                if (conversationId) {
                try {
                    await planStepDAO.recordStepExecution({
                        stepId: step.id,
                        status: error ? 'failed' : 'success',
                        apiRequest: step.api || null,
                        apiResponse: sanitized,
                        errorMessage: error || null,
                        durationMs: duration,
                    });
                    console.log(`[Chat.DAO] Step ${step.step_number} execution recorded to database`);
                } catch (dbError) {
                    console.error(`[Chat.DAO] Error recording step execution:`, dbError);
                }
            }

                // Record useful data from regular step
                const key = `${(step.api?.method || 'post').toLowerCase()} ${step.api?.path || ''}`;
                const dataStr = JSON.stringify(sanitized);
                recordUsefulData(context, key, dataStr);
                collectedData[key] = dataStr;
                
                if (error) {
                    console.error(`[Chat.Executor] Step ${step.step_number} failed: ${error}`);
                    return {
                        message: error,
                        error,
                        executedSteps,
                        accumulatedResults: executedSteps,
                        refinedQuery: pending.refinedQuery,
                    };
                }
            }
        }

        // Record final plan as executed
        if (conversationId) {
            await planDAO.updatePlanStatus(conversationId, 'executed', userId);
            console.log(`[Chat.DAO] Plan marked as executed`);

            // Create a message in the conversation showing the execution completion
            try {
                // Generate final answer from collected data
                let finalAnswer = '';
                try {
                    console.log(`[Chat.Planner] Generating final answer from execution results`);
                    finalAnswer = await generateFinalAnswer({
                        refinedQuery: pending.refinedQuery,
                        executedSteps: executedSteps.filter(s => !s.error),
                        collectedData,
                    });
                    console.log(`[Chat.Planner] Final answer generated successfully`);
                } catch (answerErr) {
                    console.error(`[Chat.Planner] Error generating final answer:`, answerErr);
                    finalAnswer = 'Unable to generate final answer';
                }

                // Build plan steps section
                const planSteps = (pending.plan.execution_plan || []).map((step, idx) => {
                    const stepNum = idx + 1;
                    const method = (step.api?.method || 'POST').toUpperCase();
                    const path = step.api?.path || '';
                    const description = step.description || 'Step execution';
                    
                    // Find corresponding executed step
                    const executedStep = executedSteps[idx];
                    const status = executedStep?.error ? 'FAILED' : 'SUCCESS';
                    
                    let stepText = `Step ${stepNum}:\nCall ${path} [${method}]`;
                    
                    // Add request body if available
                    if (step.api?.requestBody) {
                        stepText += `\n${JSON.stringify(step.api.requestBody, null, 2)}`;
                    }
                    
                    // Add response/result
                    if (executedStep?.response) {
                        const responseStr = typeof executedStep.response === 'string' 
                            ? executedStep.response 
                            : JSON.stringify(executedStep.response, null, 2);
                        // Limit response length to 500 chars
                        const limitedResponse = responseStr.length > 500 
                            ? responseStr.substring(0, 500) + '...' 
                            : responseStr;
                        stepText += `\nResult: ${limitedResponse}`;
                    }
                    
                    stepText += `\nStatus: ${status}`;
                    
                    return stepText;
                }).join('\n\n');

                // Build final deliverable - summarize what was accomplished
                const finalDeliverable = pending.plan.expected_output 
                    || pending.plan.final_deliverable
                    || `Results from ${executedSteps.length} step${executedSteps.length !== 1 ? 's' : ''} of the plan`;

                // Build completion message with final answer
                const completionMessage = `${finalAnswer}`;

                await messageDAO.insertMessage({
                    conversationId,
                    userId,
                    customerUserId: null,
                    role: 'assistant',
                    content: completionMessage,
                    messageType: 'execution_result',
                    metadata: {
                        planId: pending.plan.id,
                        stepsExecuted: executedSteps.length,
                        finalAnswer: finalAnswer,
                        finalDeliverable,
                        executionDetails: executedSteps.map((step, idx) => ({
                            stepNumber: idx + 1,
                            description: (pending.plan.execution_plan[idx])?.description,
                            status: step.error ? 'failed' : 'success',
                            error: step.error || null,
                        })),
                    },
                });
                
                console.log(`[Chat.DAO] Execution result message created with final answer`);
            } catch (msgError) {
                console.error(`[Chat.DAO] Error creating execution result message:`, msgError);
                // Continue even if message creation fails
            }
        }

        console.log(`[Chat.Executor] All steps executed successfully, total=${executedSteps.length}`);
        
        // POST-EXECUTION GOAL VALIDATION
        console.log(`[Chat.Executor] Validating if user's goal has been achieved...`);
        const executionContextStr = serializeUsefulDataInOrder(context);
        let goalValidation;
        let finalAnswerGenerated = ''; // Store final answer for return
        
        try {
            goalValidation = await validateGoalAchieved(
                pending.refinedQuery,
                executedSteps,
                executionContextStr
            );
            console.log(`[Chat.Executor] Goal validation result:`, {
                achieved: goalValidation.achieved,
                reason: goalValidation.reason,
                completedItems: goalValidation.completedItems,
                missingItems: goalValidation.missingItems,
            });
        } catch (validationErr) {
            console.error(`[Chat.Executor] Error validating goal achievement:`, validationErr);
            goalValidation = {
                achieved: false,
                reason: 'Validation error: ' + validationErr.message,
                completedItems: executedSteps.map(s => s.description),
                missingItems: [],
            };
        }

        // Retrieve the final answer that was generated earlier
        if (conversationId) {
            try {
                // Query the most recent message to get the final answer
                const recentMessages = await messageDAO.getMessagesByConversationId(conversationId, userId, 1, 0);
                if (recentMessages && recentMessages.length > 0 && recentMessages[0].message_type === 'execution_result') {
                    finalAnswerGenerated = recentMessages[0].content || '';
                }
            } catch (msgErr) {
                console.error(`[Chat.Executor] Error retrieving final answer from message:`, msgErr);
            }
        }

        return {
            message: 'Plan executed',
            refinedQuery: pending.refinedQuery,
            executedSteps,
            accumulatedResults: executedSteps,
            goalValidation,
            finalAnswer: finalAnswerGenerated,
        };
    } catch (error) {
        console.error(`[Chat.Executor] Error executing plan:`, error);
        if (conversationId) {
            try {
                await planDAO.updatePlanStatus(conversationId, 'failed', userId);
                console.log(`[Chat.DAO] Plan marked as failed`);

                // Create a failure message in the conversation
                try {
                    await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId: null,
                        role: 'assistant',
                        content: `Plan execution failed: ${error.message || 'Unknown error'}`,
                        messageType: 'execution_error',
                        metadata: {
                            planId: pending?.plan?.id,
                            error: error.message || 'Unknown error',
                        },
                    });
                    console.log(`[Chat.DAO] Execution error message created`);
                } catch (msgError) {
                    console.error(`[Chat.DAO] Error creating execution error message:`, msgError);
                    // Continue even if message creation fails
                }
            } catch (dbError) {
                console.error(`[Chat.DAO] Error updating plan status:`, dbError);
            }
        }
        throw error;
    }
}

/**
 * Handle approval and execution with database persistence
 * @param {Object} dbSession - Session from database
 * @param {number} userId - User ID
 * @param {string} userToken - Auth token
 * @returns {Promise<Object>} Response object
 */
async function handleApprovalAndExecution(dbSession, userId, userToken) {
    try {
        const planId = dbSession.pending_plan_id;
        console.log(`[Chat.Approval] Approving plan: planId=${planId}`);
        
        // Approve plan
        await planDAO.approvePlan(planId, userId);
        console.log(`[Chat.DAO] Plan approved successfully`);

        // Get plan details
        const plan = await planDAO.getPlanById(planId, userId);
        if (!plan) {
            console.error(`[Chat.Approval] Plan not found: planId=${planId}`);
            throw new Error('Plan not found');
        }

        const planJson = typeof plan.plan_json === 'string' 
            ? JSON.parse(plan.plan_json) 
            : plan.plan_json;

        console.log(`[Chat.Approval] Plan loaded: ${(planJson.execution_plan || []).length} steps`);

        const pending = {
            plan: planJson,
            refinedQuery: dbSession.session_data?.refinedQuery || '',
            planId: planId,
        };

        return await executeAndPersistPlan(pending, userId, dbSession.conversation_id, userToken);
    } catch (error) {
        console.error(`[Chat.Approval] Error handling approval:`, error);
        throw error;
    }
}

// ==================== VALIDATION & EXTRACTION FUNCTIONS ====================

/**
 * Validate if more actions are needed to satisfy the original goal
 * Uses LLM to semantically check if goal has been achieved based on execution results
 */
async function validateNeedMoreActions(originalQuery, executedSteps, accumulatedResults, apiKey, lastExecutionPlan) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_DEFAULT_MODEL,
                messages: [
                    {
                        role: 'system',
                        content: `You are a goal completion validator. Determine if the original user goal has been fully satisfied based on execution results.

RULES:
1. A successful API call ≠ task completion
2. An empty execution plan ≠ task completion  
3. Only goal satisfaction determines completion
4. If uncertain, respond needsMoreActions = true

OUTPUT (JSON ONLY):
If goal IS satisfied:
{"needsMoreActions": false, "reason": "Goal fully satisfied"}

If goal is NOT satisfied:
{"needsMoreActions": true, "reason": "What is missing", "missing_requirements": ["requirement1"]}

If requested item NOT FOUND:
{"needsMoreActions": false, "reason": "Item not found", "item_not_found": true}`,
                    },
                    {
                        role: 'user',
                        content: `Original Query: ${originalQuery}

Executed Steps: ${JSON.stringify(executedSteps, null, 2)}

Accumulated Results: ${JSON.stringify(accumulatedResults, null, 2)}

Is the goal satisfied?`,
                    },
                ],
                temperature: 0.3,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            console.warn('[Chat] Validation failed, assuming more actions needed');
            return { needsMoreActions: true, reason: 'Validation error' };
        }

        const data = await response.json();
        const content = data.choices[0]?.message?.content || '';
        const sanitized = content.replace(/```json|```/g, '').trim();
        const jsonMatch = sanitized.match(/\{[\s\S]*\}/);
        
        if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
        }

        return { needsMoreActions: false, reason: 'Unable to parse validator response' };
    } catch (error) {
        console.error('[Chat] Error in validator:', error);
        return { needsMoreActions: false, reason: 'Validator error' };
    }
}

/**
 * Extract useful data from API responses to help answer user queries
 * Uses LLM to identify important information to preserve
 */
async function extractUsefulDataFromApiResponses(refinedQuery, finalDeliverable, existingUsefulData, apiResponse, apiKey) {
    try {
        const prompt = `You are an expert at extracting useful information from API responses.

CRITICAL RULES:
1. Preserve ALL ID fields (id, pokemon_id, user_id, etc.)
2. Preserve foreign key relationships
3. Preserve status fields (deleted, active, success, etc.)
4. Keep ONLY facts explicitly stated in the response
5. NEVER state goal completion (e.g., don't say "watchlist was cleared")
6. Report facts like: "deletedCount: 3", "success: true", "ID: 456"

Refined Query: ${refinedQuery}
Final Deliverable: ${finalDeliverable}
Existing Data: ${existingUsefulData}
API Response: ${apiResponse}

Extract useful data preserving all critical fields:`;

        const apiKeyEnv = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKeyEnv) {
            return existingUsefulData;
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKeyEnv}`,
            },
            body: JSON.stringify({
                model: process.env.OPENAI_DEFAULT_MODEL,
                messages: [{ role: 'system', content: prompt }],
                temperature: 0.5,
                max_tokens: 2048,
            }),
        });

        if (!response.ok) {
            return existingUsefulData;
        }

        const data = await response.json();
        return data.choices[0]?.message?.content?.trim() || existingUsefulData;
    } catch (error) {
        console.error('[Chat] Error extracting useful data:', error);
        return existingUsefulData;
    }
}

// ==================== END VALIDATION & EXTRACTION ====================

export async function postChatCompletion(req) {
    let planId = null;
    const startTime = Date.now();
    
    try {
        const { messages, sessionId: clientSessionId, isApproval, userId, customerUserId, conversationId: providedConversationId = null } = req.body || {};
        let conversationId = providedConversationId;
        
        console.log('[Chat] Starting postChatCompletion handler');
        console.log(`[Chat] userId=${userId}, customerUserId=${customerUserId || 'N/A'}, clientSessionId=${clientSessionId || 'new'}, conversationId=${conversationId || 'N/A'}, isApproval=${isApproval}`);
        
        if (!messages || !Array.isArray(messages) || messages.length === 0) {
            console.warn('[Chat] Validation failed: messages array required');
            // return res.status(400).json({ error: 'messages array required' });
            throw new Error('messages array required');
        }

        if (!userId) {
            console.warn('[Chat] Validation failed: userId required');
            // return res.status(400).json({ error: 'userId required in request body' });
            throw new Error('userId required in request body');
        }

        // Fetch project ID from user
        let projectId = null;
        try {
            const project = await fetchOrCreateLatestProject(userId);
            projectId = project.id;
            console.log(`[Chat] Fetched projectId=${projectId} for userId=${userId}`);
        } catch (err) {
            console.error('[Chat] Failed to fetch project for user:', err);
            throw new Error('Failed to fetch user project');
        }

        const sessionId = clientSessionId || generateSessionId(messages);
        const userToken = getAuthToken(req);
        console.log(`[Chat] Using sessionId=${sessionId}`);

        // Approval path - user is approving a pending plan
        const userMessage = [...messages].reverse().find((m) => m.role === 'user');
        const userInput = (userMessage?.content || '').trim().toLowerCase();
        const approval = isApproval === true || /^(approve|yes|proceed|ok|confirm|go ahead)$/i.test(userInput);
        const rejection = /^(reject|no|cancel|stop|nevermind|never mind)$/i.test(userInput);

        console.log(`[Chat] Approval check: isApproval=${isApproval}, userInput="${userInput.substring(0, 50)}", approval=${approval}, rejection=${rejection}`);

        // Fetch session once for all checks
        const dbSession = await sessionDAO.getSession(sessionId);

        if (approval) {
            console.log(`[Chat] Approval path: checking for pending plan`);

            if (dbSession && dbSession.pending_plan_id) {
                console.log(`[Chat] Found DB session with pending plan: planId=${dbSession.pending_plan_id}`);

                // Add approval message to conversation
                try {
                    await messageDAO.insertMessage({
                        conversationId: dbSession.conversation_id,
                        userId,
                        customerUserId,
                        role: 'user',
                        content: userInput || 'Approved',
                        messageType: 'approval',
                    });
                    console.log(`[Chat.DAO] Approval message added to conversation`);
                } catch (msgError) {
                    console.error(`[Chat.DAO] Error adding approval message:`, msgError);
                }

                setImmediate(async () => {
                    try {
                        const result = await handleApprovalAndExecution(dbSession, userId, userToken);
                        emitSessionEvent(sessionId, {
                            status: 'success',
                            sessionId,
                            conversationId: dbSession.conversation_id,
                            result,
                        });
                    } catch (error) {
                        console.error('[Chat] Async approval execution failed:', error);
                        emitSessionEvent(sessionId, {
                            status: 'failed',
                            sessionId,
                            conversationId: dbSession.conversation_id,
                            error: error.message || 'Execution failed',
                        });
                    }
                });

                return;
            }
            
            // Fallback to in-memory session store
            const pending = sessionStore.get(sessionId);
            if (pending) {
                console.log(`[Chat] Found in-memory session with pending plan`);
                sessionStore.delete(sessionId);

                setImmediate(async () => {
                    try {
                        const result = await executeAndPersistPlan(pending, userId, conversationId, userToken);
                        
                        // Check if goal validation indicates failure
                        if (result.goalValidation && !result.goalValidation.achieved) {
                            console.log(`[Chat] Goal not achieved after execution. Attempting replan...`);
                            console.log(`[Chat] Reason: ${result.goalValidation.reason}`);
                            console.log(`[Chat] Missing items: ${result.goalValidation.missingItems.join(', ')}`);
                            
                            try {
                                // Perform RAG search again to get fresh resources for replanning
                                const ragResults = await semanticSearch(
                                    pending.refinedQuery,
                                    { projectId: pending.projectId || null }
                                );
                                
                                // Create new replan
                                const replanResult = await createPostExecutionReplan({
                                    refinedQuery: pending.refinedQuery,
                                    executedSteps: result.executedSteps,
                                    executionContext: serializeUsefulDataInOrder({ usefulDataArray: [] }), // Note: would need context passed through
                                    goalValidation: result.goalValidation,
                                    ragResults,
                                    iteration: 2,
                                });
                                
                                console.log(`[Chat] Replan created successfully. New plan has ${replanResult.plan.execution_plan?.length || 0} steps`);
                                
                                // Send replan to FE for user approval
                                emitSessionEvent(sessionId, {
                                    status: 'goal_not_met_replan',
                                    sessionId,
                                    conversationId,
                                    reason: result.goalValidation.reason,
                                    completedItems: result.goalValidation.completedItems,
                                    missingItems: result.goalValidation.missingItems,
                                    previousExecutionResult: result,
                                    newPlan: replanResult.plan,
                                    message: `Goal not fully achieved. Completed: ${result.goalValidation.completedItems.join(', ')}. Missing: ${result.goalValidation.missingItems.join(', ')}. A new plan has been created to complete the missing items.`,
                                });
                            } catch (replanErr) {
                                console.error(`[Chat] Error creating replan:`, replanErr);
                                // Still emit the execution result even if replan fails
                                emitSessionEvent(sessionId, {
                                    status: 'completed_with_incomplete_goal',
                                    sessionId,
                                    conversationId,
                                    result,
                                    replanError: replanErr.message,
                                    message: `Execution completed but goal not fully achieved. ${result.goalValidation.reason}`,
                                });
                            }
                        } else if (result.goalValidation?.achieved) {
                            console.log(`[Chat] Goal successfully achieved!`);

                            emitSessionEvent(sessionId, {
                                status: 'success',
                                sessionId,
                                conversationId,
                                result,
                                message: result.finalAnswer || result.goalValidation.reason || 'Goal achieved successfully!',
                            });
                        } else {
                            // No goal validation result (shouldn't happen but fallback)
                            emitSessionEvent(sessionId, {
                                status: 'success',
                                sessionId,
                                conversationId,
                                result,
                            });
                        }
                    } catch (error) {
                        console.error('[Chat] Async approval execution failed (memory pending):', error);
                        emitSessionEvent(sessionId, {
                            status: 'failed',
                            sessionId,
                            conversationId,
                            error: error.message || 'Execution failed',
                        });
                    }
                });

                return;
            }
            
            console.log(`[Chat] No pending plan found for approval`);
        }

        // Rejection clears pending
        if (rejection && dbSession && dbSession.pending_plan_id) {
            console.log(`[Chat] Rejection path: rejecting plan planId=${dbSession.pending_plan_id}`);
            
            // Add rejection message to conversation
            try {
                await messageDAO.insertMessage({
                    conversationId: dbSession.conversation_id,
                    userId,
                    customerUserId,
                    role: 'user',
                    content: userInput || 'Rejected',
                    messageType: 'rejection',
                });
                console.log(`[Chat.DAO] Rejection message added to conversation`);
            } catch (msgError) {
                console.error(`[Chat.DAO] Error adding rejection message:`, msgError);
            }
            
            await planDAO.rejectPlan(dbSession.pending_plan_id, userId, 'User rejected plan');
            await sessionDAO.deleteSession(sessionId);
        }

        if (rejection && sessionStore.get(sessionId)) {
            console.log(`[Chat] Rejection path: clearing in-memory session`);
            
            // Add rejection message to conversation if conversationId exists
            if (conversationId) {
                try {
                    await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId,
                        role: 'user',
                        content: userInput || 'Rejected',
                        messageType: 'rejection',
                    });
                    console.log(`[Chat.DAO] Rejection message added to conversation`);
                } catch (msgError) {
                    console.error(`[Chat.DAO] Error adding rejection message:`, msgError);
                }
            }
            
            sessionStore.delete(sessionId);
        }

        // Handle pending plan + new user message (not approval/rejection)
        // User may want to create a new plan, possibly with clarification context
        let clarificationContext = '';
        const pendingPlanToCleanup = dbSession?.pending_plan_id || null;
        
        if (pendingPlanToCleanup) {
            console.log(`[Chat] Pending plan detected (planId=${pendingPlanToCleanup}), user submitting new message - treating as new plan request`);
            
            // Check if last assistant message was a clarification
            if (conversationId || dbSession?.conversation_id) {
                const targetConversationId = conversationId || dbSession.conversation_id;
                try {
                    const recentMessages = await messageDAO.getMessagesByConversationIdFromId(targetConversationId, 0);
                    const lastAssistantMsg = recentMessages.reverse().find(m => m.role === 'assistant');
                    
                    if (lastAssistantMsg && lastAssistantMsg.message_type === 'clarification') {
                        clarificationContext = lastAssistantMsg.content;
                        console.log(`[Chat] Last message was clarification, including as context: "${clarificationContext.substring(0, 100)}..."`);
                    }
                } catch (err) {
                    console.error(`[Chat] Error fetching recent messages for clarification check:`, err);
                }
            }
            
            // Clean up old pending plan
            try {
                await planDAO.rejectPlan(pendingPlanToCleanup, userId, 'User submitted new plan request');
                await sessionDAO.deleteSession(sessionId);
                console.log(`[Chat] Cleaned up old pending plan planId=${pendingPlanToCleanup}`);
            } catch (cleanupErr) {
                console.error(`[Chat] Error cleaning up pending plan:`, cleanupErr);
            }
        }

        // Filter and derive refined query
        const cleanedMessages = filterPlanMessages(messages);
        const userMsgContent = cleanedMessages[cleanedMessages.length - 1];
        const refinedQuery = userMsgContent?.content || '';
        console.log(`[Chat] Refined query: "${refinedQuery.substring(0, 100)}${refinedQuery.length > 100 ? '...' : ''}"`);

        setImmediate(async () => {
            try {
                // Fetch project ID (moved to async path to avoid delaying HTTP response)
                let projectId = null;
                try {
                    const project = await fetchOrCreateLatestProject(userId);
                    projectId = project.id;
                    console.log(`[Chat] (async) Fetched projectId=${projectId} for userId=${userId}`);
                } catch (err) {
                    console.error('[Chat] (async) Failed to fetch project for user:', err);
                    emitSessionEvent(sessionId, {
                        status: 'failed',
                        sessionId,
                        conversationId,
                        error: 'Failed to fetch user project',
                        message: 'Failed to fetch user project',
                    });
                    return;
                }

                // Ensure conversation exists (create if needed)
                if (!conversationId) {
                    try {
                        console.log(`[Chat] (async) Creating conversation for userId=${userId}`);
                        conversationId = await getOrCreateConversation(userId, customerUserId);
                        console.log(`[Chat] (async) Created conversation: conversationId=${conversationId}`);
                    } catch (err) {
                        console.error('[Chat] (async) Failed to create conversation:', err);
                        emitSessionEvent(sessionId, {
                            status: 'failed',
                            sessionId,
                            conversationId: null,
                            error: 'Failed to create conversation',
                            message: 'Failed to create conversation',
                        });
                        return;
                    }
                } else {
                    console.log(`[Chat] Using provided conversationId=${conversationId}`);
                }

                // Insert user message (async) so chat_update can fire
                try {
                    console.log(`[Chat] (async) Storing user message in conversation`);
                    const userMsg = await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId,
                        role: 'user',
                        content: messages[messages.length - 1]?.content || '',
                        messageType: 'text',
                    });
                    console.log(`[Chat] (async) User message stored: messageId=${userMsg.id}`);
                    // Also emit to session room for FE listeners expecting session-based updates
                    emitSessionEvent(sessionId, {
                        status: 'message_recorded',
                        sessionId,
                        conversationId,
                        messageId: userMsg.id,
                    });
                } catch (msgErr) {
                    console.error('[Chat] (async) Error storing user message:', msgErr);
                    emitSessionEvent(sessionId, {
                        status: 'failed',
                        sessionId,
                        conversationId,
                        error: 'Failed to store user message',
                        message: 'Failed to store user message',
                    });
                    return;
                }

                // RAG: Always use semantic search to find relevant schemas/APIs
                console.log(`[Chat] Running RAG for query: "${refinedQuery.substring(0, 50)}${refinedQuery.length > 50 ? '...' : ''}"`);
                
                let topKResults = [];
                if (refinedQuery.trim().length > 0) {
                    try {
                        // Search BOTH APIs and tables separately to give planner full context
                        const [apiResults, tableResults] = await Promise.all([
                            semanticSearch(refinedQuery, 'api', 10, projectId),
                            semanticSearch(refinedQuery, 'table', 10, projectId)
                        ]);
                        
                        console.log(`[Chat] API search: ${apiResults.length} results, Table search: ${tableResults.length} results`);
                        
                        // Map both to format expected by planner
                        const apiMapped = apiResults.map((item) => ({
                            name: item.name || item.id,
                            endpoint: item.endpoint || item.path || '',
                            method: item.method || '',
                            type: 'api',
                            similarity: item.similarity
                        }));
                        
                        const tableMapped = tableResults.map((item) => ({
                            name: item.name || item.id,
                            content: item.content || '',  // Full schema with examples
                            type: 'table',
                            similarity: item.similarity
                        }));
                        
                        // Combine: tables first (for SQL planning), then APIs
                        topKResults = [...tableMapped, ...apiMapped];
                    } catch (error) {
                        console.error(`[Chat] Semantic search failed:`, error.message);
                        emitSessionEvent(sessionId, {
                            status: 'failed',
                            sessionId,
                            conversationId,
                            error: error.message,
                            message: `Semantic search failed: ${error.message}`,
                        });
                        return;
                    }
                }
                
                console.log(`[Chat] RAG results: ${topKResults.length} items (${topKResults.filter(r => r.type === 'table').length} tables, ${topKResults.filter(r => r.type === 'api').length} APIs)`);

                const context = initUsefulDataContext();
                const usefulData = serializeUsefulDataInOrder(context);

                console.log(`[Chat] Running planning pipeline...`);
                const planStartTime = Date.now();
                
                // Build conversation context with clarification if present
                let conversationContext = '';
                if (clarificationContext) {
                    conversationContext = `Previous clarification question: ${clarificationContext}\n\nUser's response: ${refinedQuery}`;
                }
                
                
                // ONLY generate plan - DO NOT execute without approval
                console.log(`[Chat] Generating plan (execution requires approval)...`);
                
                // Run planning pipeline (without execution)
                const planningResult = await runPlanningPipeline({
                    refinedQuery,
                    ragResults: topKResults,
                    usefulData: usefulData,
                    conversationContext,
                    maxPlanIterations: 10,
                });

                const planDuration = Date.now() - planStartTime;
                console.log(`[Chat] Plan generation completed in ${planDuration}ms`);
                
                // runPlanningPipeline returns { actionablePlan, planResponse, validation, validationLoop }
                const actionablePlan = planningResult.actionablePlan;
                
                if (actionablePlan && actionablePlan.execution_plan && actionablePlan.execution_plan.length > 0) {
                    const executionPlan = actionablePlan.execution_plan;
                    console.log(`[Chat] Generated plan with ${executionPlan.length} steps`);
                    
                    // Store plan in database as PENDING (requires approval)
                    planId = await createAndStorePlan({
                        conversationId,
                        userId,
                        actionablePlan: actionablePlan,
                        sessionId,
                    });
                    console.log(`[Chat] Execution plan recorded: planId=${planId}`);
                    
                    // Create session record with pending plan
                    await sessionDAO.upsertSession({
                        sessionId,
                        userId,
                        conversationId,
                        pendingPlanId: planId,
                        sessionData: { refinedQuery, projectId },
                    });
                    console.log(`[Chat] Session record created with pending plan`);
                    
                    // Create assistant message requesting approval
                    console.log(`[Chat] Approval request message created`);
                    
                    // Emit socket event requesting approval
                    const totalDuration = Date.now() - startTime;
                    console.log(`[Chat] Plan generation completed in ${totalDuration}ms, awaiting approval`);
                    
                    emitSessionEvent(sessionId, {
                        status: 'chat_update',
                        sessionId,
                        conversationId,
                        planId,
                        plan: actionablePlan,
                        message: approvalMessage,
                        refinedQuery,
                    });
                } else if (actionablePlan && actionablePlan.needs_clarification) {
                    // Plan needs clarification
                    const message = actionablePlan.clarification_question || 'I need more information to proceed.';
                    
                    await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId,
                        role: 'assistant',
                        content: message,
                        messageType: 'clarification',
                    });
                    
                    const totalDuration = Date.now() - startTime;
                    console.log(`[Chat] Planning completed in ${totalDuration}ms (clarification needed)`);
                    
                    emitSessionEvent(sessionId, {
                        status: 'needs_clarification',
                        sessionId,
                        conversationId,
                        message,
                    });
                } else if (actionablePlan && actionablePlan.message) {
                    // Goal already completed or special message (e.g., "Goal completed with existing data")
                    const message = actionablePlan.message;
                    
                    await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId,
                        role: 'assistant',
                        content: message,
                        messageType: 'info',
                    });
                    
                    const totalDuration = Date.now() - startTime;
                    console.log(`[Chat] Planning completed in ${totalDuration}ms (goal already complete)`);
                    
                    emitSessionEvent(sessionId, {
                        status: 'goal_already_complete',
                        sessionId,
                        conversationId,
                        message,
                    });
                } else {
                    // Unexpected case - no plan structure recognized
                    const message = 'Unable to generate an execution plan for your request.';
                    
                    await messageDAO.insertMessage({
                        conversationId,
                        userId,
                        customerUserId,
                        role: 'assistant',
                        content: message,
                        messageType: 'error',
                    });
                    
                    const totalDuration = Date.now() - startTime;
                    console.log(`[Chat] Planning completed in ${totalDuration}ms (unexpected plan structure)`);
                    
                    emitSessionEvent(sessionId, {
                        status: 'failed',
                        sessionId,
                        conversationId,
                        message,
                    });
                }
            } catch (err) {
                const totalDuration = Date.now() - startTime;
                console.error(`[Chat] Async planning failed (${totalDuration}ms):`, err);
                const errorMsg = sanitizeDbError(err) || err.message || 'Internal error';
                emitSessionEvent(sessionId, {
                    status: 'failed',
                    sessionId,
                    conversationId,
                    error: errorMsg,
                    message: errorMsg,
                });
            }
        });

        return;
    } catch (err) {
        const totalDuration = Date.now() - startTime;
        console.error(`[Chat] Error in postChatCompletion (${totalDuration}ms):`, err);
        const errorMsg = sanitizeDbError(err) || err.message || 'Internal error';
        throw new Error(errorMsg);
    }
}
