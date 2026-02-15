import { pool } from '../../postgres';
import fs from 'fs';
import path from 'path';
import { snake2Camel, camel2Snake } from '../general/tools';
import { sendRequestToClaudeAI } from '../general/aihandler';
import { createProject } from './project';

// List draft APIs for a project

export const listDraftApis = async (projectId, myId) => {
    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    console.log('projectId: ', projectId);
    const query = `SELECT * FROM RagKnowledgeBaseApis WHERE project_id = $1 AND kb_version = 'draft' AND deleted = FALSE ORDER BY created_at DESC;`;
    const { rows } = await pool.query(query, [projectId]);
    return rows.map(snake2Camel);
};

// List active APIs for a project
export const listActiveApis = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query = `SELECT * FROM RagKnowledgeBaseApis WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE ORDER BY created_at DESC;`;
    const { rows } = await pool.query(query, [projectId]);
    return rows.map(snake2Camel);
};

// Get single draft API
export const getDraftApi = async (apiId, myId) => {
    const query = `SELECT * FROM RagKnowledgeBaseApis WHERE id = $1 AND kb_version = 'draft' AND deleted = FALSE;`;
    const { rows } = await pool.query(query, [apiId]);
    if (!rows.length) return { success: false, message: 'Not found' };
    return snake2Camel(rows[0]);
};

// Create draft API (user edits)
export const createDraftApi = async (projectId, apiData, myId) => {
    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }

    const query = `
        INSERT INTO RagKnowledgeBaseApis
            (project_id, api_path, api_method, description, tags, kb_version, openapi_operation, submission_status, created_by, updated_by)
        VALUES
            ($1, $2, $3, $4, $5, 'draft', $6, 'editing', $7, $8)
        RETURNING *;
    `;

    const values = [
        projectId,
        apiData.apiPath,
        apiData.apiMethod,
        apiData.description || null,
        apiData.tags || [],
        JSON.stringify(apiData.openapiOperation || {}),
        myId,
        myId
    ];

    const { rows } = await pool.query(query, values)
    .catch(err => {
        console.error('Error creating draft API:', err);
        throw err;
    });

    return snake2Camel(rows[0]);
};

