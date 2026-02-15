import { createClient } from '@clickhouse/client';
import { getUserTestProjectStringIdAndId } from '../controller/features/features.js';
import dotenv from 'dotenv';
dotenv.config();

const client = createClient({
  url: process.env.CLICKHOUSE_URL,
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || '',
  database: process.env.CLICKHOUSE_DB || 'default',
});

export async function listTraces({ limit = 100, offset = 0, filter, userId }) {
    console.log('listTraces is triggered');
    const project = await getUserTestProjectStringIdAndId(userId);
    let filterClause = `
        AND t.id IN (
            SELECT o.trace_id FROM observations o
            WHERE o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
            AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
            AND o.name != 'handleChatRequest'
        )`;
    // If filter contains a name search, expand it to search both name and metadata[\'name\']
    if (filter && /name\s+LIKE/i.test(filter)) {
        // Extract the search value for name LIKE
        const nameLikeMatch = filter.match(/name\s+LIKE\s*'([^']+)'/i);
        if (nameLikeMatch) {
            const likeValue = nameLikeMatch[1];
            // Remove the original name LIKE from filter
            const filterWithoutName = filter.replace(/name\s+LIKE\s*'[^']+'/i, '');
            // Add expanded search for both name and metadata['name']
            filterClause += ` AND ((t.name LIKE '${likeValue}') OR (t.metadata['name'] LIKE '${likeValue}'))`;
            if (filterWithoutName.trim()) {
                filterClause += ` AND (${filterWithoutName.trim()})`;
            }
        } else {
            filterClause += ` AND ${filter}`;
        }
    } else {
        if (filter) filterClause += ` AND ${filter}`;
    }
    try {
        // Get paginated traces
        const query = `
            SELECT t.id, t.timestamp, t.name, t.metadata, t.created_at, t.updated_at, 
                count() AS steps
            FROM traces t, observations o 
            WHERE t.is_deleted = 0 
            AND t.id = o.trace_id 
            AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
            AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
            AND o.name != 'handleChatRequest'
            AND t.project_id = '${project.project_id}'
            ${filterClause}
            GROUP BY t.id, t.timestamp, t.name, t.metadata, t.created_at, t.updated_at
            ORDER BY t.timestamp DESC 
            LIMIT ${parseInt(limit)} 
            OFFSET ${parseInt(offset)}
        `;
        const result = await client.query({query});
        let rows = await result.json();
        // Add metadataName to each trace
        if (Array.isArray(rows)) {
            rows = rows.map(trace => ({
                ...trace,
                metadataName: trace.metadata && typeof trace.metadata === 'object' ? trace.metadata['name'] : undefined
            }));
        }
        // Get total count
        const countQuery = `
            SELECT count() as total
            FROM (
                SELECT DISTINCT t.id
                FROM traces t, observations o
                WHERE t.is_deleted = 0
                AND t.id = o.trace_id
                AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
                AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
                AND o.name != 'handleChatRequest'
                AND t.project_id = '${project.project_id}'
                ${filterClause}
            )
        `;

        console.log('Count Query:', countQuery);
        const countResult = await client.query({query: countQuery});
        const countRows = await countResult.json();
        console.log('Count Rows:', countRows);
        const total = countRows && countRows.data && countRows.data[0]
            ? Number(countRows.data[0].total || countRows.data[0]['count()'] || Object.values(countRows.data[0])[0])
            : 0;
        return {
            data: rows || [],
            total: total,
            limit: Number(limit),
            offset: Number(offset)
        };
    } catch (err) {
        console.error('Error in listTraces:', err);
        return { success: false, error: err.message || err };
    }
}

// List sessions
export async function listSessions({ limit = 100, offset = 0, filterQuery = '', filterParams = {}, searchQuery = '', searchParams = {}, userId }) {
    console.log('listSessions is triggered');
    try {
        const project = await getUserTestProjectStringIdAndId(userId);
        // Compose filter conditions
        let joinWhere = `t.session_id IS NOT NULL AND t.session_id != ''`;
        if (project !== null && project !== undefined && project.id !== 0 && project.id !== '') {
            joinWhere = `t.project_id = '${project.project_id}' AND ` + joinWhere;
        }
        // If filterQuery contains a name search, expand it to search both name and metadata['name']
        let filterHandled = false;
        if (filterQuery && /name\s+LIKE/i.test(filterQuery)) {
            const nameLikeMatch = filterQuery.match(/name\s+LIKE\s*'([^']+)'/i);
            if (nameLikeMatch) {
                const likeValue = nameLikeMatch[1];
                const filterWithoutName = filterQuery.replace(/name\s+LIKE\s*'[^']+'/i, '');
                joinWhere += ` AND ((t.name LIKE '${likeValue}') OR (t.metadata['name'] LIKE '${likeValue}'))`;
                if (filterWithoutName.trim()) {
                    joinWhere += ` AND (${filterWithoutName.trim()})`;
                }
                filterHandled = true;
            }
        }
        if (!filterHandled && filterQuery) joinWhere += ` AND ${filterQuery}`;
        if (searchQuery) joinWhere += ` AND ${searchQuery}`;

        // Main paginated query using JOIN for early filtering
        const query = `
            SELECT t.session_id, count(*) as count, any(t.metadata['name']) as metadataName
            FROM traces t, observations o
            WHERE ${joinWhere}
                AND t.id = o.trace_id
                AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
                AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
                AND o.name != 'handleChatRequest'
            GROUP BY t.session_id
            ORDER BY count DESC
            LIMIT ${parseInt(limit)} 
            OFFSET ${parseInt(offset)}
        `;
        const params = {
            limit: Number.isInteger(limit) ? limit : parseInt(limit, 10) || 100,
            offset: Number.isInteger(offset) ? offset : parseInt(offset, 10) || 0
        };
        console.log('Params:', params);
        console.log('Query:', query);
        const result = await client.query({ query, params });
        const rows = await result.json();

        // Total count query (use same JOIN logic)
        const countQuery = `
            SELECT count() as total
            FROM (
                SELECT t.session_id
                FROM traces t, observations o 
                WHERE t.id = o.trace_id
                    AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
                    AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
                    AND o.name != 'handleChatRequest'
                    AND ${joinWhere}
                GROUP BY t.session_id
            )
        `;
        const countResult = await client.query({ query: countQuery, params });
        const countRows = await countResult.json();
        console.log('Count Rows:', countRows);
        const total = countRows && countRows.data && countRows.data[0]
            ? Number(countRows.data[0].total || countRows.data[0]['count()'] || Object.values(countRows.data[0])[0])
            : 0;

        return {
            data: rows || [],
            total,
            limit: params.limit,
            offset: params.offset
        };
    } catch (err) {
        console.error('Error in listSessions:', err);
        return { success: false, error: err.message || err };
    }
}

