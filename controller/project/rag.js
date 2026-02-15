import { pool } from '../../postgres';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fetchOrCreateLatestProject } from '../project/staging.js';
import { promoteToActive } from './staging';
import { sendRequestToClaudeAI } from '../general/aihandler.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL || 'text-embedding-ada-002';

// Compose API content string similar to vectorize-openapi.js (string for embeddings)
function composeApiContent(apiPath, method, op) {
    const summary = op.summary || '';
    const tags = Array.isArray(op.tags) ? op.tags : [];
    const description = op.description || '';

    const params = Array.isArray(op.parameters)
        ? op.parameters.map(p => `${p.name} (${p.in}): ${p.schema ? p.schema.type : ''}`).join('; ')
        : '';

    let requestBody = '';
    if (op.requestBody && op.requestBody.content) {
        const contentTypes = Object.keys(op.requestBody.content);
        requestBody = contentTypes.map(ct => {
            const schema = op.requestBody.content[ct].schema;
            return `${ct}: ${schema ? JSON.stringify(schema) : ''}`;
        }).join('; ');
    }

    let responses = '';
    if (op.responses) {
        responses = Object.entries(op.responses).map(([code, resp]) => {
            const desc = resp.description || '';
            let schema = '';
            if (resp.content && resp.content['application/json'] && resp.content['application/json'].schema) {
                schema = JSON.stringify(resp.content['application/json'].schema);
            }
            return `${code}: ${desc}${schema ? ' ' + schema : ''}`;
        }).join('; ');
    }

    return `path: ${apiPath}\nmethod: ${method}\ntags: ${tags.join(', ')}\nsummary: ${summary}\ndescription: ${description}\nparameters: ${params}\nrequestBody: ${requestBody}\nresponses: ${responses}`;
}

async function generateEmbedding(text) {
    if (!OPENAI_API_KEY) return null;
    const resp = await axios.post('https://api.openai.com/v1/embeddings', {
        model: EMBEDDING_MODEL,
        input: text
    }, {
        headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        }
    });
    return resp.data?.data?.[0]?.embedding || null;
}

function ensureDir(p) {
    try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

async function ensureActiveVersions(client, projectId) {
    // Force all related records to active for this project
    await client.query(
        `UPDATE RagKnowledgeBaseTables
         SET kb_version = 'active', updated_at = NOW()
         WHERE project_id = $1 AND deleted = FALSE AND kb_version <> 'active'`,
        [projectId]
    );
    await client.query(
        `UPDATE RagKnowledgeBaseApis
         SET kb_version = 'active', updated_at = NOW()
         WHERE project_id = $1 AND deleted = FALSE AND kb_version <> 'active'`,
        [projectId]
    );
}

async function ensureActiveVersionsTables(client, projectId) {
    // Force all related records to active for this project
    await client.query(
        `UPDATE RagKnowledgeBaseTables
         SET kb_version = 'active', updated_at = NOW()
         WHERE project_id = $1 AND deleted = FALSE AND kb_version <> 'active'`,
        [projectId]
    );
}

async function ensureActiveVersionsApis(client, projectId) {
    // Force all related records to active for this project
    await client.query(
        `UPDATE RagKnowledgeBaseApis
         SET kb_version = 'active', updated_at = NOW()
         WHERE project_id = $1 AND deleted = FALSE AND kb_version <> 'active'`,
        [projectId]
    );
}

async function dedupeActiveTables(client, projectId) {
    // Keep the most recently updated per table_name, delete the rest
    await client.query(
        `DELETE FROM RagKnowledgeBaseTables t
         USING (
             SELECT id,
                    ROW_NUMBER() OVER (PARTITION BY project_id, table_name ORDER BY updated_at DESC, id DESC) AS rn
             FROM RagKnowledgeBaseTables
             WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE
         ) d
         WHERE t.id = d.id AND d.rn > 1`,
        [projectId]
    );
}

async function dedupeActiveApis(client, projectId) {
    // Keep the most recently updated per api_path + api_method, delete the rest
    await client.query(
        `DELETE FROM RagKnowledgeBaseApis a
         USING (
             SELECT id,
                    ROW_NUMBER() OVER (PARTITION BY project_id, api_path, api_method ORDER BY updated_at DESC, id DESC) AS rn
             FROM RagKnowledgeBaseApis
             WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE
         ) d
         WHERE a.id = d.id AND d.rn > 1`,
        [projectId]
    );
}

// Build formatted table content for RAG with LLM examples
async function buildFormattedTableContent(row) {
    const tableName = row.table_name;
    const columns = Array.isArray(row.schema_json?.columns) ? row.schema_json.columns : [];
    const columnNames = columns.map(c => c.name).filter(Boolean);
    const pkColumns = Array.isArray(row.pk_columns) ? row.pk_columns : [];
    const fkRelations = Array.isArray(row.fk_relations) ? row.fk_relations : [];
    const schemaLine = `${tableName}(${columnNames.join(', ')})`;

    const base = `Database Schema:\nTables:\n${schemaLine}`;

    // If generated_txt already exists, use it as examples
    if (row.generated_txt && row.generated_txt.trim()) {
        return `${base}\n\n${row.generated_txt.trim()}`;
    }

    // Attempt to get examples from LLM
    const examples = await generateTableExamples(tableName, columnNames, pkColumns, fkRelations, row.description || '').catch(() => null);
    if (examples) {
        return `${base}\n\n${examples}`;
    }

    // Fallback deterministic examples
    const exampleCols = columnNames.slice(0, 3).join(', ') || '*';
    const example1 = `-- Example 1\nQuestion: List sample rows from ${tableName}.\nSQL: SELECT ${exampleCols} FROM ${tableName} LIMIT 10;`;
    const example2 = `-- Example 2\nQuestion: Count rows in ${tableName}.\nSQL: SELECT COUNT(*) FROM ${tableName};`;
    return `${base}\n\n${example1}\n\n${example2}`;
}

async function generateTableExamples(tableName, columnNames, pkColumns, fkRelations, description) {
    const systemMsg = 'You are a SQL expert. Given a table schema, produce two concise examples (Question + SQL) demonstrating meaningful use of the table.';
    const fkText = fkRelations.map(f => `${f.column} -> ${f.refTable}.${f.refColumn}`).join('; ');
    const userMsg = `Table: ${tableName}\nColumns: ${columnNames.join(', ')}\nPrimary Keys: ${pkColumns.join(', ')}\nForeign Keys: ${fkText || 'None'}\nDescription: ${description || 'N/A'}\n\nRequired output format EXACTLY (no markdown):\nDatabase Schema:\nTables:\n${tableName}(${columnNames.join(', ')})\n\n-- Example 1\nQuestion: <question 1>\nSQL: <sql 1>\n\n-- Example 2\nQuestion: <question 2>\nSQL: <sql 2>`;

    const messages = [{ role: 'user', content: userMsg }];
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('LLM timeout')), 30000));
    const response = await Promise.race([sendRequestToClaudeAI(messages, systemMsg), timeout]);
    const text = response?.content?.[0]?.text || response?.content || '';
    return text.trim();
}

