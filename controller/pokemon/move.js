import { pool } from '../../postgres';

/**
 * Search Move by ID or name with pagination
 * If no input is provided, return all moves ordered by name (A to Z)
 * Supports searching across all languages, not just English.
 * @param {string|number} input - Move ID (number) or name (string)
 * @param {number} page - Page number for pagination (default: 0)
 * @param {object} filters - Filters to apply on the move search
 * @param {number} order - Order option for sorting the results
 * @returns {Promise<object>} Paginated Move data
 */
async function getMove(input, page = 0, filters = {}, order = 0) {
    const limit = 12;
    const offset = page * limit;

    let totalCountQuery = `
        SELECT COUNT(*) 
        FROM moves m
        LEFT JOIN move_names mn ON m.id = mn.move_id AND mn.local_language_id = 9
    `;
    let totalCountValues = [];
    let query = `
        SELECT 
            m.id,
            m.identifier,
            m.generation_id,
            m.type_id,
            t.identifier AS type_name,
            m.power,
            m.pp,
            m.accuracy,
            m.priority,
            m.target_id,
            m.damage_class_id,
            dc.identifier AS damage_class_name,
            m.effect_id,
            m.effect_chance,
            m.contest_type_id,
            m.contest_effect_id,
            m.super_contest_effect_id,
            mn.name AS localized_name,
            mn.local_language_id
        FROM 
            moves m
        LEFT JOIN 
            types t ON m.type_id = t.id
        LEFT JOIN 
            move_damage_classes dc ON m.damage_class_id = dc.id
        LEFT JOIN 
            move_names mn ON m.id = mn.move_id AND mn.local_language_id = 9
    `;
    let values = [limit, offset];

    // Apply filters
    const filterConditions = [];
    const filterConditionsCount = [];
    if (input) {
        const index = values.length + 1;
        const indexCount = totalCountValues.length + 1;
        filterConditions.push(`(m.id = $${index} OR mn.name ILIKE $${index + 1})`);
        filterConditionsCount.push(`(m.id = $${indexCount} OR mn.name ILIKE $${indexCount + 1})`);
        totalCountValues.push(!isNaN(input) ? input : null, `%${input}%`);
        values.push(!isNaN(input) ? input : null, `%${input}%`);
    }
    if (filters.type) {
        const index = values.length + 1;
        const indexCount = totalCountValues.length + 1;
        filterConditions.push(`m.type_id = $${index}`);
        filterConditionsCount.push(`m.type_id = $${indexCount}`);
        totalCountValues.push(filters.type);
        values.push(filters.type);
    }
    if (filters.power) {
        if (filters.power.min !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.power >= $${index}`);
            filterConditionsCount.push(`m.power >= $${indexCount}`);
            totalCountValues.push(filters.power.min);
            values.push(filters.power.min);
        }
        if (filters.power.max !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.power <= $${index}`);
            filterConditionsCount.push(`m.power <= $${indexCount}`);
            totalCountValues.push(filters.power.max);
            values.push(filters.power.max);
        }
    }
    if (filters.pp) {
        if (filters.pp.min !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.pp >= $${index}`);
            filterConditionsCount.push(`m.pp >= $${indexCount}`);
            totalCountValues.push(filters.pp.min);
            values.push(filters.pp.min);
        }
        if (filters.pp.max !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.pp <= $${index}`);
            filterConditionsCount.push(`m.pp <= $${indexCount}`);
            totalCountValues.push(filters.pp.max);
            values.push(filters.pp.max);
        }
    }
    if (filters.damageClass) {
        const index = values.length + 1;
        const indexCount = totalCountValues.length + 1;
        filterConditions.push(`m.damage_class_id = $${index}`);
        filterConditionsCount.push(`m.damage_class_id = $${indexCount}`);
        totalCountValues.push(filters.damageClass);
        values.push(filters.damageClass);
    }
    if (filters.priority) {
        if (filters.priority.min !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.priority >= $${index}`);
            filterConditionsCount.push(`m.priority >= $${indexCount}`);
            totalCountValues.push(filters.priority.min);
            values.push(filters.priority.min);
        }
        if (filters.priority.max !== undefined) {
            const index = values.length + 1;
            const indexCount = totalCountValues.length + 1;
            filterConditions.push(`m.priority <= $${index}`);
            filterConditionsCount.push(`m.priority <= $${indexCount}`);
            totalCountValues.push(filters.priority.max);
            values.push(filters.priority.max);
        }
    }

    if (filterConditions.length > 0) {
        const filterClause = filterConditions.join(' AND ');
        query += ` WHERE ${filterClause}`;
        const filterClauseCount = filterConditionsCount.join(' AND ');
        totalCountQuery += ` WHERE ${filterClauseCount}`;
    }

    // Apply ordering
    const orderOptions = [
        'mn.name ASC', // A-Z
        'mn.name DESC', // Z-A
        'm.power DESC', // Power high-low
        'm.power ASC', // Power low-high
        'm.pp DESC', // PP high-low
        'm.pp ASC', // PP low-high
        'm.accuracy DESC', // Accuracy high-low
        'm.accuracy ASC' // Accuracy low-high
    ];
    const orderClause = orderOptions[order] || orderOptions[0];
    query += ` ORDER BY ${orderClause} LIMIT $1 OFFSET $2`;

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
    getMove
};