// Update draft API (user edits)
export const updateDraftApi = async (apiId, updates, myId) => {
    // Convert camelCase keys to snake_case
    const snakeUpdates = camel2Snake(updates);
    
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(snakeUpdates)) {
        if (k === 'kb_version' || k === 'ready_for_rag') continue; // protect system fields
        fields.push(`${k} = $${idx++}`);
        values.push(['openapi_operation'].includes(k) ? JSON.stringify(v) : v);
    }
    if (fields.length === 0) return { success: false, message: 'No valid fields to update' };
    values.push(myId);
    values.push(apiId);

    const query = `
        UPDATE RagKnowledgeBaseApis SET ${fields.join(', ')}, updated_at = NOW(), updated_by = $${idx++}
        WHERE id = $${idx} AND kb_version = 'draft' AND deleted = FALSE RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    if (!rows.length) return { success: false, message: 'Update failed' };
    return snake2Camel(rows[0]);
};

export const deleteDraftApi = async (apiId, myId) => {
    console.log('deleteDraftApi is triggered');
    console.log('apiId: ', apiId);
    console.log('myId: ', myId);

    const query = `
        UPDATE RagKnowledgeBaseApis
        SET deleted = TRUE, api_path = api_path || '_deleted_' || id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT, updated_at = NOW(), updated_by = $2
        WHERE id = $1
        AND created_by = $2
        AND kb_version = 'draft' 
        AND deleted = FALSE
        RETURNING id;
    `;

    const values = [apiId, myId];

    try {
        const result = await pool.query(query, values)
        .catch(err => {
            console.error('Error deleting draft API:', err);
            throw err;
        });

        if (result.rowCount === 0) {
            throw new Error('API not found or not authorized to delete.');
        }

        return result.rows[0];
    }
    catch (error) {
        console.error('Error in deleteDraftApi:', error);
        throw error;
    }
};

// =============== Helpers ===============

export function fetchOrCreateLatestProject(myId) {
    const fetchQuery = `
        SELECT id FROM RagProjects
        WHERE user_id = $1 AND deleted = FALSE
        ORDER BY created_at DESC
        LIMIT 1;
    `;
    
    const fetchValues = [myId];

    return pool.query(fetchQuery, fetchValues)
        .then(result => {
            if (result.rows.length > 0) {
                return snake2Camel(result.rows[0]);
            } else {
                return createProject('Default Project', `user_${myId}_${Date.now()}`, 'My first project', myId);
            }
        })
        .catch(error => {
            console.error('Error fetching or creating project:', error);
            throw error;
        })
}

function parseSqlDdl(ddlText) {
    const results = [];
    if (!ddlText || typeof ddlText !== 'string') return results;

    // Split by CREATE TABLE statements (Postgres-style)
    const createBlocks = ddlText
        .replace(/\n+/g, '\n')
        .split(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?/i)
        .filter(block => block.trim().length);

    for (const block of createBlocks) {
        // Extract table name and body
        const match = block.match(/([\w\."]+)\s*\(([\s\S]*?)\)\s*;/);
        if (!match) continue;
        let tableName = match[1].replace(/"/g, '');
        const body = match[2];

        const columns = [];
        const pkColumns = [];
        const fkRelations = [];

        // Split body by commas but keep constraints lines
        const lines = body.split(/,(?![^()]*\))/).map(l => l.trim()).filter(Boolean);

        for (const line of lines) {
            // Table-level primary key
            const pkMatch = line.match(/PRIMARY\s+KEY\s*\(([^\)]+)\)/i);
            if (pkMatch) {
                const cols = pkMatch[1].split(',').map(s => s.trim().replace(/"/g, ''));
                pkColumns.push(...cols);
                continue;
            }
            // Table-level foreign key
            const fkMatch = line.match(/FOREIGN\s+KEY\s*\(([^\)]+)\)\s+REFERENCES\s+([\w\."]+)\s*\(([^\)]+)\)/i);
            if (fkMatch) {
                const cols = fkMatch[1].split(',').map(s => s.trim().replace(/"/g, ''));
                const refTable = fkMatch[2].replace(/"/g, '');
                const refCols = fkMatch[3].split(',').map(s => s.trim().replace(/"/g, ''));
                for (let i = 0; i < cols.length; i++) {
                    fkRelations.push({ column: cols[i], refTable, refColumn: refCols[i] || refCols[0] });
                }
                continue;
            }
            // Column definition line
            const colMatch = line.match(/^"?([a-zA-Z_][\w]*)"?\s+([a-zA-Z_][\w]*(?:\([^\)]*\))?)([\s\S]*)$/);
            if (colMatch) {
                const name = colMatch[1];
                const type = colMatch[2];
                const rest = colMatch[3] || '';
                const isNullable = !/NOT\s+NULL/i.test(rest);
                const isPkInline = /PRIMARY\s+KEY/i.test(rest);
                const isFkInline = /REFERENCES\s+([\w\."]+)\s*\(([^\)]+)\)/i.test(rest);
                
                if (isPkInline) pkColumns.push(name);
                
                // Categorize column: 'Primary Key', 'Foreign Key', or 'Others'
                let category = 'Others';
                if (isPkInline) {
                    category = 'Primary Key';
                } else if (isFkInline) {
                    category = 'Foreign Key';
                }
                
                columns.push({ name, type, category, nullable: isNullable });
                
                // Inline foreign key (rare in Postgres DDL)
                const inlineFk = rest.match(/REFERENCES\s+([\w\."]+)\s*\(([^\)]+)\)/i);
                if (inlineFk) {
                    fkRelations.push({ column: name, refTable: inlineFk[1].replace(/"/g, ''), refColumn: inlineFk[2].replace(/"/g, '') });
                }
            }
        }

        results.push({ tableName, columns, pkColumns, fkRelations });
    }

    return results;
}

async function upsertDraftTable(projectId, databaseId, table, userId) {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    
    // Validate database_id exists if provided, otherwise set to null
    let validDatabaseId = null;
    if (databaseId) {
        const dbCheck = await pool.query(
            'SELECT id FROM RagKnowledgeBaseDatabases WHERE id = $1 AND deleted = FALSE',
            [databaseId]
        );
        if (dbCheck.rows.length > 0) {
            validDatabaseId = databaseId;
        }
    }
    
    const query = `
        INSERT INTO RagKnowledgeBaseTables 
            (project_id, database_id, table_name, tags, description, kb_version, schema_source, schema_json, pk_columns, fk_relations, submission_status, created_by, updated_by)
        VALUES 
            ($1, $2, $3, $4, $5, 'draft', 'ddl', $6, $7, $8, 'editing', $9, $10)
        ON CONFLICT (project_id, table_name, kb_version, deleted) 
        WHERE deleted = FALSE
        DO UPDATE SET 
            tags = EXCLUDED.tags,
            description = EXCLUDED.description,
            schema_json = EXCLUDED.schema_json,
            pk_columns = EXCLUDED.pk_columns,
            fk_relations = EXCLUDED.fk_relations,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        RETURNING *;
    `;
    const tags = table.tags || [];
    const description = table.description || null;
    const values = [projectId, validDatabaseId, table.tableName, tags, description, JSON.stringify({ columns: table.columns }), table.pkColumns, JSON.stringify(table.fkRelations), userId, userId];
    const result = await pool.query(query, values);
    return snake2Camel(result.rows[0]);
}

async function upsertDraftApi(projectId, apiPath, method, operation, userId) {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    
    // Extract tags and description from operation
    const tags = operation.tags || [];
    const description = operation.summary || null;
    
    const query = `
        INSERT INTO RagKnowledgeBaseApis 
            (project_id, api_path, api_method, description, tags, kb_version, openapi_operation, submission_status, created_by, updated_by)
        VALUES 
            ($1, $2, $3, $4, $5, 'draft', $6, 'editing', $7, $8)
        ON CONFLICT (project_id, api_path, api_method, kb_version, deleted) 
        WHERE deleted = FALSE
        DO UPDATE SET 
            description = EXCLUDED.description,
            tags = EXCLUDED.tags,
            openapi_operation = EXCLUDED.openapi_operation,
            updated_at = NOW(),
            updated_by = EXCLUDED.updated_by
        RETURNING *;
    `;
    const values = [projectId, apiPath, method, description, tags, JSON.stringify(operation), userId, userId];
    const result = await pool.query(query, values);
    return snake2Camel(result.rows[0]);
}

function buildGenerationPrompt(tableName, schemaJson, pkColumns, fkRelations) {
    const promptPath = path.join(__dirname, '..', '..', 'src', 'prompt_sql_table_description.md');
    const template = fs.readFileSync(promptPath, 'utf-8');
    const schema = JSON.stringify({ tableName, schema: schemaJson, pkColumns, fkRelations }, null, 2);
    const userContent = `Generate description for table using the format.\nSchema:\n${schema}`;
    return { system: template, user: userContent };
}

// Generate description and tags for a table based on schema
async function generateTableDescriptionAndTags(tableName, columns, pkColumns, fkRelations) {
    try {
        const systemMsg = 'You are a database schema analyst. Generate a brief, professional description and 3-5 relevant tags for the given table.';
        const schemaStr = JSON.stringify({ tableName, columns, pkColumns, fkRelations }, null, 2);
        const userMsg = `Generate a brief description (one sentence) and 3-5 tags for this table:\n${schemaStr}\n\nRespond in JSON format: { "description": "...", "tags": ["tag1", "tag2", ...] }`;
        const messages = [{ role: 'user', content: userMsg }];
        const response = await sendRequestToClaudeAI(messages, systemMsg);
        const text = response?.content?.[0]?.text || response?.content || '';
        const jsonMatch = text.match(/\{[^{}]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return { description: parsed.description || null, tags: parsed.tags || [] };
        }
        return { description: null, tags: [] };
    } catch (err) {
        console.error('Error generating table description and tags:', err);
        return { description: null, tags: [] };
    }
}

// Generate description and tags for an API based on operation details
async function generateApiDescriptionAndTags(apiPath, apiMethod, operationDetails) {
    try {
        const systemMsg = 'You are an API documentation specialist. Generate a brief, professional description and 3-5 relevant tags for the given API endpoint.';
        const operationStr = JSON.stringify(operationDetails, null, 2);
        const userMsg = `Generate a brief description (one sentence) and 3-5 tags for this API endpoint:\nPath: ${apiPath}\nMethod: ${apiMethod}\nDetails:\n${operationStr}\n\nRespond in JSON format: { "description": "...", "tags": ["tag1", "tag2", ...] }`;
        const messages = [{ role: 'user', content: userMsg }];
        
        console.log(`    - Calling LLM for ${apiMethod} ${apiPath}...`);
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('LLM request timeout after 30s')), 30000)
        );
        
        const response = await Promise.race([
            sendRequestToClaudeAI(messages, systemMsg),
            timeoutPromise
        ]);
        
        const text = response?.content?.[0]?.text || response?.content || '';
        const jsonMatch = text.match(/\{[^{}]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            console.log(`    - LLM response: "${parsed.description}"`);
            return { description: parsed.description || null, tags: parsed.tags || [] };
        }
        return { description: null, tags: [] };
    } catch (err) {
        console.error(`Error generating API description and tags for ${apiMethod} ${apiPath}:`, err.message);
        // Return fallback values instead of failing
        return { 
            description: `${apiMethod} ${apiPath}`, 
            tags: [apiMethod.toLowerCase(), 'api'] 
        };
    }
}

// =============== Controllers ===============

// Upload OpenAPI doc → parse and upsert draft APIs (only mentioned endpoints)
export const uploadOpenApi = async (projectId, openapiJson, myId) => {
    console.log('DEBUG uploadOpenApi - Received openapiJson:', openapiJson);
    console.log('DEBUG uploadOpenApi - openapiJson type:', typeof openapiJson);
    console.log('DEBUG uploadOpenApi - openapiJson is null?:', openapiJson === null);
    console.log('DEBUG uploadOpenApi - openapiJson is undefined?:', openapiJson === undefined);
    console.log('DEBUG uploadOpenApi - openapiJson is array?:', Array.isArray(openapiJson));
    if (openapiJson) {
        console.log('DEBUG uploadOpenApi - openapiJson stringified:', JSON.stringify(openapiJson, null, 2));
    }

    // Validate OpenAPI document structure
    if (!openapiJson || typeof openapiJson !== 'object') {
        console.log('DEBUG uploadOpenApi - VALIDATION FAILED: Not an object');
        return { status: 400, message: 'Invalid OpenAPI document: Document must be a valid JSON object' };
    }

    // Check for required OpenAPI fields
    if (!openapiJson.openapi && !openapiJson.swagger) {
        return { status: 400, message: 'Invalid OpenAPI document: Missing openapi or swagger version field' };
    }

    if (!openapiJson.info || typeof openapiJson.info !== 'object') {
        return { status: 400, message: 'Invalid OpenAPI document: Missing or invalid info object' };
    }

    if (!openapiJson.paths || typeof openapiJson.paths !== 'object' || Object.keys(openapiJson.paths).length === 0) {
        return { status: 400, message: 'Invalid OpenAPI document: Missing paths or paths object is empty' };
    }

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }

    // Phase 1: Generate descriptions/tags via LLM (outside transaction)
    const apiOperations = [];
    const totalPaths = Object.keys(openapiJson.paths).length;
    let processedCount = 0;
    
    console.log(`Starting to process ${totalPaths} API paths...`);
    
    for (const [apiPath, methods] of Object.entries(openapiJson.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
            processedCount++;
            console.log(`Processing ${processedCount}: ${method.toUpperCase()} ${apiPath}`);
            
            let summary = operation.summary || '';
            let tags = operation.tags || [];
            
            // Generate missing summary and/or tags via LLM
            if (!summary || tags.length === 0) {
                console.log(`  - Generating description/tags via LLM (this may take a moment)...`);
                const basicOp = {
                    summary: operation.summary || '',
                    parameters: operation.parameters || [],
                    requestBody: operation.requestBody || null,
                    responses: operation.responses || {}
                };
                const generated = await generateApiDescriptionAndTags(apiPath, method.toUpperCase(), basicOp);
                if (!summary && generated.description) {
                    summary = generated.description;
                }
                if (tags.length === 0 && generated.tags.length > 0) {
                    tags = generated.tags;
                }
                console.log(`  - LLM generation complete`);
            }
            
            // Store the prepared operation for database insertion
            apiOperations.push({
                apiPath,
                method: method.toUpperCase(),
                operation: {
                    summary: summary,
                    tags: tags,
                    parameters: operation.parameters || [],
                    requestBody: operation.requestBody || null,
                    responses: operation.responses || {},
                    operationId: operation.operationId || null
                }
            });
        }
    }

    // Phase 2: Insert all operations into database in a single transaction
    console.log(`All LLM generations complete. Starting database transaction...`);
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const upserted = [];
        
        for (const { apiPath, method, operation } of apiOperations) {
            console.log(`  - Upserting: ${method} ${apiPath}`);
            const row = await upsertDraftApi(projectId, apiPath, method, operation, myId);
            upserted.push(row);
        }
        
        await client.query('COMMIT');
        console.log(`Successfully processed all ${processedCount} API endpoints`);
        return { success: true, apis: upserted };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('uploadOpenApi error:', err);
        return { status: 500, message: err.message || 'Internal server error while processing OpenAPI document' };
    } finally {
        client.release();
    }
};

// Upload SQL DDL → parse and upsert draft tables (only mentioned tables)
export const uploadSqlDdl = async (projectId, databaseId, ddlText, myId) => {
    const tables = parseSqlDdl(ddlText);
    if (!tables.length) {
        return { success: false, message: 'No CREATE TABLE statements found' };
    }

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    
    // Generate missing descriptions and tags for tables
    for (const t of tables) {
        if (!t.description || !t.tags || t.tags.length === 0) {
            const generated = await generateTableDescriptionAndTags(t.tableName, t.columns, t.pkColumns, t.fkRelations);
            if (!t.description && generated.description) {
                t.description = generated.description;
            }
            if (!t.tags || t.tags.length === 0) {
                t.tags = generated.tags;
            }
        }
    }
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const inserted = [];
        for (const t of tables) {
            const row = await upsertDraftTable(projectId, databaseId, t, myId);
            inserted.push(row);
        }
        await client.query('COMMIT');
        return { success: true, tables: inserted };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('uploadSqlDdl error:', err);
        return 500;
    } finally {
        client.release();
    }
};

// Generate LLM description for a draft table
export const generateTableTxt = async (tableId, myId) => {
    const query = `SELECT * FROM RagKnowledgeBaseTables WHERE id = $1 AND kb_version = 'draft' AND deleted = FALSE;`;
    const { rows } = await pool.query(query, [tableId]);
    if (rows.length === 0) return { success: false, message: 'Draft table not found' };
    const row = rows[0];
    const schemaJson = row.schema_json;
    const pkColumns = row.pk_columns || [];
    const fkRelations = row.fk_relations || [];

    const { system, user } = buildGenerationPrompt(row.table_name, schemaJson, pkColumns, fkRelations);
    const messages = [
        { role: 'user', content: user }
    ];

    try {
        const aiRes = await sendRequestToClaudeAI(messages, system);
        const content = aiRes?.content?.[0]?.text || aiRes?.content || '';
        // Store generated txt
        const upd = `
            UPDATE RagKnowledgeBaseTables
            SET generated_txt = $1, generation_status = 'generated', updated_at = NOW(), updated_by = $2
            WHERE id = $3
            RETURNING *;
        `;
        const { rows: updRows } = await pool.query(upd, [content, myId, tableId]);

        // Optionally write to temp/processed-schemas
        const outDir = path.join(__dirname, '..', '..', 'temp', 'processed-schemas');
        try { fs.mkdirSync(outDir, { recursive: true }); } catch {}
        const outPath = path.join(outDir, `${row.table_name}_draft.txt`);
        fs.writeFileSync(outPath, content, 'utf-8');

        return snake2Camel(updRows[0]);
    } catch (err) {
        console.error('generateTableTxt error:', err);
        return 500;
    }
};

// List draft tables for a project
export const listDraftTables = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query = `SELECT * FROM RagKnowledgeBaseTables WHERE project_id = $1 AND kb_version = 'draft' AND deleted = FALSE ORDER BY created_at DESC;`;
    const { rows } = await pool.query(query, [projectId]);
    return rows.map(snake2Camel);
};

// List active tables for a project
export const listActiveTables = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query = `SELECT * FROM RagKnowledgeBaseTables WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE ORDER BY created_at DESC;`;
    const { rows } = await pool.query(query, [projectId]);
    return rows.map(snake2Camel);
};

// Get single draft table
export const getDraftTable = async (tableId, myId) => {
    const query = `SELECT * FROM RagKnowledgeBaseTables WHERE id = $1 AND kb_version = 'draft' AND deleted = FALSE;`;
    const { rows } = await pool.query(query, [tableId]);
    if (!rows.length) return { success: false, message: 'Not found' };
    return snake2Camel(rows[0]);
};

// Update draft table (user edits)
export const updateDraftTable = async (tableId, updates, myId) => {
    // Convert camelCase keys to snake_case
    const snakeUpdates = camel2Snake(updates);

    // Extract FE-provided keys (columns) and merge into schema_json.columns
    const { keys, ...restUpdates } = snakeUpdates;
    if (keys !== undefined) {
        const schemaRes = await pool.query(
            `SELECT schema_json FROM RagKnowledgeBaseTables WHERE id = $1 AND kb_version = 'draft' AND deleted = FALSE;`,
            [tableId]
        );
        if (!schemaRes.rows.length) return { success: false, message: 'Not found' };
        const currentSchema = (schemaRes.rows[0].schema_json && typeof schemaRes.rows[0].schema_json === 'object')
            ? { ...schemaRes.rows[0].schema_json }
            : {};
        const columns = Array.isArray(keys) ? keys : [];
        restUpdates.schema_json = { ...currentSchema, columns };
    }
    
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(restUpdates)) {
        if (k === 'kb_version' || k === 'ready_for_rag') continue; // protect system fields
        fields.push(`${k} = $${idx++}`);
        values.push(['schema_json', 'fk_relations'].includes(k) ? JSON.stringify(v) : v);
    }
    if (fields.length === 0) return { success: false, message: 'No valid fields to update' };
    values.push(myId);
    values.push(tableId);

    const query = `
        UPDATE RagKnowledgeBaseTables SET ${fields.join(', ')}, updated_at = NOW(), updated_by = $${idx++}
        WHERE id = $${idx} AND kb_version = 'draft' AND deleted = FALSE RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    if (!rows.length) return { success: false, message: 'Update failed' };
    return snake2Camel(rows[0]);
};

