import { pool } from '../../postgres';

/**
 * Search Pokémon by ID or name with pagination
 * If no input is provided, return all Pokémon ordered by name (A to Z)
 * Supports sorting by various criteria using the `sortby` parameter.
 * @param {string|number} input - Pokémon ID (number) or name (string)
 * @param {object} filters - Optional filters for height, weight, types, moves, and stats
 * @param {number} page - Page number for pagination (default: 0)
 * @param {number} sortby - Sorting option (default: 0)
 * @returns {Promise<object>} Paginated Pokémon data
 */
async function getPokemon(input = '', filters = {}, page = 0, sortby = 0) {
    console.log('getPokemon called with input:', input, 'page:', page, 'filters:', filters, 'sortby:', sortby);
    const limit = 9;
    const offset = page * limit;

    const {
        height = { min: 0, max: -1 },
        weight = { min: 0, max: -1 },
        mustHaveTypes = [],
        mustNotHaveTypes = [],
        canLearnMoves = [],
        stats = []
    } = filters;

    let totalCountQuery = `
        SELECT COUNT(*) 
        FROM pokemon p
        JOIN pokemon_species_names psn ON p.id = psn.pokemon_species_id
        WHERE psn.local_language_id = 9
    `;
    let totalCountValues = [];
    let query = `
        SELECT p.id, psn.name AS identifier, p.height, p.weight,
        (SELECT SUM(base_stat) FROM pokemon_stats WHERE pokemon_id = p.id) AS total_stats,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 1) AS hp,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 2) AS attack,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 3) AS defense,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 4) AS special_attack,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 5) AS special_defense,
        (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 6) AS speed,
        ARRAY(
            SELECT t.identifier
            FROM pokemon_types pt
            JOIN types t ON pt.type_id = t.id
            WHERE pt.pokemon_id = p.id
        ) AS types
        FROM pokemon p
        JOIN pokemon_species_names psn ON p.id = psn.pokemon_species_id
        WHERE psn.local_language_id = 9
    `;
    let values = [limit, offset];

    // Apply input filter for name or ID
    if (input) {
        const indexCount = totalCountValues.length + 1;
        const index = values.length + 1;
        if (!isNaN(input)) {
            totalCountQuery += ` AND p.id = $${indexCount}`;
            query += ` AND p.id = $${index}`;
            totalCountValues.push(input);
            values.push(input);
        } else {
            totalCountQuery += ` AND psn.name ILIKE $${indexCount}`;
            query += ` AND psn.name ILIKE $${index}`;
            totalCountValues.push(`%${input}%`);
            values.push(`%${input}%`);
        }
    }

    // Apply filters
    if (height.min > 0 || height.max !== undefined) {
        const indexCount1 = totalCountValues.length + 1;
        if (height.max < 0) {
            totalCountQuery += ` AND p.height > $${indexCount1}`;
            query += ` AND p.height > $${values.length + 1}`;
            totalCountValues.push(height.min);
            values.push(height.min);
        } else {
            const indexCount2 = indexCount1 + 1;
            const index1 = values.length + 1;
            const index2 = index1 + 1;
            totalCountQuery += ` AND p.height BETWEEN $${indexCount1} AND $${indexCount2}`;
            query += ` AND p.height BETWEEN $${index1} AND $${index2}`;
            totalCountValues.push(height.min, height.max);
            values.push(height.min, height.max);
        }
    }

    if (weight.min > 0 || weight.max !== undefined) {
        const indexCount1 = totalCountValues.length + 1;
        if (weight.max < 0) {
            totalCountQuery += ` AND p.weight > $${indexCount1}`;
            query += ` AND p.weight > $${values.length + 1}`;
            totalCountValues.push(weight.min);
            values.push(weight.min);
        } else {
            const indexCount2 = indexCount1 + 1;
            const index1 = values.length + 1;
            const index2 = index1 + 1;
            totalCountQuery += ` AND p.weight BETWEEN $${indexCount1} AND $${indexCount2}`;
            query += ` AND p.weight BETWEEN $${index1} AND $${index2}`;
            totalCountValues.push(weight.min, weight.max);
            values.push(weight.min, weight.max);
        }
    }

    if (mustHaveTypes.length > 0) {
        const indexCount = totalCountValues.length + 1;
        const index = values.length + 1;
        totalCountQuery += ` AND EXISTS (
            SELECT 1 FROM pokemon_types pt
            WHERE pt.pokemon_id = p.id AND pt.type_id = ANY($${indexCount})
        )`;
        query += ` AND EXISTS (
            SELECT 1 FROM pokemon_types pt
            WHERE pt.pokemon_id = p.id AND pt.type_id = ANY($${index})
        )`;
        totalCountValues.push(mustHaveTypes);
        values.push(mustHaveTypes);
    }

    if (mustNotHaveTypes.length > 0) {
        const indexCount = totalCountValues.length + 1;
        const index = values.length + 1;
        totalCountQuery += ` AND NOT EXISTS (
            SELECT 1 FROM pokemon_types pt
            WHERE pt.pokemon_id = p.id AND pt.type_id = ANY($${indexCount})
        )`;
        query += ` AND NOT EXISTS (
            SELECT 1 FROM pokemon_types pt
            WHERE pt.pokemon_id = p.id AND pt.type_id = ANY($${index})
        )`;
        totalCountValues.push(mustNotHaveTypes);
        values.push(mustNotHaveTypes);
    }

    if (canLearnMoves.length > 0) {
        canLearnMoves.forEach((move, idx) => {
            const moveIndex = totalCountValues.length + 1;
            const methodIndex = moveIndex + 1;
            const moveValueIndex = values.length + 1;
            const methodValueIndex = moveValueIndex + 1;

            if (move.moveMethodId) {
                totalCountQuery += ` AND EXISTS (
                    SELECT 1 FROM pokemon_moves pm
                    WHERE pm.pokemon_id = p.id AND pm.move_id = $${moveIndex} AND pm.move_method_id = $${methodIndex}
                )`;
                query += ` AND EXISTS (
                    SELECT 1 FROM pokemon_moves pm
                    WHERE pm.pokemon_id = p.id AND pm.move_id = $${moveValueIndex} AND pm.move_method_id = $${methodValueIndex}
                )`;
                totalCountValues.push(move.moveId, move.moveMethodId);
                values.push(move.moveId, move.moveMethodId);
            } else {
                totalCountQuery += ` AND EXISTS (
                    SELECT 1 FROM pokemon_moves pm
                    WHERE pm.pokemon_id = p.id AND pm.move_id = $${moveIndex}
                )`;
                query += ` AND EXISTS (
                    SELECT 1 FROM pokemon_moves pm
                    WHERE pm.pokemon_id = p.id AND pm.move_id = $${moveValueIndex}
                )`;
                totalCountValues.push(move.moveId);
                values.push(move.moveId);
            }
        });
    }

    stats.forEach((statFilter) => {
        if (statFilter.min > 0 || statFilter.max !== undefined) {
            const indexCount = totalCountValues.length + 1;
            const index = values.length + 1;
            if (statFilter.max < 0) {
                totalCountQuery += ` AND EXISTS (
                    SELECT 1 FROM pokemon_stats ps
                    WHERE ps.pokemon_id = p.id 
                    AND ps.stat_id = $${indexCount} 
                    AND ps.base_stat > $${indexCount + 1}
                )`;
                query += ` AND EXISTS (
                    SELECT 1 FROM pokemon_stats ps
                    WHERE ps.pokemon_id = p.id 
                    AND ps.stat_id = $${index} 
                    AND ps.base_stat > $${index + 1}
                )`;
                totalCountValues.push(statFilter.statId, statFilter.min);
                values.push(statFilter.statId, statFilter.min);
            } else {
                totalCountQuery += ` AND EXISTS (
                    SELECT 1 FROM pokemon_stats ps
                    WHERE ps.pokemon_id = p.id 
                    AND ps.stat_id = $${indexCount} 
                    AND ps.base_stat BETWEEN $${indexCount + 1} 
                    AND $${indexCount + 2}
                )`;
                query += ` AND EXISTS (
                    SELECT 1 FROM pokemon_stats ps
                    WHERE ps.pokemon_id = p.id 
                    AND ps.stat_id = $${index} 
                    AND ps.base_stat BETWEEN $${index + 1} 
                    AND $${index + 2}
                )`;
                totalCountValues.push(statFilter.statId, statFilter.min, statFilter.max);
                values.push(statFilter.statId, statFilter.min, statFilter.max);
            }
        }
    });

    // Apply sorting based on `sortby`
    const sortOptions = {
        0: 'psn.name ASC',
        1: 'psn.name DESC',
        2: 'total_stats DESC',
        3: 'total_stats ASC',
        4: 'hp DESC',
        5: 'hp ASC',
        6: 'attack DESC',
        7: 'attack ASC',
        8: 'defense DESC',
        9: 'defense ASC',
        10: 'special_attack DESC',
        11: 'special_attack ASC',
        12: 'special_defense DESC',
        13: 'special_defense ASC',
        14: 'speed DESC',
        15: 'speed ASC',
        16: 'p.height DESC',
        17: 'p.height ASC',
        18: 'p.weight DESC',
        19: 'p.weight ASC'
    };

    const orderBy = sortOptions[sortby] || sortOptions[0];
    query += ` ORDER BY ${orderBy} LIMIT $1 OFFSET $2`;

    const totalCountResult = await pool.query(totalCountQuery, totalCountValues)
    .catch(err => {
        console.error('Total count query failed, error: ', err);
        console.error('totalCountQuery: ', totalCountQuery);
        console.error('totalCountValues: ', totalCountValues);
        throw 500;
    });
    const totalCount = parseInt(totalCountResult.rows[0].count);
    const totalPage = Math.ceil(totalCount / limit);

    const result = await pool.query(query, values)
    .catch(err => {
        console.error('Query failed, error: ', err);
        console.error('query: ', query);
        console.error('values: ', values);
        throw 500;
    });

    const results = result.rows.map(pokemon => ({
        ...pokemon,
        sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`
    }));

    return {
        results,
        totalCount,
        totalPage
    };
}

// API to get Pokémon details
async function getPokemonDetails(pokemonId) {
    console.log('getPokemonDetails called with id:', pokemonId);

    try {
        // Query to get Pokémon details, excluding abilities and moves
        const pokemonQuery = `
            SELECT 
                p.*, 
                psn.name AS species_name, 
                psf.flavor_text,
                (SELECT SUM(base_stat) FROM pokemon_stats WHERE pokemon_id = p.id) AS total_stats,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 1) AS hp,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 2) AS attack,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 3) AS defense,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 4) AS special_attack,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 5) AS special_defense,
                (SELECT base_stat FROM pokemon_stats WHERE pokemon_id = p.id AND stat_id = 6) AS speed,
                ARRAY(
                    SELECT t.identifier
                    FROM pokemon_types pt
                    JOIN types t ON pt.type_id = t.id
                    WHERE pt.pokemon_id = p.id
                ) AS types,
                ARRAY(
                    SELECT tn.name
                    FROM pokemon_types pt
                    JOIN types t ON pt.type_id = t.id
                    JOIN pokemon_type_names tn ON t.id = tn.pokemon_type_id
                    WHERE pt.pokemon_id = p.id AND tn.local_language_id = 9
                ) AS pokemon_type_names
            FROM pokemon p
            JOIN pokemon_species ps ON p.species_id = ps.id
            JOIN pokemon_species_names psn ON ps.id = psn.pokemon_species_id
            JOIN pokemon_species_flavor_text psf ON ps.id = psf.pokemon_species_id
            WHERE p.id = $1 AND psn.local_language_id = 9 AND psf.local_language_id = 9
        `;

        const { rows } = await pool.query(pokemonQuery, [pokemonId]);

        if (rows.length === 0) {
            return null; // Pokémon not found
        }

        const pokemon = rows[0];

        // Separate query to fetch unique abilities
        const abilitiesQuery = `
            SELECT DISTINCT
                a.identifier AS ability,
                an.name AS ability_name,
                ap.short_effect
            FROM pokemon_abilities pa
            JOIN abilities a ON pa.ability_id = a.id
            LEFT JOIN ability_prose ap ON a.id = ap.ability_id AND ap.local_language_id = 9
            LEFT JOIN ability_names an ON a.id = an.ability_id AND an.local_language_id = 9
            WHERE pa.pokemon_id = $1
        `;

        const abilitiesResult = await pool.query(abilitiesQuery, [pokemonId]);
        const abilities = abilitiesResult.rows.map(row => ({
            ability: row.ability,
            ability_name: row.ability_name,
            short_effect: row.short_effect
        }));

        // Separate query to fetch moves with move methods
        const movesQuery = `
            SELECT DISTINCT ON (m.id, pmm.id, pm.level)
                m.identifier AS move,
                m.type_id,
                m.power,
                m.accuracy,
                m.pp,
                m.priority,
                mn.name,
                pmm.identifier AS move_method, -- level-up / tutor / machine
                pm.level,
                ptn.name AS type
            FROM pokemon_moves pm
            JOIN moves m ON pm.move_id = m.id
            LEFT JOIN move_names mn ON m.id = mn.move_id AND mn.local_language_id = 9
            LEFT JOIN pokemon_move_methods pmm ON pm.move_method_id = pmm.id
            LEFT JOIN pokemon_types pt ON m.type_id = pt.type_id AND pt.pokemon_id = pm.pokemon_id
            LEFT JOIN pokemon_type_names ptn ON pt.type_id = ptn.pokemon_type_id AND ptn.local_language_id = 9
            WHERE pm.pokemon_id = $1
            ORDER BY m.id, pmm.id, pm.level
        `;

        const movesResult = await pool.query(movesQuery, [pokemonId]);
        const moves = movesResult.rows
        .sort((a, b) => {
            // Sort by move method, then by level
            if (a.move_method === b.move_method) {
                return (a.level || 0) - (b.level || 0);
            }
            return a.move_method.localeCompare(b.move_method);
        });

        // Construct the response object
        const pokemonDetails = {
            name: pokemon.species_name,
            types: pokemon.types.map((type, index) => ({
                type,
                type_name: pokemon.pokemon_type_names[index]
            })),
            abilities,
            moves,
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`,
            ...pokemon
        };

        return pokemonDetails;
    } catch (error) {
        console.error('Error fetching Pokémon details:', error);
        throw error;
    }
};

