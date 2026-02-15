const { pool } = require('../../postgres');

/**
 * Add a Pokémon to the user's watchlist
 * @param {number} userId - The ID of the user
 * @param {number} pokemonId - The ID of the Pokémon
 */
async function addToWatchlist(userId, pokemonId) {
    // Check if the Pokémon is already in the user's watchlist
    const checkQuery = `SELECT * FROM UserPokemonWatchlist WHERE user_id = $1 AND pokemon_id = $2 AND deleted = FALSE;`;
    const checkValues = [userId, pokemonId];
    const checkResult = await pool.query(checkQuery, checkValues);

    if (checkResult.rows.length > 0) {
        // Return the existing record if found
        return checkResult.rows[0];
    }

    // Add the Pokémon to the watchlist if not already present
    const query = `INSERT INTO UserPokemonWatchlist (user_id, pokemon_id) VALUES ($1, $2) RETURNING *;`;
    const values = [userId, pokemonId];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Remove a Pokémon from the user's watchlist
 * @param {number} userId - The ID of the user
 * @param {number} itemId - The ID of the Watchlist item
 */
async function removeFromWatchlist(userId, itemId) {
    const query = `
        UPDATE UserPokemonWatchlist 
        SET deleted = TRUE 
        WHERE user_id = $1 
        AND pokemon_id = $2 
        AND deleted = FALSE
        RETURNING *;
    `;
    const values = [userId, itemId];
    const result = await pool.query(query, values);
    return result.rowCount ? result.rows[0] : 404;
}

/** * Remove all Pokémon from the user's watchlist
 * @param {number} userId - The ID of the user
 */
async function removeAllFromWatchlist(userId) {
    const query = `
        UPDATE UserPokemonWatchlist 
        SET deleted = TRUE 
        WHERE user_id = $1 
        AND deleted = FALSE
        RETURNING *;
    `;
    const values = [userId];
    const result = await pool.query(query, values);
    return result.rowCount ? result.rows : 404;
}

/**
 * Get the user's Pokémon watchlist
 * @param {number} userId - The ID of the user
 */
async function getWatchlist(userId) {
    const query = `
    SELECT wl.*, psn.name AS identifier, p.height, p.weight,
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
    FROM UserPokemonWatchlist wl, Pokemon p
    JOIN pokemon_species_names psn ON p.id = psn.pokemon_species_id
    WHERE psn.local_language_id = 9
    AND wl.user_id = $1 
    AND wl.pokemon_id = p.id
    AND wl.deleted = FALSE 
    ORDER BY wl.created_at ASC;`;
    const values = [userId];
    const result = await pool.query(query, values);
    const rows = result.rows.map(row => {
        return {
            ...row,
            types: row.types.map((type, index) => ({
                type,
                type_name: row.pokemon_type_names[index]
            })),
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${row.pokemon_id}.png`,
        }
    })
    return rows;
}

/**
 * Create a new Pokémon team
 * @param {number} userId - The ID of the user
 * @param {string} teamName - The name of the team
 */
async function createTeam(userId, teamName) {
    const query = `INSERT INTO UserPokemonTeams (user_id, team_name) VALUES ($1, $2) RETURNING *;`;
    const values = [userId, teamName];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Delete a Pokémon team
 * @param {number} teamId - The ID of the team
 */
async function deleteTeam(teamId) {
    const query = `UPDATE UserPokemonTeams SET deleted = TRUE WHERE id = $1 RETURNING *;`;
    const values = [teamId];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Delete all Pokémon teams for a user
 * @param {number} userId - The ID of the user
 */
async function deleteAllTeams(userId) {
    const query = `UPDATE UserPokemonTeams SET deleted = TRUE WHERE user_id = $1 RETURNING *;`;
    const values = [userId];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Get all teams for a user
 * @param {number} userId - The ID of the user
 */
async function getTeams(userId) {
    const query = `SELECT * FROM UserPokemonTeams WHERE user_id = $1 AND deleted = FALSE ORDER BY created_at ASC;`;
    const values = [userId];
    const result = await pool.query(query, values);
    return result.rows;
}

/**
 * Add a member to a Pokémon team
 * @param {number} teamId - The ID of the team
 * @param {number} pokemonId - The ID of the Pokémon
 * @param {string} nickname - The nickname of the Pokémon
 * @param {number} level - The level of the Pokémon
 * @param {number[]} moves - The moves of the Pokémon
 * @param {boolean} shiny - Whether the Pokémon is shiny
 */
async function addTeamMember(teamId, pokemonId, nickname = 'none', level = 50, moves = [], shiny = false, orderIndex = 0) {
    const query = `
    INSERT INTO UserPokemonTeamMembers 
    (team_id, pokemon_id, nickname, level, moves, shiny, order_index) 
    VALUES ($1, $2, $3, $4, $5, $6, $7) 
    RETURNING *;`;
    const values = [teamId, pokemonId, nickname, level, moves, shiny, orderIndex];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Remove a member from a Pokémon team
 * @param {number} memberId - The ID of the team member
 */
async function removeTeamMember(memberId) {
    const query = `UPDATE UserPokemonTeamMembers SET deleted = TRUE WHERE id = $1 RETURNING *;`;
    const values = [memberId];
    const result = await pool.query(query, values);
    return result.rows[0];
}

/**
 * Get all members of a Pokémon team
 * @param {number} teamId - The ID of the team
 */
async function getTeamMembers(teamId) {
    const query = `SELECT * FROM UserPokemonTeamMembers WHERE team_id = $1 AND deleted = FALSE;`;
    const values = [teamId];
    const result = await pool.query(query, values);
    return result.rows;
}

module.exports = {
    addToWatchlist,
    removeFromWatchlist,
    removeAllFromWatchlist,
    getWatchlist,
    createTeam,
    deleteTeam,
    getTeams,
    addTeamMember,
    removeTeamMember,
    getTeamMembers,
    deleteAllTeams
};