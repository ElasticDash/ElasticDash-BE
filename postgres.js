import pg from 'pg';
const { Pool } = pg;

// Support both connection string and individual environment variables
let config;
let configReadOnly;

if (process.env.DB_CONNECTION_STRING) {
    // Use connection string (for backwards compatibility)
    const url = new URL(process.env.DB_CONNECTION_STRING);
    config = {
        user: url.username,
        host: url.hostname,
        database: url.pathname.slice(1).split('?')[0],
        password: url.password,
        port: url.port,
        ssl: false
    };
    console.log('Using DB_CONNECTION_STRING config:', {
        user: config.user,
        host: config.host,
        database: config.database,
        port: config.port
    });
} else {
    // Use individual environment variables (preferred for K8s)
    config = {
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: process.env.DB_PORT || 5432,
        ssl: false
    };
    console.log('Using individual DB env vars config:', {
        user: config.user,
        host: config.host,
        database: config.database,
        port: config.port
    });
}

if (process.env.DB_CONNECTION_STRING_READONLY) {
    const urlRO = new URL(process.env.DB_CONNECTION_STRING_READONLY);
    configReadOnly = {
        user: urlRO.username,
        host: urlRO.hostname,
        database: urlRO.pathname.slice(1).split('?')[0],
        password: urlRO.password,
        port: urlRO.port,
        ssl: false
    };
    console.log('Using DB_CONNECTION_STRING_READONLY config:', {
        user: configReadOnly.user,
        host: configReadOnly.host,
        database: configReadOnly.database,
        port: configReadOnly.port
    });
} else {
    configReadOnly = config; // Fallback to main config if no read-only string provided
}

export const poolReadOnly = new Pool(configReadOnly);

export const pool = new Pool(config)

// console.log('connectionString:', connectionString);

/**
 * Format date for PostgreSQL TIMESTAMP WITH TIME ZONE
 * @param {Date|string} date - JavaScript Date or ISO string
 * @returns {string} ISO string for PostgreSQL
 */
export function formatTimestamp(date = new Date()) {
    if (typeof date === 'string') return date;
    return date.toISOString();
}

/**
 * Sanitize error message for client exposure
 * @param {Error} error - Database error
 * @returns {string} Safe error message
 */
export function sanitizeDbError(error) {
    if (!error) return 'Database operation failed';
    // Log full error for debugging
    console.error('Database error:', error);
    // Return safe message to client
    if (error.code === '23505') return 'Duplicate entry';
    if (error.code === '23503') return 'Invalid reference to related data';
    if (error.code === '23502') return 'Missing required field';
    if (error.code === '42P01') return 'Table not found';
    if (error.code === '42703') return 'Column not found';
    return 'Database operation failed';
}

/**
 * Execute a single query (compatible with DAO usage)
 * @param {string} queryText - SQL query string
 * @param {Array} values - Query parameters
 * @returns {Promise<Object>} Query result
 */
export async function query(queryText, values = []) {
    const client = await pool.connect();
    try {
        const result = await client.query(queryText, values);
        return result;
    } finally {
        client.release();
    }
}

/**
 * Execute a transaction
 * @param {Function} callback - Async function that receives client as parameter
 * @returns {Promise<Any>} Result from callback
 */
export async function transaction(callback) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}
