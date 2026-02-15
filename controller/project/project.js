import { pool } from '../../postgres';
import { snake2Camel } from '../general/tools';
import { v4 as uuidv4 } from 'uuid';
import { createSecret, updateSecret } from '../general/secret';
import path from 'path';

// ==================== RAG PROJECTS ====================

// Create a new RAG project
export const createProject = async (projectName, uniqueKey, description, myId) => {
    console.log('createProject is triggered');
    
    // Compute default rag path using uniqueKey
    const ragPath = pathJoinRagPath(uniqueKey);

    const query = `
        INSERT INTO RagProjects (project_name, user_id, unique_key, description, rag_path, status, created_by, updated_by)
        VALUES ($1, $2, $3, $4, $5, 1, $6, $7)
        RETURNING *;
    `;
    const values = [projectName, myId, uniqueKey, description, ragPath, myId, myId];

    try {
        const result = await pool.query(query, values);
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error creating project:', error);
        return 500;
    }
};

// Helper to build rag path under rags/ directory
function pathJoinRagPath(uniqueKey) {
    const fname = `${uniqueKey || 'project'}.json`;
    const ragsDir = path.join(process.cwd(), '../rags');
    return path.join(ragsDir, fname);
}

// Get all projects for a user
export const getProjects = async (myId) => {
    console.log('getProjects is triggered');

    const query = `
        SELECT * FROM RagProjects
        WHERE user_id = $1 AND deleted = FALSE
        ORDER BY created_at DESC;
    `;
    const values = [myId];

    try {
        const result = await pool.query(query, values);
        return snake2Camel(result.rows);
    } catch (error) {
        console.error('Error fetching projects:', error);
        return 500;
    }
};

// Get a single project by ID
export const getProjectById = async (projectId, myId) => {
    console.log('getProjectById is triggered');

    const query = `
        SELECT * FROM RagProjects
        WHERE id = $1 AND user_id = $2 AND deleted = FALSE;
    `;
    const values = [projectId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Project not found' };
        }
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error fetching project:', error);
        return 500;
    }
};

// Update a project
export const updateProject = async (projectId, projectName, description, status, myId) => {
    console.log('updateProject is triggered');

    const query = `
        UPDATE RagProjects
        SET project_name = $1, description = $2, status = $3, updated_at = NOW(), updated_by = $4
        WHERE id = $5 AND user_id = $6 AND deleted = FALSE
        RETURNING *;
    `;
    const values = [projectName, description, status, myId, projectId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Project not found or unauthorized' };
        }
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error updating project:', error);
        return 500;
    }
};

// Delete a project
export const deleteProject = async (projectId, myId) => {
    console.log('deleteProject is triggered');

    const query = `
        UPDATE RagProjects
        SET deleted = TRUE, updated_at = NOW(), updated_by = $1
        WHERE id = $2 AND user_id = $3 AND deleted = FALSE;
    `;
    const values = [myId, projectId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Project not found or unauthorized' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error deleting project:', error);
        return 500;
    }
};

// NOTE: API CRUD operations moved to staging controller
// Use uploadOpenApi and KB versioning endpoints via staging.js for draft/active KB management

// ==================== RAG DATABASES ====================

// Create a new database
export const createDatabase = async (projectId, dbType, connectionString, myId) => {
    console.log('createDatabase is triggered');

    try {
        // Generate unique secret name
        const secretName = `elasticdash/rag/db/${uuidv4()}`;
        
        // Store connection string in AWS Secrets Manager
        const secretResponse = await createSecret(secretName, connectionString);
        
        if (!secretResponse) {
            return { success: false, message: 'Failed to store secret in AWS Secrets Manager' };
        }
        
        // Use secret name as the secret_id
        const secretId = secretName;
        
        const query = `
            INSERT INTO RagKnowledgeBaseDatabases (project_id, db_type, secret_id, status, created_by, updated_by)
            VALUES ($1, $2, $3, 1, $4, $5)
            RETURNING *;
        `;
        const values = [projectId, dbType, secretId, myId, myId];

        const result = await pool.query(query, values);
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error creating database:', error);
        return 500;
    }
};

// Get all databases for a project
export const getDatabases = async (projectId, myId) => {
    console.log('getDatabases is triggered');

    const query = `
        SELECT rd.* FROM RagKnowledgeBaseDatabases rd
        JOIN RagProjects rp ON rd.project_id = rp.id
        WHERE rd.project_id = $1 AND rp.user_id = $2 AND rd.deleted = FALSE
        ORDER BY rd.created_at DESC;
    `;
    const values = [projectId, myId];

    try {
        const result = await pool.query(query, values);
        return snake2Camel(result.rows);
    } catch (error) {
        console.error('Error fetching databases:', error);
        return 500;
    }
};

// Update a database
export const updateDatabase = async (databaseId, dbType, connectionString, status, myId) => {
    console.log('updateDatabase is triggered');

    try {
        // Get the existing database record to retrieve current secret_id
        const getQuery = `
            SELECT rd.secret_id FROM RagKnowledgeBaseDatabases rd
            JOIN RagProjects rp ON rd.project_id = rp.id
            WHERE rd.id = $1 AND rp.user_id = $2 AND rd.deleted = FALSE
        `;
        const getResult = await pool.query(getQuery, [databaseId, myId]);
        
        if (getResult.rowCount === 0) {
            return { success: false, message: 'Database not found or unauthorized' };
        }
        
        let secretId = getResult.rows[0].secret_id;
        
        // If connectionString is provided, update the secret in AWS
        if (connectionString) {
            const secretUpdateResponse = await updateSecret(secretId, connectionString);
            if (!secretUpdateResponse) {
                return { success: false, message: 'Failed to update secret in AWS Secrets Manager' };
            }
        }
        
        // Update database record
        const query = `
            UPDATE RagKnowledgeBaseDatabases rd
            SET db_type = $1, status = $2, updated_at = NOW(), updated_by = $3
            FROM RagProjects rp
            WHERE rd.id = $4 AND rd.project_id = rp.id AND rp.user_id = $5 AND rd.deleted = FALSE
            RETURNING rd.*;
        `;
        const values = [dbType, status, myId, databaseId, myId];

        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Database not found or unauthorized' };
        }
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error updating database:', error);
        return 500;
    }
};

