import { pool } from '../../postgres';

/**
 * Search Berry by ID or name with pagination
 * If no input is provided, return all berries ordered by name (A to Z)
 * @param {string|number} input - Berry ID (number) or name (string)
 * @param {number} page - Page number for pagination (default: 0)
 * @returns {Promise<object>} Paginated Berry data
 */
async function getBerry(input, page = 0) {
    const limit = 9;
    const offset = page * limit;

    let totalCountQuery = 'SELECT COUNT(*) FROM berries';
    let totalCountValues = [];
    let query = 'SELECT * FROM berries';
    let values = [limit, offset];

    if (input) {
        totalCountQuery += ' WHERE id = $1 OR identifier LIKE $2';
        totalCountValues = [!isNaN(input) ? input : null, isNaN(input) ? `%${input}%` : null];
        query += ' WHERE id = $1 OR identifier LIKE $2';
        values = [!isNaN(input) ? input : null, isNaN(input) ? `%${input}%` : null, limit, offset];
        query += ' ORDER BY identifier ASC LIMIT $3 OFFSET $4';
    }
    else {
        query += ' ORDER BY identifier ASC LIMIT $1 OFFSET $2';
    }

    const totalCountResult = await pool.query(totalCountQuery, totalCountValues);
    const totalCount = parseInt(totalCountResult.rows[0].count);
    const totalPage = Math.ceil(totalCount / limit);

    const result = await pool.query(query, values);

    return {
        results: result.rows,
        totalCount,
        totalPage
    };
}

module.exports = {
    getBerry
};