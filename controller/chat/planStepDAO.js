import { query, formatTimestamp, sanitizeDbError } from '../../postgres.js';

/**
 * Data Access Object for Chat Plan Steps
 * Tracks execution of individual steps within a plan
 */

/**
 * Insert a plan step
 * @param {number} planId - Plan ID
 * @param {number} stepNumber - Step sequence number
 * @param {string} description - Step description
 * @param {string} apiPath - API endpoint path
 * @param {string} apiMethod - HTTP method (GET, POST, etc.)
 * @returns {Promise<Object>} Created step
 */
export async function insertStep({
    planId,
    stepNumber,
    description,
    apiPath,
    apiMethod,
}) {
    try {
        const result = await query(
            `INSERT INTO ChatPlanSteps 
             (plan_id, step_number, description, api_path, api_method, status)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, plan_id, step_number, description, api_path, api_method, status, created_at`,
            [planId, stepNumber, description || '', apiPath || '', apiMethod || 'POST', 'pending']
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error inserting step:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Record step execution result
 * @param {number} stepId - Step ID
 * @param {string} status - Step status (completed, failed, etc.)
 * @param {Object} apiRequest - Request object sent to API
 * @param {Object} apiResponse - Response object from API
 * @param {string} errorMessage - Error message if failed (optional)
 * @param {number} durationMs - Execution duration in milliseconds
 * @returns {Promise<Object|null>} Updated step
 */
export async function recordStepExecution({
    stepId,
    status,
    apiRequest,
    apiResponse,
    errorMessage,
    durationMs,
}) {
    try {
        const result = await query(
            `UPDATE ChatPlanSteps
             SET status = $1, 
                 api_request_json = $2,
                 api_response_json = $3,
                 error_message = $4,
                 duration_ms = $5,
                 updated_at = $6
             WHERE id = $7
             RETURNING id, status, duration_ms, error_message, updated_at`,
            [
                status,
                apiRequest ? JSON.stringify(apiRequest) : null,
                apiResponse ? JSON.stringify(apiResponse) : null,
                errorMessage || null,
                durationMs || 0,
                formatTimestamp(),
                stepId,
            ]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error recording step execution:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get steps by plan ID
 * @param {number} planId - Plan ID
 * @returns {Promise<Array>} List of steps
 */
export async function getStepsByPlanId(planId) {
    try {
        const result = await query(
            `SELECT id, plan_id, step_number, description, api_path, api_method, 
                    api_request_json, api_response_json, status, error_message, 
                    duration_ms, created_at, updated_at
             FROM ChatPlanSteps
             WHERE plan_id = $1
             ORDER BY step_number ASC`,
            [planId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching steps:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get step by ID
 * @param {number} stepId - Step ID
 * @returns {Promise<Object|null>} Step or null
 */
export async function getStepById(stepId) {
    try {
        const result = await query(
            `SELECT id, plan_id, step_number, description, api_path, api_method,
                    api_request_json, api_response_json, status, error_message, 
                    duration_ms, created_at, updated_at
             FROM ChatPlanSteps
             WHERE id = $1`,
            [stepId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching step:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get plan execution summary (count by status)
 * @param {number} planId - Plan ID
 * @returns {Promise<Object>} Status counts
 */
export async function getExecutionSummary(planId) {
    try {
        const result = await query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
                COUNT(CASE WHEN status = 'success' THEN 1 END) as completed,
                COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
                COUNT(CASE WHEN status = 'skipped' THEN 1 END) as skipped
             FROM ChatPlanSteps
             WHERE plan_id = $1`,
            [planId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error fetching execution summary:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get all failed steps for a plan
 * @param {number} planId - Plan ID
 * @returns {Promise<Array>} List of failed steps
 */
export async function getFailedSteps(planId) {
    try {
        const result = await query(
            `SELECT id, step_number, description, api_path, api_method,
                    error_message, duration_ms, updated_at
             FROM ChatPlanSteps
             WHERE plan_id = $1 AND status = 'failed'
             ORDER BY step_number ASC`,
            [planId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching failed steps:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Update step status
 * @param {number} stepId - Step ID
 * @param {string} status - New status
 * @returns {Promise<Object|null>} Updated step
 */
export async function updateStepStatus(stepId, status) {
    try {
        const result = await query(
            `UPDATE ChatPlanSteps
             SET status = $1, updated_at = $2
             WHERE id = $3
             RETURNING id, status, updated_at`,
            [status, formatTimestamp(), stepId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating step status:', error);
        throw new Error(sanitizeDbError(error));
    }
}
