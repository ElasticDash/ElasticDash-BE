import { query, formatTimestamp, sanitizeDbError } from '../../postgres.js';

/**
 * Data Access Object for Chat Sessions
 * Manages session data for chat approval workflow and context
 */

/**
 * Create or update session
 * @param {string} sessionId - Unique session identifier
 * @param {number} userId - User ID
 * @param {number} conversationId - Conversation ID (optional)
 * @param {number} pendingPlanId - ID of pending plan awaiting approval (optional)
 * @param {Object} sessionData - Additional session data (plan, refinedQuery, etc.)
 * @param {number} expiresInSeconds - Session expiration time in seconds (default 3600)
 * @returns {Promise<Object>} Created/updated session
 */
export async function upsertSession({
    sessionId,
    userId,
    conversationId,
    pendingPlanId,
    sessionData,
    expiresInSeconds = 3600,
}) {
    try {
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

        const result = await query(
            `INSERT INTO ChatSessions 
             (id, user_id, conversation_id, pending_plan_id, session_data, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (id) 
             DO UPDATE SET 
                user_id = $2,
                conversation_id = $3,
                pending_plan_id = $4,
                session_data = $5,
                expires_at = $6,
                updated_at = CURRENT_TIMESTAMP
             RETURNING id, user_id, conversation_id, pending_plan_id, session_data, expires_at, created_at`,
            [
                sessionId,
                userId,
                conversationId || null,
                pendingPlanId || null,
                sessionData ? JSON.stringify(sessionData) : null,
                expiresAt,
            ]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error upserting session:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session or null if expired/not found
 */
export async function getSession(sessionId) {
    try {
        const result = await query(
            `SELECT id, user_id, conversation_id, pending_plan_id, session_data, expires_at, created_at, updated_at
             FROM ChatSessions
             WHERE id = $1 AND expires_at > CURRENT_TIMESTAMP`,
            [sessionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching session:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get all active sessions for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array>} List of active sessions
 */
export async function getActiveSessionsByUser(userId) {
    try {
        const result = await query(
            `SELECT id, user_id, conversation_id, pending_plan_id, expires_at, created_at
             FROM ChatSessions
             WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching user sessions:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get latest session for a conversation
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object|null>} Latest active session or null
 */
export async function getLatestSessionByConversationId(conversationId) {
    try {
        const result = await query(
            `SELECT id, user_id, conversation_id, pending_plan_id, session_data, expires_at, created_at, updated_at
             FROM ChatSessions
             WHERE conversation_id = $1 AND expires_at > CURRENT_TIMESTAMP
             ORDER BY created_at DESC
             LIMIT 1`,
            [conversationId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching latest session by conversation ID:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Update session data
 * @param {string} sessionId - Session ID
 * @param {Object} sessionData - New session data
 * @returns {Promise<Object|null>} Updated session
 */
export async function updateSessionData(sessionId, sessionData) {
    try {
        const result = await query(
            `UPDATE ChatSessions
             SET session_data = $1, updated_at = $2
             WHERE id = $3 AND expires_at > CURRENT_TIMESTAMP
             RETURNING id, session_data, updated_at`,
            [JSON.stringify(sessionData), formatTimestamp(), sessionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating session data:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Update pending plan for session
 * @param {string} sessionId - Session ID
 * @param {number} pendingPlanId - New pending plan ID
 * @returns {Promise<Object|null>} Updated session
 */
export async function updatePendingPlan(sessionId, pendingPlanId) {
    try {
        const result = await query(
            `UPDATE ChatSessions
             SET pending_plan_id = $1, updated_at = $2
             WHERE id = $3 AND expires_at > CURRENT_TIMESTAMP
             RETURNING id, pending_plan_id, updated_at`,
            [pendingPlanId || null, formatTimestamp(), sessionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating pending plan:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Extend session expiration
 * @param {string} sessionId - Session ID
 * @param {number} expiresInSeconds - Additional time in seconds (default 3600)
 * @returns {Promise<Object|null>} Updated session
 */
export async function extendSession(sessionId, expiresInSeconds = 3600) {
    try {
        const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();

        const result = await query(
            `UPDATE ChatSessions
             SET expires_at = $1, updated_at = $2
             WHERE id = $3
             RETURNING id, expires_at, updated_at`,
            [expiresAt, formatTimestamp(), sessionId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error extending session:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Delete session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} Success status
 */
export async function deleteSession(sessionId) {
    try {
        const result = await query(
            `DELETE FROM ChatSessions WHERE id = $1 RETURNING id`,
            [sessionId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting session:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Clean up expired sessions
 * @returns {Promise<number>} Number of deleted sessions
 */
export async function cleanupExpiredSessions() {
    try {
        const result = await query(
            `DELETE FROM ChatSessions WHERE expires_at <= CURRENT_TIMESTAMP`
        );
        return result.rowCount;
    } catch (error) {
        console.error('Error cleaning up expired sessions:', error);
        throw new Error(sanitizeDbError(error));
    }
}