// Helper: Compare existing and new items, return merged list with only changed items re-embedded
function compareAndMergeItems(existingItems, newItems) {
    // Build maps by ID for quick lookup
    const existingMap = new Map(existingItems.map(item => [item.id, item]));
    const newItemsMap = new Map(newItems.map(item => [item.id, item]));
    
    const merged = [];
    
    // Process all new items
    for (const newItem of newItems) {
        const existing = existingMap.get(newItem.id);
        
        if (!existing) {
            // New item - use it as-is (already has embedding from caller)
            merged.push(newItem);
        } else if (newItem.content === existing.content) {
            // Content unchanged - keep existing with its embedding
            merged.push(existing);
        } else {
            // Content changed - use new item with updated embedding
            merged.push(newItem);
        }
    }
    
    return merged;
}

// Build/update APIs RAG file with incremental updates
export const buildRagForApis = async (projectId, myId) => {
    const client = await pool.connect();
    try {
        // Load project info
        if (!projectId || projectId <= 0) {
            const project = await fetchOrCreateLatestProject(myId);
            projectId = project.id;
        }
        const projRes = await client.query(
            `SELECT id FROM RagProjects WHERE id = $1 AND deleted = FALSE`,
            [projectId]
        );
        if (!projRes.rowCount) throw new Error('Project not found');

        // Ensure active versions and dedupe when called standalone
        await ensureActiveVersionsApis(client, projectId);
        await dedupeActiveApis(client, projectId);
        
        const ragsDir = path.join(process.cwd(), '../rags');
        ensureDir(ragsDir);
        const apisPath = path.join(ragsDir, `rag_${projectId}_apis.json`);
        
        // Load existing APIs from RAG file
        let existingApiItems = [];
        try {
            if (fs.existsSync(apisPath)) {
                const fileContent = fs.readFileSync(apisPath, 'utf-8');
                existingApiItems = JSON.parse(fileContent) || [];
            }
        } catch (err) {
            console.log('Could not load existing APIs RAG file, starting fresh:', err.message);
            existingApiItems = [];
        }
        
        // Fetch all active APIs from database
        const apisRes = await client.query(`
            SELECT api_path, api_method, openapi_operation
            FROM RagKnowledgeBaseApis
            WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE
        `, [projectId]);
        console.log(`buildRagForApis: fetched ${apisRes.rowCount} active APIs for project ${projectId}`);
        
        // Build new API items with embeddings
        const newApiItems = [];
        for (const row of apisRes.rows) {
            const method = (row.api_method || '').toUpperCase();
            const op = row.openapi_operation || {};
            const content = composeApiContent(row.api_path, method, op);
            const embedding = await generateEmbedding(content).catch(() => null);
            newApiItems.push({ id: `api-${row.api_path}-${method}`, type: 'api', content, embedding });
        }
        
        // Merge: keep existing items unless content changed
        const mergedApiItems = compareAndMergeItems(existingApiItems, newApiItems);
        
        // Write merged APIs to file
        fs.writeFileSync(apisPath, JSON.stringify(mergedApiItems, null, 2), 'utf-8');
        
        return { success: true, apiCount: mergedApiItems.length };
    } catch (err) {
        console.error('buildRagForApis error:', err);
        throw err;
    } finally {
        client.release();
    }
};