/**
 * Retrieve moves that a Pokémon can learn with sorting, filtering, and pagination options.
 * @param {number} pokemonId - The ID of the Pokémon.
 * @param {object} options - Sorting, filtering, and pagination options.
 * @param {number} [options.typeId=null] - Filter by move type ID.
 * @param {number} [options.learnMethodId=1] - Filter by learn method ID (default: level-up).
 * @param {number} [options.sortBy=0] - Sorting option (default: level low to high).
 * @param {number} [options.page=0] - Page number for pagination (default: 0).
 * @returns {Promise<object>} Paginated list of moves that the Pokémon can learn, including total pages.
 */
async function getPokemonMoves(pokemonId, options = {}) {
    console.log('getPokemonMoves called with id:', pokemonId, 'options:', options);

    const {
        typeId = null,
        learnMethodId = 1,
        sortBy = 0,
        page = 0
    } = options;

    const limit = 9;
    const offset = page * limit;

    const sortOptions = {
        0: 'pm.level ASC',
        1: 'pm.level DESC',
        2: 'm.power ASC',
        3: 'm.power DESC',
        4: 'm.pp ASC',
        5: 'm.pp DESC',
        6: 'mn.name ASC',
        7: 'mn.name DESC'
    };

    const orderBy = sortOptions[sortBy] || sortOptions[0];

    let countQuery = `
        SELECT COUNT(*) AS total_count
        FROM pokemon_moves pm
        JOIN moves m ON pm.move_id = m.id
        WHERE pm.pokemon_id = $1
    `;

    let movesQuery = `
        SELECT DISTINCT ON (m.id, pmm.id, pm.level)
            m.identifier AS move,
            m.type_id,
            m.power,
            m.accuracy,
            m.pp,
            m.priority,
            mn.name,
            pmm.identifier AS move_method, -- level-up / tutor / machine
            pm.level,
            t.identifier AS type_name
        FROM pokemon_moves pm
        JOIN moves m ON pm.move_id = m.id
        LEFT JOIN move_names mn ON m.id = mn.move_id AND mn.local_language_id = 9
        LEFT JOIN pokemon_move_methods pmm ON pm.move_method_id = pmm.id
        LEFT JOIN types t ON m.type_id = t.id
        WHERE pm.pokemon_id = $1
    `;

    const countValues = [pokemonId];
    const movesValues = [pokemonId];

    if (typeId) {
        const index = countValues.length + 1;
        const indexCount = movesValues.length + 1;
        countQuery += ` AND m.type_id = $${index}`;
        movesQuery += ` AND m.type_id = $${indexCount}`;
        countValues.push(typeId);
        movesValues.push(typeId);
    }
    if (learnMethodId) {
        const index = countValues.length + 1;
        const indexCount = movesValues.length + 1;
        countQuery += ` AND pm.move_method_id = $${index}`;
        movesQuery += ` AND pm.move_method_id = $${indexCount}`;
        countValues.push(learnMethodId);
        movesValues.push(learnMethodId);
    }
    movesQuery += ` ORDER BY ${orderBy} LIMIT $${movesValues.length + 1} OFFSET $${movesValues.length + 2}`;
    movesValues.push(limit, offset);

    try {
        const countResult = await pool.query(countQuery, countValues);
        const totalCount = parseInt(countResult.rows[0].total_count, 10);
        const totalPages = Math.ceil(totalCount / limit);

        const movesResult = await pool.query(movesQuery, movesValues);

        return {
            results: movesResult.rows,
            page,
            limit,
            totalPages
        };
    } catch (error) {
        console.error('Error fetching Pokémon moves:', error);
        throw error;
    }
}

module.exports = {
    getPokemon,
    getPokemonDetails,
    getPokemonMoves
};