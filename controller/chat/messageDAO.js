/**
 * Get 20 messages by conversation ID and starting message ID (inclusive)
 * @param {number} conversationId - Conversation ID
 * @param {number} lastMessage - First message ID (inclusive, 0 for latest)
 * @returns {Promise<Array>} List of messages
 */
export async function getMessagesByConversationIdFromId(conversationId, lastMessage) {
    try {
        let result;
        if (lastMessage === 0) {
            // Fetch latest 20 messages, ordered DESC, then reverse to ASC
            result = await query(
                `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                        m.message_type, m.metadata, m.created_at, m.plan_id,
                        p.plan_json, p.intent_type as plan_intent_type,
                        p.status as plan_status, p.needs_approval as plan_needs_approval,
                        p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                        p.rejection_reason as plan_rejection_reason,
                        COALESCE(steps.steps, '[]'::json) as plan_steps
                 FROM ChatMessages m
                 LEFT JOIN ChatPlans p ON p.id = COALESCE(m.plan_id, (m.metadata->>'planId')::int) AND p.deleted = FALSE
                 LEFT JOIN LATERAL (
                     SELECT json_agg(
                         json_build_object(
                             'id', s.id,
                             'step_number', s.step_number,
                             'description', s.description,
                             'api_path', s.api_path,
                             'api_method', s.api_method,
                             'status', s.status,
                             'error_message', s.error_message,
                             'duration_ms', s.duration_ms,
                             'api_request_json', s.api_request_json,
                             'api_response_json', s.api_response_json,
                             'created_at', s.created_at,
                             'updated_at', s.updated_at
                         ) ORDER BY s.step_number ASC
                     ) as steps
                     FROM ChatPlanSteps s
                     WHERE s.plan_id = p.id
                 ) steps ON true
                 WHERE m.conversation_id = $1 AND m.deleted = FALSE
                 ORDER BY m.id DESC
                 LIMIT 20`,
                [conversationId]
            );
            return result.rows.reverse();
        } else {
            // Fetch 20 messages from lastMessage (inclusive), ordered ASC
            result = await query(
                `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                        m.message_type, m.metadata, m.created_at, m.plan_id,
                        p.plan_json, p.intent_type as plan_intent_type,
                        p.status as plan_status, p.needs_approval as plan_needs_approval,
                        p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                        p.rejection_reason as plan_rejection_reason,
                        COALESCE(steps.steps, '[]'::json) as plan_steps
                 FROM ChatMessages m
                 LEFT JOIN ChatPlans p ON p.id = COALESCE(m.plan_id, (m.metadata->>'planId')::int) AND p.deleted = FALSE
                 LEFT JOIN LATERAL (
                     SELECT json_agg(
                         json_build_object(
                             'id', s.id,
                             'step_number', s.step_number,
                             'description', s.description,
                             'api_path', s.api_path,
                             'api_method', s.api_method,
                             'status', s.status,
                             'error_message', s.error_message,
                             'duration_ms', s.duration_ms,
                             'api_request_json', s.api_request_json,
                             'api_response_json', s.api_response_json,
                             'created_at', s.created_at,
                             'updated_at', s.updated_at
                         ) ORDER BY s.step_number ASC
                     ) as steps
                     FROM ChatPlanSteps s
                     WHERE s.plan_id = p.id
                 ) steps ON true
                 WHERE m.conversation_id = $1 AND m.id < $2 AND m.deleted = FALSE
                 ORDER BY m.id DESC
                 LIMIT 20`,
                [conversationId, lastMessage]
            );
            return result.rows;
        }
    } catch (error) {
        console.error('Error fetching messages by conversationId and firstMessageId:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get recent messages by conversation ID (for conversation-based flow)
 * @param {number} conversationId - Conversation ID
 * @param {number} limit - Number of recent messages to fetch (default: 10)
 * @returns {Promise<Array>} List of recent messages ordered by created_at DESC
 */
export async function getRecentMessagesByConversationId(conversationId, limit = 10) {
    console.log(`[MessageDAO] Fetching ${limit} recent messages for conversationId=${conversationId}`);
    try {
        const result = await query(
            `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                    m.message_type, m.metadata, m.created_at, m.plan_id,
                    p.plan_json, p.intent_type as plan_intent_type,
                    p.status as plan_status, p.needs_approval as plan_needs_approval,
                    p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                    p.rejection_reason as plan_rejection_reason,
                    COALESCE(steps.steps, '[]'::json) as plan_steps
             FROM ChatMessages m
             LEFT JOIN ChatPlans p ON p.id = COALESCE(m.plan_id, (m.metadata->>'planId')::int) AND p.deleted = FALSE
             LEFT JOIN LATERAL (
                 SELECT json_agg(
                     json_build_object(
                         'id', s.id,
                         'step_number', s.step_number,
                         'description', s.description,
                         'api_path', s.api_path,
                         'api_method', s.api_method,
                         'status', s.status,
                         'error_message', s.error_message,
                         'duration_ms', s.duration_ms,
                         'api_request_json', s.api_request_json,
                         'api_response_json', s.api_response_json,
                         'created_at', s.created_at,
                         'updated_at', s.updated_at
                     ) ORDER BY s.step_number ASC
                 ) as steps
                 FROM ChatPlanSteps s
                 WHERE s.plan_id = p.id
             ) steps ON true
             WHERE m.conversation_id = $1 AND m.deleted = FALSE
             ORDER BY m.created_at DESC
             LIMIT $2`,
            [conversationId, limit]
        );
        
        console.log(`[MessageDAO] Found ${result.rows.length} messages for conversationId=${conversationId}`);
        return result.rows;
    } catch (error) {
        console.error('Error fetching recent messages by conversationId:', error);
        throw new Error(sanitizeDbError(error));
    }
}

import { query, formatTimestamp, sanitizeDbError } from '../../postgres.js';

/**
 * Get messages by session ID and starting message ID (inclusive)
 * @param {string} sessionId - Session ID
 * @param {number} firstMessageId - First message ID (inclusive)
 * @returns {Promise<Array>} List of messages
 */
export async function getMessagesBySessionIdFromId(sessionId, firstMessageId) {
    console.log(`[MessageDAO] Fetching messages for sessionId=${sessionId} from messageId=${firstMessageId}`);
    try {
        let result;
        if (firstMessageId === 0) {
            // Fetch latest 20 messages for this session, ordered DESC, then reverse to ASC
            result = await query(
                `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                        m.message_type, m.metadata, m.created_at, m.plan_id,
                        p.plan_json, p.intent_type as plan_intent_type,
                        p.status as plan_status, p.needs_approval as plan_needs_approval,
                        p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                        p.rejection_reason as plan_rejection_reason,
                        COALESCE(steps.steps, '[]'::json) as plan_steps
                 FROM ChatMessages m
                 JOIN ChatSessions s ON m.conversation_id = s.conversation_id
                 LEFT JOIN ChatPlans p ON m.plan_id = p.id AND p.deleted = FALSE
                 LEFT JOIN LATERAL (
                     SELECT json_agg(
                         json_build_object(
                             'id', st.id,
                             'step_number', st.step_number,
                             'description', st.description,
                             'api_path', st.api_path,
                             'api_method', st.api_method,
                             'status', st.status,
                             'error_message', st.error_message,
                             'duration_ms', st.duration_ms,
                             'api_request_json', st.api_request_json,
                             'api_response_json', st.api_response_json,
                             'created_at', st.created_at,
                             'updated_at', st.updated_at
                         ) ORDER BY st.step_number ASC
                     ) as steps
                     FROM ChatPlanSteps st
                     WHERE st.plan_id = p.id
                 ) steps ON true
                 WHERE s.id = $1 AND m.deleted = FALSE
                 ORDER BY m.id DESC
                 LIMIT 20`,
                [sessionId]
            );
            // Reverse to chronological order
            return result.rows.reverse();
        } else {
            // Fetch 20 messages from firstMessageId (inclusive), ordered ASC
            result = await query(
                `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                        m.message_type, m.metadata, m.created_at, m.plan_id,
                        p.plan_json, p.intent_type as plan_intent_type,
                        p.status as plan_status, p.needs_approval as plan_needs_approval,
                        p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                        p.rejection_reason as plan_rejection_reason,
                        COALESCE(steps.steps, '[]'::json) as plan_steps
                 FROM ChatMessages m
                 JOIN ChatSessions s ON m.conversation_id = s.conversation_id
                 LEFT JOIN ChatPlans p ON m.plan_id = p.id AND p.deleted = FALSE
                 LEFT JOIN LATERAL (
                     SELECT json_agg(
                         json_build_object(
                             'id', st.id,
                             'step_number', st.step_number,
                             'description', st.description,
                             'api_path', st.api_path,
                             'api_method', st.api_method,
                             'status', st.status,
                             'error_message', st.error_message,
                             'duration_ms', st.duration_ms,
                             'api_request_json', st.api_request_json,
                             'api_response_json', st.api_response_json,
                             'created_at', st.created_at,
                             'updated_at', st.updated_at
                         ) ORDER BY st.step_number ASC
                     ) as steps
                     FROM ChatPlanSteps st
                     WHERE st.plan_id = p.id
                 ) steps ON true
                 WHERE s.id = $1 AND m.id >= $2 AND m.deleted = FALSE
                 ORDER BY m.id ASC
                 LIMIT 20`,
                [sessionId, firstMessageId]
            );
            return result.rows;
        }
    } catch (error) {
        console.error('Error fetching messages by sessionId and firstMessageId:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Data Access Object for Chat Messages
 * Handles insertion and retrieval of chat messages
 */

/**
 * Insert a new chat message
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - Internal user ID
 * @param {string} customerUserId - External customer user ID (optional)
 * @param {string} role - Message role (user, assistant, system)
 * @param {string} content - Message content
 * @param {string} messageType - Type of message (text, plan, feedback, etc.)
 * @param {Object} metadata - Additional metadata (optional)
 * @returns {Promise<Object>} Created message
 */
export async function insertMessage({
    conversationId,
    userId,
    customerUserId,
    role,
    content,
    messageType,
    metadata,
}) {
    try {
        const result = await query(
            `INSERT INTO ChatMessages
             (conversation_id, user_id, customer_user_id, role, content, message_type, metadata, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             RETURNING id, conversation_id, user_id, customer_user_id, role, content, message_type, metadata, created_at`,
            [
                conversationId,
                userId,
                customerUserId || null,
                role,
                content,
                messageType || 'text',
                metadata ? JSON.stringify(metadata) : null,
                userId,
                userId,
            ]
        );
        
        if (global.io) {
            global.io.to(userId).emit('chat_update', { conversationId });
        }
        return result.rows[0];
    } catch (error) {
        console.error('Error inserting message:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get messages by conversation ID
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID for access control
 * @param {number} limit - Limit results (default 100)
 * @param {number} offset - Pagination offset (default 0)
 * @returns {Promise<Array>} List of messages
 */
export async function getMessagesByConversationId(conversationId, userId, limit = 100, offset = 0) {
    try {
        const result = await query(
            `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                    m.message_type, m.metadata, m.created_at, m.updated_at, m.plan_id,
                    p.plan_json, p.intent_type as plan_intent_type,
                    p.status as plan_status, p.needs_approval as plan_needs_approval,
                    p.approved_at as plan_approved_at, p.rejected_at as plan_rejected_at,
                    p.rejection_reason as plan_rejection_reason,
                    COALESCE(steps.steps, '[]'::json) as plan_steps
             FROM ChatMessages m
             JOIN Conversations c ON m.conversation_id = c.id
             LEFT JOIN ChatPlans p ON p.id = COALESCE(m.plan_id, (m.metadata->>'planId')::int) AND p.deleted = FALSE
             LEFT JOIN LATERAL (
                 SELECT json_agg(
                     json_build_object(
                         'id', st.id,
                         'step_number', st.step_number,
                         'description', st.description,
                         'api_path', st.api_path,
                         'api_method', st.api_method,
                         'status', st.status,
                         'error_message', st.error_message,
                         'duration_ms', st.duration_ms,
                         'api_request_json', st.api_request_json,
                         'api_response_json', st.api_response_json,
                         'created_at', st.created_at,
                         'updated_at', st.updated_at
                     ) ORDER BY st.step_number ASC
                 ) as steps
                 FROM ChatPlanSteps st
                 WHERE st.plan_id = p.id
             ) steps ON true
             WHERE m.conversation_id = $1 AND c.user_id = $2 AND m.deleted = FALSE
             ORDER BY m.created_at ASC
             LIMIT $3 OFFSET $4`,
            [conversationId, userId, limit, offset]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching messages:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get messages by customer user ID
 * @param {string} customerUserId - External customer user ID
 * @param {number} userId - Internal user ID
 * @param {number} limit - Limit results
 * @returns {Promise<Array>} List of messages
 */
export async function getMessagesByCustomerUserId(customerUserId, userId, limit = 100) {
    try {
        const result = await query(
            `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                    m.message_type, m.metadata, m.created_at
             FROM ChatMessages m
             JOIN Conversations c ON m.conversation_id = c.id
             WHERE m.customer_user_id = $1 AND c.user_id = $2 AND m.deleted = FALSE
             ORDER BY m.created_at DESC
             LIMIT $3`,
            [customerUserId, userId, limit]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching messages by customer user ID:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get message by ID
 * @param {number} messageId - Message ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<Object|null>} Message or null
 */
export async function getMessageById(messageId, userId) {
    try {
        const result = await query(
            `SELECT m.id, m.conversation_id, m.user_id, m.customer_user_id, m.role, m.content,
                    m.message_type, m.metadata, m.created_at, m.updated_at
             FROM ChatMessages m
             JOIN Conversations c ON m.conversation_id = c.id
             WHERE m.id = $1 AND c.user_id = $2 AND m.deleted = FALSE`,
            [messageId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching message:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Update message content
 * @param {number} messageId - Message ID
 * @param {number} userId - User ID for access control
 * @param {string} content - New content
 * @returns {Promise<Object|null>} Updated message
 */
export async function updateMessage(messageId, userId, content) {
    try {
        const result = await query(
            `UPDATE ChatMessages
             SET content = $1, updated_by = $2, updated_at = $3
             WHERE id = $4 AND user_id = $5 AND deleted = FALSE
             RETURNING id, conversation_id, role, content, updated_at`,
            [content, userId, formatTimestamp(), messageId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating message:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Soft delete message
 * @param {number} messageId - Message ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<boolean>} Success status
 */
export async function deleteMessage(messageId, userId) {
    try {
        const result = await query(
            `UPDATE ChatMessages
             SET deleted = TRUE, updated_by = $1, updated_at = $2
             WHERE id = $3 AND user_id = $4
             RETURNING id`,
            [userId, formatTimestamp(), messageId, userId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting message:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Count messages in a conversation
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<number>} Message count
 */
export async function countMessages(conversationId) {
    try {
        const result = await query(
            `SELECT COUNT(*) as count FROM ChatMessages
             WHERE conversation_id = $1 AND deleted = FALSE`,
            [conversationId]
        );
        return parseInt(result.rows[0].count) || 0;
    } catch (error) {
        console.error('Error counting messages:', error);
        throw new Error(sanitizeDbError(error));
    }
}