// Build/update Tables RAG file with incremental updates
export const buildRagForTables = async (projectId, myId) => {
    const client = await pool.connect();
    try {
        // Load project info
        if (!projectId || projectId <= 0) {
            const project = await fetchOrCreateLatestProject(myId);
            projectId = project.id;
        }
        const projRes = await client.query(
            `SELECT id FROM RagProjects WHERE id = $1 AND deleted = FALSE`,
            [projectId]
        );
        if (!projRes.rowCount) throw new Error('Project not found');

        // Ensure active versions and dedupe when called standalone
        await ensureActiveVersionsTables(client, projectId);
        await dedupeActiveTables(client, projectId);
        
        const ragsDir = path.join(process.cwd(), '../rags');
        ensureDir(ragsDir);
        const tablesPath = path.join(ragsDir, `rag_${projectId}_tables.json`);
        
        // Load existing tables from RAG file
        let existingTableItems = [];
        try {
            if (fs.existsSync(tablesPath)) {
                const fileContent = fs.readFileSync(tablesPath, 'utf-8');
                existingTableItems = JSON.parse(fileContent) || [];
            }
        } catch (err) {
            console.log('Could not load existing tables RAG file, starting fresh:', err.message);
            existingTableItems = [];
        }
        
        // Fetch all active tables from database
        const tablesRes = await client.query(`
            SELECT table_name, generated_txt, schema_json, pk_columns, fk_relations
            FROM RagKnowledgeBaseTables
            WHERE project_id = $1 AND kb_version = 'active' AND deleted = FALSE
        `, [projectId]);
        
        // Build new table items with embeddings
        const newTableItems = [];
        for (const row of tablesRes.rows) {
            const content = await buildFormattedTableContent(row);
            const embedding = await generateEmbedding(content).catch(() => null);
            newTableItems.push({ id: `table-${row.table_name}`, type: 'table', content, embedding });
        }
        
        // Merge: keep existing items unless content changed
        const mergedTableItems = compareAndMergeItems(existingTableItems, newTableItems);
        
        // Write merged tables to file
        fs.writeFileSync(tablesPath, JSON.stringify(mergedTableItems, null, 2), 'utf-8');
        
        return { success: true, tableCount: mergedTableItems.length };
    } catch (err) {
        console.error('buildRagForTables error:', err);
        throw err;
    } finally {
        client.release();
    }
};

// Main function: Promote draft to active and build both RAG files
export const buildRagForProject = async (projectId, myId) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1) Promote draft → active
        await promoteToActive(projectId, myId);

        // 2) Remove draft rows entirely
        await client.query(`UPDATE RagKnowledgeBaseTables SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'draft'`, [projectId]);
        await client.query(`UPDATE RagKnowledgeBaseApis SET deleted = TRUE WHERE project_id = $1 AND kb_version = 'draft'`, [projectId]);

        // 3) Ensure all related records are marked active
        await ensureActiveVersions(client, projectId);

        // 4) Deduplicate active records by table_name and api_path+api_method
        await dedupeActiveTables(client, projectId);
        await dedupeActiveApis(client, projectId);

        // 5) Load project info
        if (!projectId || projectId <= 0) {
            const project = await fetchOrCreateLatestProject(myId);
            projectId = project.id;
        }
        const projRes = await client.query(`SELECT id FROM RagProjects WHERE id = $1 AND deleted = FALSE`, [projectId]);
        if (!projRes.rowCount) throw new Error('Project not found');

        // 6) Setup paths
        const ragsDir = path.join(process.cwd(), '../rags');
        ensureDir(ragsDir);
        const relPathBase = `../rags/rag_${projectId}`;

        await client.query('COMMIT');

        // 7) Build both RAG files independently (outside transaction to avoid long lock)
        const apiResult = await buildRagForApis(projectId, myId);
        const tableResult = await buildRagForTables(projectId, myId);

        // 8) Update project.rag_path
        const client2 = await pool.connect();
        try {
            await client2.query(`UPDATE RagProjects SET rag_path = $1, updated_at = NOW(), updated_by = $2 WHERE id = $3`, [relPathBase, myId, projectId]);
        } finally {
            client2.release();
        }

        return { 
            success: true, 
            ragPathBase: relPathBase,
            ragPathTables: relPathBase + '_tables.json',
            ragPathApis: relPathBase + '_apis.json',
            tableCount: tableResult.tableCount,
            apiCount: apiResult.apiCount
        };
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('buildRagForProject error:', err);
        return 500;
    } finally {
        client.release();
    }
};
