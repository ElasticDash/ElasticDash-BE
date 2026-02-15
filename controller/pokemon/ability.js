import { pool } from '../../postgres';

/**
 * Search Ability by ID or name with pagination
 * Supports searching across all languages, not just English.
 * @param {string|number} input - Ability ID (number) or name (string)
 * @param {number} page - Page number for pagination (default: 0)
 * @returns {Promise<object>} Paginated Ability data
 */
async function getAbility(input, page = 0) {
    const limit = 12;
    const offset = page * limit;

    let totalCountQuery = `
        SELECT COUNT(*) 
        FROM abilities a
        LEFT JOIN ability_names an ON a.id = an.ability_id AND an.local_language_id = 9
    `;
    let totalCountValues = [];
    let query = `
        SELECT 
            a.id,
            a.identifier,
            a.generation_id,
            an.name AS localized_name,
            an.local_language_id,
            ap.short_effect,
            ap.effect
        FROM 
            abilities a
        LEFT JOIN 
            ability_names an ON a.id = an.ability_id AND an.local_language_id = 9
        LEFT JOIN 
            ability_prose ap ON a.id = ap.ability_id AND ap.local_language_id = 9
    `;
    let values = [limit, offset];

    if (input) {
        totalCountQuery += ' WHERE a.id = $1 OR an.name ILIKE $2';
        totalCountValues = [!isNaN(input) ? input : null, `%${input}%`];
        query += ' WHERE a.id = $1 OR an.name ILIKE $2';
        values = [!isNaN(input) ? input : null, `%${input}%`, limit, offset];
        query += ' ORDER BY an.name ASC LIMIT $3 OFFSET $4';
    } else {
        query += ' ORDER BY an.name ASC LIMIT $1 OFFSET $2';
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
    getAbility
};