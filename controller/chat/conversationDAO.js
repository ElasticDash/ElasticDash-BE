import { query, formatTimestamp, sanitizeDbError } from '../../postgres.js';

/**
 * Get all conversations for a user, ordered by updated_at desc
 * @param {number} userId
 * @returns {Promise<Array>}
 */
export async function getConversationsByUserId(userId) {
    try {
        const result = await query(
            `SELECT * FROM Conversations WHERE user_id = $1 AND deleted = FALSE ORDER BY updated_at DESC`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching conversations by user id:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Data Access Object for Conversations
 * Handles CRUD operations for chat conversations
 */

/**
 * Create a new conversation
 * @param {number} userId - Internal user ID from database
 * @param {string} customerUserId - External/third-party customer user ID (optional)
 * @param {string} title - Conversation title
 * @param {string} description - Conversation description
 * @returns {Promise<Object>} Created conversation with id
 */
export async function createConversation({ userId, customerUserId, title, description }) {
    try {
        const result = await query(
            `INSERT INTO Conversations (user_id, customer_user_id, title, description, created_by, updated_by)
             VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, user_id, customer_user_id, title, description, created_at, updated_at`,
            [userId, customerUserId || null, title || '', description || '', userId, userId]
        );
        return result.rows[0];
    } catch (error) {
        console.error('Error creating conversation:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get conversation by ID
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<Object|null>} Conversation or null
 */
export async function getConversationById(conversationId, userId) {
    try {
        const result = await query(
            `SELECT id, user_id, customer_user_id, title, description, deleted, created_at, updated_at
             FROM Conversations
             WHERE id = $1 AND user_id = $2 AND deleted = FALSE`,
            [conversationId, userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching conversation:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Get conversations by customer user ID
 * @param {string} customerUserId - External customer user ID
 * @param {number} userId - Internal user ID
 * @returns {Promise<Array>} List of conversations
 */
export async function getConversationsByCustomerUserId(customerUserId, userId) {
    try {
        const result = await query(
            `SELECT id, user_id, customer_user_id, title, description, created_at, updated_at
             FROM Conversations
             WHERE customer_user_id = $1 AND user_id = $2 AND deleted = FALSE
             ORDER BY created_at DESC`,
            [customerUserId, userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error fetching conversations by customer user ID:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * List all conversations for a user
 * @param {number} userId - User ID
 * @param {number} limit - Limit results
 * @param {number} offset - Pagination offset
 * @returns {Promise<Array>} List of conversations
 */
export async function listConversationsByUser(userId, limit = 50, offset = 0) {
    try {
        const result = await query(
            `SELECT id, user_id, customer_user_id, title, description, created_at, updated_at
             FROM Conversations
             WHERE user_id = $1 AND deleted = FALSE
             ORDER BY created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );
        return result.rows;
    } catch (error) {
        console.error('Error listing conversations:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Update conversation
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID for access control
 * @param {Object} updates - Fields to update (title, description)
 * @returns {Promise<Object|null>} Updated conversation
 */
export async function updateConversation(conversationId, userId, updates) {
    try {
        const allowedFields = ['title', 'description'];
        const setClause = [];
        const values = [];
        let paramIndex = 1;

        for (const field of allowedFields) {
            if (field in updates) {
                setClause.push(`${field} = $${paramIndex}`);
                values.push(updates[field]);
                paramIndex++;
            }
        }

        if (setClause.length === 0) return null;

        setClause.push(`updated_by = $${paramIndex}`);
        values.push(userId);
        paramIndex++;

        setClause.push(`updated_at = $${paramIndex}`);
        values.push(formatTimestamp());

        values.push(conversationId);
        values.push(userId);

        const result = await query(
            `UPDATE Conversations
             SET ${setClause.join(', ')}
             WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1} AND deleted = FALSE
             RETURNING id, user_id, customer_user_id, title, description, updated_at`,
            values
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error updating conversation:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Soft delete conversation (mark as deleted)
 * @param {number} conversationId - Conversation ID
 * @param {number} userId - User ID for access control
 * @returns {Promise<boolean>} Success status
 */
export async function deleteConversation(conversationId, userId) {
    try {
        const result = await query(
            `UPDATE Conversations
             SET deleted = TRUE, updated_by = $1, updated_at = $2
             WHERE id = $3 AND user_id = $4
             RETURNING id`,
            [userId, formatTimestamp(), conversationId, userId]
        );
        return result.rows.length > 0;
    } catch (error) {
        console.error('Error deleting conversation:', error);
        throw new Error(sanitizeDbError(error));
    }
}
