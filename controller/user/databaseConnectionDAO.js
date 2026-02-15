import { query, sanitizeDbError } from '../../postgres.js';

/**
 * Get the database connection for a user
 * @param {number} userId
 * @returns {Promise<Object|null>}
 */
export async function getDatabaseConnectionByUserId(userId) {
    try {
        const result = await query(
            `SELECT * FROM DatabaseConnections WHERE user_id = $1 LIMIT 1`,
            [userId]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error fetching database connection:', error);
        throw new Error(sanitizeDbError(error));
    }
}

/**
 * Upsert (insert or update) the database connection for a user
 * @param {number} userId
 * @param {string} connectionString
 * @returns {Promise<Object>}
 */
export async function upsertDatabaseConnectionByUserId(userId, connectionString) {
    try {
        // Try update first
        const updateResult = await query(
            `UPDATE DatabaseConnections SET
                connection_string = $2,
                updated_at = NOW()
             WHERE user_id = $1
             AND deleted = FALSE
             RETURNING *`,
            [userId, connectionString]
        );
        if (updateResult.rows.length > 0) {
            return updateResult.rows[0];
        }
        // If not found, insert
        const insertResult = await query(
            `INSERT INTO DatabaseConnections (user_id, connection_string, created_at, updated_at)
             VALUES ($1, $2, NOW(), NOW())
             RETURNING *`,
            [userId, connectionString]
        );
        return insertResult.rows[0];
    } catch (error) {
        console.error('Error upserting database connection:', error);
        throw new Error(sanitizeDbError(error));
    }
}