// Create draft table (new record, same payload shape as updateDraftTable but without id)
export const createDraftTable = async (projectId, payload, myId) => {
    // Convert camelCase keys to snake_case
    const snakePayload = camel2Snake(payload);

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }

    // Validate database_id exists if provided
    let validDatabaseId = null;
    if (snakePayload.database_id) {
        const dbCheck = await pool.query(
            'SELECT id FROM RagKnowledgeBaseDatabases WHERE id = $1 AND deleted = FALSE',
            [snakePayload.database_id]
        );
        if (dbCheck.rows.length > 0) {
            validDatabaseId = snakePayload.database_id;
        }
    }

    const { keys, schema_json, fk_relations, pk_columns, ...rest } = snakePayload;
    const columns = Array.isArray(keys) ? keys : [];
    const currentSchema = (schema_json && typeof schema_json === 'object') ? { ...schema_json } : {};
    const mergedSchemaJson = { ...currentSchema, columns };

    const tableName = rest.table_name;
    if (!tableName) {
        return { success: false, message: 'table_name is required' };
    }

    const tags = Array.isArray(rest.tags) ? rest.tags : [];
    const description = rest.description || null;
    const schemaSource = rest.schema_source || 'manual';
    const pkCols = Array.isArray(pk_columns) ? pk_columns : [];
    const fkRels = fk_relations || [];

    const query = `
        INSERT INTO RagKnowledgeBaseTables 
            (project_id, database_id, table_name, tags, description, kb_version, schema_source, schema_json, pk_columns, fk_relations, submission_status, created_by, updated_by)
        VALUES 
            ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, 'editing', $10, $11)
        RETURNING *;
    `;

    const values = [
        projectId,
        validDatabaseId,
        tableName,
        tags,
        description,
        schemaSource,
        JSON.stringify(mergedSchemaJson),
        pkCols,
        JSON.stringify(fkRels),
        myId,
        myId
    ];

    const { rows } = await pool.query(query, values);
    if (!rows.length) return { success: false, message: 'Insert failed' };
    return snake2Camel(rows[0]);
};