// Delete a database
export const deleteDatabase = async (databaseId, myId) => {
    console.log('deleteDatabase is triggered');

    const query = `
        UPDATE RagKnowledgeBaseDatabases rd
        SET deleted = TRUE, updated_at = NOW(), updated_by = $1
        FROM RagProjects rp
        WHERE rd.id = $2 AND rd.project_id = rp.id AND rp.user_id = $3 AND rd.deleted = FALSE;
    `;
    const values = [myId, databaseId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Database not found or unauthorized' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error deleting database:', error);
        return 500;
    }
};

// NOTE: Table CRUD operations moved to staging controller
// Use uploadSqlDdl, listDraftTables, listActiveTables, updateDraftTable, etc. via staging.js for KB versioning

// ==================== RAG PROJECT ACCESS TOKENS ====================

// Create a new access token
export const createAccessToken = async (projectId, sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate, myId) => {
    console.log('createAccessToken is triggered');

    try {
        // Generate unique secret name for token
        const secretName = `elasticdash/rag/token/${uuidv4()}`;
        
        // Store token value in AWS Secrets Manager
        const secretResponse = await createSecret(secretName, tokenValue);
        
        if (!secretResponse) {
            return { success: false, message: 'Failed to store token in AWS Secrets Manager' };
        }
        
        // Use secret name as the source_value_default (reference to AWS Secrets Manager)
        const secretId = secretName;
        
        const query = `
            INSERT INTO RagProjectAccessTokens (project_id, source_type, source_key, source_value_default, header_key, header_value_template, status, created_by, updated_by)
            SELECT $1, $2, $3, $4, $5, $6, 1, $7, $8
            FROM RagProjects rp
            WHERE rp.id = $1 AND rp.user_id = $7
            RETURNING *;
        `;
        const values = [projectId, sourceType, sourceKey, secretId, headerKey, headerValueTemplate, myId, myId];

        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Project not found or unauthorized' };
        }
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error creating access token:', error);
        return 500;
    }
};

// Get all access tokens for a project
export const getAccessTokens = async (projectId, myId) => {
    console.log('getAccessTokens is triggered');

    const query = `
        SELECT rpat.* FROM RagProjectAccessTokens rpat
        JOIN RagProjects rp ON rpat.project_id = rp.id
        WHERE rpat.project_id = $1 AND rp.user_id = $2 AND rpat.deleted = FALSE
        ORDER BY rpat.created_at DESC;
    `;
    const values = [projectId, myId];

    try {
        const result = await pool.query(query, values);
        return snake2Camel(result.rows);
    } catch (error) {
        console.error('Error fetching access tokens:', error);
        return 500;
    }
};

// Update an access token
export const updateAccessToken = async (tokenId, sourceType, sourceKey, tokenValue, headerKey, headerValueTemplate, status, myId) => {
    console.log('updateAccessToken is triggered');

    try {
        // Get the existing token record to retrieve current secret reference
        const getQuery = `
            SELECT rpat.source_value_default FROM RagProjectAccessTokens rpat
            JOIN RagProjects rp ON rpat.project_id = rp.id
            WHERE rpat.id = $1 AND rp.user_id = $2 AND rpat.deleted = FALSE
        `;
        const getResult = await pool.query(getQuery, [tokenId, myId]);
        
        if (getResult.rowCount === 0) {
            return { success: false, message: 'Access token not found or unauthorized' };
        }
        
        let secretId = getResult.rows[0].source_value_default;
        
        // If tokenValue is provided, update the secret in AWS
        if (tokenValue) {
            const secretUpdateResponse = await updateSecret(secretId, tokenValue);
            if (!secretUpdateResponse) {
                return { success: false, message: 'Failed to update token in AWS Secrets Manager' };
            }
        }
        
        const query = `
            UPDATE RagProjectAccessTokens rpat
            SET source_type = $1, source_key = $2, header_key = $3, header_value_template = $4, status = $5, updated_at = NOW(), updated_by = $6
            FROM RagProjects rp
            WHERE rpat.id = $7 AND rpat.project_id = rp.id AND rp.user_id = $8 AND rpat.deleted = FALSE
            RETURNING rpat.*;
        `;
        const values = [sourceType, sourceKey, headerKey, headerValueTemplate, status, myId, tokenId, myId];

        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Access token not found or unauthorized' };
        }
        return snake2Camel(result.rows[0]);
    } catch (error) {
        console.error('Error updating access token:', error);
        return 500;
    }
};

// Delete an access token
export const deleteAccessToken = async (tokenId, myId) => {
    console.log('deleteAccessToken is triggered');

    const query = `
        UPDATE RagProjectAccessTokens rpat
        SET deleted = TRUE, updated_at = NOW(), updated_by = $1
        FROM RagProjects rp
        WHERE rpat.id = $2 AND rpat.project_id = rp.id AND rp.user_id = $3 AND rpat.deleted = FALSE;
    `;
    const values = [myId, tokenId, myId];

    try {
        const result = await pool.query(query, values);
        if (result.rowCount === 0) {
            return { success: false, message: 'Access token not found or unauthorized' };
        }
        return { success: true };
    } catch (error) {
        console.error('Error deleting access token:', error);
        return 500;
    }
};
