import { query, sanitizeDbError, formatTimestamp } from '../../postgres.js';
import { insertMessage } from './messageDAO.js';

/**
 * Update feedback status (e.g. to 'withdrawn')
 * @param {number} feedbackId
 * @param {string} status
 * @returns {Promise<boolean>} Success status
 */
export async function updateFeedbackStatus(feedbackId, status) {
    try {
        const result = await query(
            `UPDATE ChatFeedback SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
            [feedbackId, status]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error updating feedback status:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get feedback detail: feedback, relevant message, 3 before and 3 after
 * @param {number} feedbackId
 * @returns {Promise<Object>} Feedback detail with message context
 */
export async function getFeedbackDetail(feedbackId) {
    try {
        // Get the feedback entry (to get message_id and conversation_id)
        const feedbackRes = await query(
            `SELECT * FROM ChatFeedback WHERE id = $1`,
            [feedbackId]
        );
        if (!feedbackRes.rows.length) return null;
        const feedback = feedbackRes.rows[0];
        // Get the relevant message and 3 before/after in the same conversation
        const messagesRes = await query(
            `SELECT * FROM ChatMessages
             WHERE conversation_id = $1
             ORDER BY created_at ASC, id ASC`,
            [feedback.conversation_id]
        );
        const idx = messagesRes.rows.findIndex(m => m.id === feedback.message_id);
        const contextMessages = messagesRes.rows.slice(Math.max(0, idx - 3), idx + 4);
        return {
            feedback,
            messages: contextMessages
        };
    } catch (error) {
        console.error('Error fetching feedback detail:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Data Access Object for Chat Feedback
 * Handles user feedback (likes/dislikes) on chat messages
 */

/**
 * Create or update feedback on a message
 * @param {number} messageId - Message ID
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID providing feedback
 * @param {string} feedbackType - Type of feedback (like, dislike, etc.)
 * @param {boolean} isHelpful - Whether message was helpful (optional)
 * @returns {Promise<Object>} Created/updated feedback
 */
export async function upsertFeedback({
    messageId,
    conversationId,
    userId,
    feedbackType,
    isHelpful,
    description,
    expectedResponse,
}) {
    try {
        const result = await query(
            `INSERT INTO ChatFeedback 
             (message_id, conversation_id, user_id, feedback_type, is_helpful, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (message_id, user_id) 
             DO UPDATE SET 
                feedback_type = $4,
                is_helpful = $5,
                updated_by = $6,
                updated_at = CURRENT_TIMESTAMP
             RETURNING id, message_id, conversation_id, user_id, feedback_type, is_helpful, created_at`,
            [messageId, conversationId, userId, feedbackType, isHelpful, userId, userId]
        );

        const clearReasonsResult = await query(
            `UPDATE ChatFeedbackReasons 
            SET deleted = true, updated_at = CURRENT_TIMESTAMP, updated_by = $2 
            WHERE feedback_id = $1 AND deleted = FALSE
            RETURNING id`,
            [result.rows[0].id, userId]
        );
        console.log(`Cleared ${clearReasonsResult.rowCount} feedback reasons for feedback ID:`, result.rows[0].id);

        if (!isHelpful && (description || expectedResponse)) {
            console.log('Adding feedback reason for feedback ID:', result.rows[0].id);
            // Add reason if provided
            await addFeedbackReason({
                feedbackId: result.rows[0].id,
                reasonCategory: 'user_feedback',
                description,
                expectedResponse,
                userId,
            })
            .catch(err => {
                console.error('Failed to add feedback reason:', err);
                throw err;
            });
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error creating/updating feedback:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get all feedbacks for a user, optionally filtered by is_helpful
 * @param {number} userId - User ID
 * @param {boolean|null} isHelpful - Optional filter for is_helpful
 * @returns {Promise<Array>} List of feedbacks (id, feedback_type, is_helpful, status, message_id, conversation_id, created_at)
 */
export async function getFeedbacksByUser(userId, isHelpful = null) {
    try {
        let sql = `SELECT cf.id, cf.message_id, cf.conversation_id, cf.feedback_type, 
        cf.is_helpful, cf.status, cf.created_at, cf.updated_at, cfr.reason_category, cfr.description,
        cfr.expected_response
        FROM ChatFeedback cf
        LEFT JOIN ChatFeedbackReasons cfr ON cf.id = cfr.feedback_id AND cfr.deleted = FALSE
        WHERE cf.user_id = $1`;
        const params = [userId];
        if (isHelpful !== null) {
            sql += ' AND cf.is_helpful = $2';
            params.push(isHelpful);
        }
        sql += ' ORDER BY cf.created_at DESC';
        const result = await query(sql, params);
        // Add a status field (e.g. 'active') for each feedback
        return result.rows.map(row => ({
            ...row,
            status: row.status || 'active',
        }));
    } catch (error) {
        console.error('Error fetching feedbacks by user:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get feedback for a message
 * @param {number} messageId - Message ID
 * @returns {Promise<Array>} List of feedback entries
 */
export async function getFeedbackByMessage(messageId) {
    try {
        const result = await query(
            `WITH LatestFeedback AS (
                SELECT id, message_id, user_id, feedback_type, is_helpful, created_at, updated_at,
                       ROW_NUMBER() OVER (PARTITION BY message_id ORDER BY created_at DESC) as rn
                FROM ChatFeedback
                WHERE message_id = $1
            )
            SELECT * FROM LatestFeedback WHERE rn = 1`,
            [messageId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching feedback by message:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get feedback for a conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<Array>} List of feedback entries
 */
export async function getFeedbackByConversation(conversationId, userId) {
    try {
        const result = await query(
            `SELECT f.id, f.message_id, f.conversation_id, f.user_id, 
                    f.feedback_type, f.is_helpful, f.created_at
             FROM ChatFeedback f
             JOIN Conversations c ON f.conversation_id = c.id
             WHERE f.conversation_id = $1 AND c.user_id = $2
             ORDER BY f.created_at DESC`,
            [conversationId, userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching feedback by conversation:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get user's feedback on a specific message
 * @param {number} messageId - Message ID
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Feedback or null
 */
export async function getUserFeedbackOnMessage(messageId, userId) {
    try {
        const result = await query(
            `SELECT id, message_id, feedback_type, is_helpful, created_at, updated_at
             FROM ChatFeedback
             WHERE message_id = $1 AND user_id = $2`,
            [messageId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching user feedback:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get feedback statistics for a conversation
 * @param {number} conversationId - Conversation ID
 * @returns {Promise<Object>} Feedback statistics
 */
export async function getFeedbackStats(conversationId) {
    try {
        const result = await query(
            `SELECT 
                COUNT(*) as total_feedback,
                COUNT(CASE WHEN is_helpful = TRUE THEN 1 END) as helpful_count,
                COUNT(CASE WHEN is_helpful = FALSE THEN 1 END) as unhelpful_count,
                COUNT(DISTINCT feedback_type) as feedback_types
             FROM ChatFeedback
             WHERE conversation_id = $1`,
            [conversationId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error fetching feedback stats:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Delete feedback
 * @param {number} feedbackId - Feedback ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<boolean>} Success status
 */
export async function deleteFeedback(feedbackId, userId) {
    try {
        const result = await query(
            `DELETE FROM ChatFeedback
             WHERE id = $1 AND user_id = $2
             RETURNING id`,
            [feedbackId, userId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting feedback:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get all feedback reasons for a feedback entry
 * @param {number} feedbackId - Feedback ID
 * @returns {Promise<Array>} List of feedback reasons
 */
export async function getFeedbackReasons(feedbackId) {
    try {
        const result = await query(
            `SELECT id, feedback_id, reason_category, description, created_at
             FROM ChatFeedbackReasons
             WHERE feedback_id = $1
             AND deleted = FALSE
             ORDER BY created_at ASC`,
            [feedbackId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching feedback reasons:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Add reason to feedback entry
 * @param {number} feedbackId - Feedback ID
 * @param {string} reasonCategory - Category of reason
 * @param {string} description - Detailed description (optional)
 * @param {string} expectedResponse - Expected response (optional)
 * @param {number} userId - User ID (optional, for tracking)
 * @returns {Promise<Object>} Created reason
 */
export async function addFeedbackReason({
    feedbackId,
    reasonCategory,
    description,
    expectedResponse,
    userId,
}) {
    try {
        // First, get the feedback entry to find the conversation_id and message_id
        const feedbackResult = await query(
            `SELECT feedback_id, conversation_id, message_id FROM ChatFeedback WHERE id = $1`,
            [feedbackId]
        );

        if (!feedbackResult.rows.length) {
            throw new Error(`Feedback with id ${feedbackId} not found`);
        }

        const { conversation_id, message_id } = feedbackResult.rows[0];

        // Create the feedback reason
        const reasonResult = await query(
            `INSERT INTO ChatFeedbackReasons 
             (feedback_id, reason_category, description, expected_response, created_by)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, feedback_id, reason_category, description, expected_response, created_at`,
            [feedbackId, reasonCategory, description || null, expectedResponse || null, userId || null]
        );

        const feedbackReason = reasonResult.rows[0];

        // Create a corresponding message in the conversation with feedback reason details
        const feedbackMessage = `Feedback Reason: ${reasonCategory}${description ? ` - ${description}` : ''}${expectedResponse ? ` (Expected: ${expectedResponse})` : ''}`;
        
        // Get the plan associated with the message (if any) to link it in the feedback message
        let planMetadata = {};
        const planResult = await query(
            `SELECT p.id, p.plan_json FROM ChatMessages m
             LEFT JOIN ChatPlans p ON m.conversation_id = p.conversation_id 
                                   AND p.deleted = FALSE
             WHERE m.id = $1 AND m.conversation_id = $2
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [message_id, conversation_id]
        );

        if (planResult.rows.length > 0 && planResult.rows[0].id) {
            planMetadata = {
                feedbackReasonId: feedbackReason.id,
                feedbackId: feedbackId,
                messageId: message_id,
                planId: planResult.rows[0].id,
                reasonCategory: reasonCategory,
            };
        } else {
            planMetadata = {
                feedbackReasonId: feedbackReason.id,
                feedbackId: feedbackId,
                messageId: message_id,
                reasonCategory: reasonCategory,
            };
        }

        // Insert the feedback message
        await insertMessage({
            conversationId: conversation_id,
            userId: userId,
            customerUserId: null,
            role: 'system',
            content: feedbackMessage,
            messageType: 'feedback',
            metadata: planMetadata,
        });

        console.log(`Created feedback reason (ID: ${feedbackReason.id}) and corresponding message in conversation ${conversation_id}`);

        return feedbackReason;
    } catch (error) {
        console.error('Error adding feedback reason:', error);
        throw new Error(sanitizeDbError(error));
    }
}