export const deleteDraftTable = async (tableId, myId) => {
    console.log('deleteDraftTable is triggered');
    console.log('tableId: ', tableId);
    console.log('myId: ', myId);
    const query = `
        UPDATE RagKnowledgeBaseTables
        SET deleted = TRUE, table_name = table_name || '_deleted_' || id || '_' || EXTRACT(EPOCH FROM NOW())::TEXT, updated_at = NOW(), updated_by = $2
        WHERE id = $1
        AND created_by = $2
        AND kb_version = 'draft' 
        AND deleted = FALSE
        RETURNING id;
    `;

    const values = [tableId, myId];

    try {
        const result = await pool.query(query, values)
        .catch(err => {
            console.error('Error deleting draft table:', err);
            throw err;
        });

        if (result.rowCount === 0) {
            throw new Error('Table not found or not authorized to delete.');
        }

        return result.rows[0];
    }
    catch (error) {
        console.error('Error in deleteDraftTable:', error);
        throw error;
    }
}

// Submit draft → mark as ready for review (doesn't promote yet)
export const submitDraftKb = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query = `
        UPDATE RagKnowledgeBaseTables
        SET submission_status = 'submitted', updated_at = NOW(), updated_by = $1
        WHERE project_id = $2 AND kb_version = 'draft' AND deleted = FALSE;
    `;
    await pool.query(query, [myId, projectId]);
    const query2 = `
        UPDATE RagKnowledgeBaseApis
        SET submission_status = 'submitted', updated_at = NOW(), updated_by = $1
        WHERE project_id = $2 AND kb_version = 'draft' AND deleted = FALSE;
    `;
    await pool.query(query2, [myId, projectId]);
    return { success: true };
};