// Get all traces for a session
export async function getSessionDetail({ sessionId, userId }) {
    console.log('getSessionDetail is triggered');
    console.log('Input:', { sessionId, userId });
    try {
        const project = await getUserTestProjectStringIdAndId(userId);
        const query = `SELECT * FROM traces WHERE session_id = '${sessionId}' AND project_id = '${project.project_id}' ORDER BY timestamp`;
        const result = await client.query({query});
        const rows = await result.json();
        return rows || [];
    } catch (err) {
        console.error('Error in getSessionDetail:', err);
        return { success: false, error: err.message || err };
    }
}

// View trace detail

export async function getTraceDetail({ id, userId }) {
    console.log('getTraceDetail is triggered');
    console.log('Input:', { id, userId });
    try {
        const project = userId ? await getUserTestProjectStringIdAndId(userId) : null;
        const query = userId ? 
            `SELECT * FROM traces WHERE id = '${id}' AND project_id = '${project.project_id}' AND is_deleted = 0 LIMIT 1` : 
            `SELECT * FROM traces WHERE id = '${id}' AND is_deleted = 0 LIMIT 1`;
        console.log('getTraceDetail Query:', query);
        const result = await client.query({query});
        if (!result) {
            console.error('getTraceDetail: ClickHouse query returned undefined result');
            return { success: false, error: 'ClickHouse query returned undefined result' };
        }
        const rows = await result.json();
        console.log('getTraceDetail rows:', rows);
        if (!rows || !rows.data || rows.data.length === 0) {
            return null;
        }
        const observationQuery = `
            SELECT o.* FROM observations o 
            WHERE o.trace_id = '${id}' 
                AND o.input IS NOT NULL AND o.input != '' AND o.input != '{}'
                AND o.output IS NOT NULL AND o.output != '' AND o.output != '{}'
                AND o.name != 'handleChatRequest'
            LIMIT 1000
        `;
        const observationResult = await client.query({query: observationQuery});
        const observationRows = await observationResult.json();
        console.log('getTraceDetail observation rows:', {
            meta: observationRows.meta,
            data: observationRows.data.length
        });
        const validObservations = observationRows?.data.filter(o => 
            o.input &&
            o.output &&
            o.input !== '' &&
            o.output !== '' &&
            o.input !== 'null' &&
            o.output !== 'null' &&
            o.input !== 'undefined' &&
            o.output !== 'undefined' &&
            o.input !== '{}' &&
            o.output !== '{}' &&
            /[\w\d\u4e00-\u9fa5]/.test(String(o.input)) &&
            /[\w\d\u4e00-\u9fa5]/.test(String(o.output))
        );
        rows.data[0].observations = validObservations || [];
        return rows.data[0];
    } catch (err) {
        console.error('Error in getTraceDetail:', err && err.stack ? err.stack : err);
        return { success: false, error: err && err.message ? err.message : err };
    }
}

// Delete trace

export async function deleteTrace({ id, userId }) {
    console.log('deleteTrace is triggered');
    console.log('Input:', { id, userId });
    try {
        // ClickHouse does not support UPDATE in the same way as Postgres. Use ALTER TABLE UPDATE or INSERT with ReplacingMergeTree.
        // Here, we use ALTER TABLE UPDATE for logical deletion.
        const project = await getUserTestProjectStringIdAndId(userId);
        const query = `ALTER TABLE traces UPDATE is_deleted = 1 WHERE id = '${id}' AND project_id = '${project.project_id}'`;
        await client.query({query});
        // Check if the row exists after update
        const checkQuery = `SELECT * FROM traces WHERE id = '${id}' AND project_id = '${project.project_id}' AND is_deleted = 1 LIMIT 1`;
        const checkResult = await client.query({query: checkQuery});
        const rows = await checkResult.json();
        if (!rows || rows.length === 0) {
            return { success: false };
        }
        return { success: true };
    } catch (err) {
        console.error('Error in deleteTrace:', err);
        return { success: false, error: err.message || err };
    }
}
