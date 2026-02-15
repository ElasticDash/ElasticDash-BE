import { pool } from '../../postgres';

export async function getApiBaseUrl(userId) {
    const query = `
        SELECT api_base_url
        FROM TestProjects
        WHERE user_id = $1 AND deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
    `;
    const values = [userId];
    return pool.query(query, values).then(result => {
        if (result.rows.length > 0) {
            return result.rows[0].api_base_url || '';
        } else {
            return '';
        }
    }).catch(error => {
        console.error('Error fetching API base URL:', error);
        return '';
    });
}

export async function updateApiBaseUrl(userId, newBaseUrl) {
    const query = `
        UPDATE TestProjects
        SET api_base_url = $1, updated_at = NOW()
        WHERE user_id = $2 AND deleted = FALSE
        RETURNING api_base_url
    `;
    const values = [newBaseUrl, userId];
    return pool.query(query, values).then(result => {
        if (result.rows.length > 0) {
            return result.rows[0].api_base_url;
        } else {
            return null;
        }
    }).catch(error => {
        console.error('Error updating API base URL:', error);
        return null;
    });
}

export async function getOauthToken(userId) {
    const query = `
        SELECT oauth_token
        FROM TestProjects
        WHERE user_id = $1 AND deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1
    `;
    const values = [userId];
    return pool.query(query, values).then(result => {
        if (result.rows.length > 0) {
            return result.rows[0].oauth_token || '';
        } else {
            return '';
        }
    }).catch(error => {
        console.error('Error fetching OAuth token:', error);
        return '';
    });
}

export async function updateOauthToken(userId, newOauthToken) {
    const query = `
        UPDATE TestProjects
        SET oauth_token = $1, updated_at = NOW()
        WHERE user_id = $2 AND deleted = FALSE
        RETURNING oauth_token
    `;
    const values = [newOauthToken, userId];
    return pool.query(query, values).then(result => {
        if (result.rows.length > 0) {
            return result.rows[0].oauth_token;
        } else {
            return null;
        }
    }).catch(error => {
        console.error('Error updating OAuth token:', error);
        return null;
    });
}

// Fetch llm_token (secret id) and llm_provider_id for the latest TestProject of a user
export async function getLlmConfig(userId) {
    const query = `
        SELECT tpl.llm_token, tpl.llm_provider_id
        FROM TestProjectLlms tpl, TestProjects tp
        WHERE tp.user_id = $1 
        AND tp.deleted = FALSE 
        AND tpl.project_id = tp.id
        ORDER BY tp.created_at DESC
    `;
    const values = [userId];
    try {
        const result = await pool.query(query, values);
        if (result.rows.length > 0) {
            return result.rows;
        } else {
            return null;
        }
    } catch (error) {
        console.error('Error fetching LLM config:', error);
        return null;
    }
}

// Update llm_token (secret id) and llm_provider_id for the latest TestProject of a user
// Update llm_token (secret id) and llm_provider_id for the latest TestProject of a user using SupportedAiModels table
export async function updateLlmConfig(userId, { llmToken, llmProviderId }) {
    // Only update the latest (most recently created) TestProject for the user
    const selectProjectQuery = `
        SELECT id FROM TestProjects WHERE user_id = $1 AND deleted = FALSE ORDER BY created_at DESC LIMIT 1
    `;
    const selectProjectValues = [userId];
    try {
        const projectResult = await pool.query(selectProjectQuery, selectProjectValues);
        if (projectResult.rows.length === 0) return null;
        const projectId = projectResult.rows[0].id;

        // Check if TestProjectLlms exists for this project
        const checkQuery = `
            SELECT id FROM TestProjectLlms WHERE project_id = $1 AND llm_provider_id = $2 AND deleted = FALSE LIMIT 1
        `;
        const checkValues = [projectId, llmProviderId];
        const checkResult = await pool.query(checkQuery, checkValues);

        if (checkResult.rows.length > 0) {
            // Update existing row
            const updateQuery = `
                UPDATE TestProjectLlms
                SET llm_token = $1, updated_at = NOW()
                WHERE project_id = $3 AND llm_provider_id = $2 AND deleted = FALSE
                RETURNING *
            `;
            const updateValues = [llmToken, llmProviderId, projectId];
            const updateResult = await pool.query(updateQuery, updateValues);
            if (updateResult.rows.length > 0) {
                return updateResult.rows[0];
            } else {
                return null;
            }
        } else {
            // Insert new row
            const insertQuery = `
                INSERT INTO TestProjectLlms (project_id, llm_token, llm_provider_id, created_at, updated_at)
                VALUES ($1, $2, $3, NOW(), NOW())
                RETURNING *
            `;
            const insertValues = [projectId, llmToken, llmProviderId];
            const insertResult = await pool.query(insertQuery, insertValues);
            if (insertResult.rows.length > 0) {
                return insertResult.rows[0];
            } else {
                return null;
            }
        }
    } catch (error) {
        console.error('Error updating LLM config:', error);
        return null;
    }
}