// Submit draft → mark as ready for review (doesn't promote yet)
export const submitDraftKbApi = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query2 = `
        UPDATE RagKnowledgeBaseApis
        SET submission_status = 'submitted', updated_at = NOW(), updated_by = $1
        WHERE project_id = $2 AND kb_version = 'draft' AND deleted = FALSE;
    `;
    await pool.query(query2, [myId, projectId]);
    return { success: true };
};

// Submit draft → mark as ready for review (doesn't promote yet)
export const submitDraftKbTable = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const query = `
        UPDATE RagKnowledgeBaseTables
        SET submission_status = 'submitted', updated_at = NOW(), updated_by = $1
        WHERE project_id = $2 AND kb_version = 'draft' AND deleted = FALSE;
    `;
    await pool.query(query, [myId, projectId]);
    return { success: true };
};

// Promote draft → active (ready for RAG)
export const promoteToActive = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Delete old active tables
        await client.query(
            `UPDATE RagKnowledgeBaseTables SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'active'`,
            [projectId]
        );
        
        // Copy draft → active (with new IDs)
        await client.query(`
            INSERT INTO RagKnowledgeBaseTables 
                (project_id, database_id, table_name, tags, kb_version, description, schema_source, schema_json, pk_columns, fk_relations, generated_txt, generation_status, submission_status, ready_for_rag, created_by, updated_by)
            SELECT 
                project_id, database_id, table_name, tags, 'active', description, schema_source, schema_json, pk_columns, fk_relations, generated_txt, generation_status, submission_status, TRUE, $2, $2
            FROM RagKnowledgeBaseTables
            WHERE project_id = $1 AND kb_version = 'draft' AND deleted = FALSE;
        `, [projectId, myId]);
        
        // Same for APIs
        await client.query(
            `UPDATE RagKnowledgeBaseApis SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'active'`,
            [projectId]
        );
        await client.query(`
            INSERT INTO RagKnowledgeBaseApis 
                (project_id, api_path, api_method, description, tags, kb_version, openapi_operation, submission_status, ready_for_rag, created_by, updated_by)
            SELECT 
                project_id, api_path, api_method, description, tags, 'active', openapi_operation, submission_status, TRUE, $2, $2
            FROM RagKnowledgeBaseApis
            WHERE project_id = $1 AND kb_version = 'draft' AND deleted = FALSE;
        `, [projectId, myId]);
        
        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('promoteToActive error:', err);
        return 500;
    } finally {
        client.release();
    }
};

