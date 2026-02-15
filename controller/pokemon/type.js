import { pool } from '../../postgres';

/**
 * Search Type by ID or name with pagination
 * Supports searching across all languages, not just English.
 * @param {string|number} input - Type ID (number) or name (string)
 * @param {number} page - Page number for pagination (default: 0)
 * @returns {Promise<object>} Paginated Type data
 */
async function getType(input, page = 0) {
    const limit = 9;
    const offset = page * limit;

    let totalCountQuery = `
        SELECT COUNT(*) 
        FROM types t
        LEFT JOIN pokemon_type_names ptn ON t.id = ptn.pokemon_type_id AND ptn.local_language_id = 9
    `;
    let totalCountValues = [];
    let query = `
        SELECT 
            t.id,
            t.identifier,
            t.generation_id,
            ptn.name AS localized_name,
            ptn.local_language_id
        FROM 
            types t
        LEFT JOIN 
            pokemon_type_names ptn ON t.id = ptn.pokemon_type_id AND ptn.local_language_id = 9
    `;
    let values = [limit, offset];

    if (input) {
        totalCountQuery += ' WHERE t.id = $1 OR ptn.name ILIKE $2';
        totalCountValues = [!isNaN(input) ? input : null, `%${input}%`];
        query += ' WHERE t.id = $1 OR ptn.name ILIKE $2';
        values = [!isNaN(input) ? input : null, `%${input}%`, limit, offset];
        query += ' ORDER BY ptn.name ASC LIMIT $3 OFFSET $4';
    } else {
        query += ' ORDER BY ptn.name ASC LIMIT $1 OFFSET $2';
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
    getType
};