// Discard draft → reset from active
export const discardDraft = async (projectId, myId) => {

    if (!projectId || projectId <= 0) {
        const project = await fetchOrCreateLatestProject(myId);
        projectId = project.id;
    }
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // Delete current draft
        await client.query(
            `UPDATE RagKnowledgeBaseTables SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'draft'`,
            [projectId]
        );
        await client.query(
            `UPDATE RagKnowledgeBaseApis SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'draft'`,
            [projectId]
        );
        
        // Copy active → draft (reset)
        await client.query(`
            INSERT INTO RagKnowledgeBaseTables 
                (project_id, database_id, table_name, tags, kb_version, description, schema_source, schema_json, pk_columns, fk_relations, generated_txt, generation_status, submission_status, ready_for_rag, created_by, updated_by)
            SELECT 
                project_id, database_id, table_name, tags, 'draft', description, schema_source, schema_json, pk_columns, fk_relations, generated_txt, generation_status, 'editing', FALSE, $2, $2
            FROM RagKnowledgeBaseTables
            WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE;
        `, [projectId, myId]);
        
        await client.query(`
            INSERT INTO RagKnowledgeBaseApis 
                (project_id, api_path, api_method, description, tags, kb_version, openapi_operation, submission_status, ready_for_rag, created_by, updated_by)
            SELECT 
                project_id, api_path, api_method, description, tags, 'draft', openapi_operation, 'editing', FALSE, $2, $2
            FROM RagKnowledgeBaseApis
            WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE;
        `, [projectId, myId]);
        
        await client.query('COMMIT');
        return { success: true };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('discardDraft error:', err);
        return 500;
    } finally {
        client.release();
    }
};
