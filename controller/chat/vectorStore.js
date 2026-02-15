import fs from 'fs';
import path from 'path';
import { embed } from './openai.js';
import { cosineSimilarity } from './similarity.js';

const DEFAULT_BASE = path.join(process.cwd(), 'data', 'vectorized-data');

let cached = null;

function loadJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function ensureLoaded(basePath = DEFAULT_BASE) {
    if (cached) return cached;
    const combinedPath = path.join(basePath, 'vectorized-data.json');
    const apiPath = path.join(basePath, 'api', 'vectorized-data.json');
    const tablePath = path.join(basePath, 'table', 'vectorized-data.json');

    cached = {
        combined: fs.existsSync(combinedPath) ? loadJson(combinedPath) : [],
        api: fs.existsSync(apiPath) ? loadJson(apiPath) : [],
        table: fs.existsSync(tablePath) ? loadJson(tablePath) : [],
        basePath
    };
    return cached;
}

// Load project-specific RAG files
function loadProjectRag(projectId) {
    const ragsDir = path.join(process.cwd(), '../rags');
    const apisPath = path.join(ragsDir, `rag_${projectId}_apis.json`);
    const tablesPath = path.join(ragsDir, `rag_${projectId}_tables.json`);
    
    const result = {
        api: [],
        table: [],
        projectId
    };
    
    try {
        if (fs.existsSync(apisPath)) {
            result.api = loadJson(apisPath);
        }
    } catch (err) {
        console.error(`Failed to load APIs RAG file for project ${projectId}:`, err.message);
    }
    
    try {
        if (fs.existsSync(tablesPath)) {
            result.table = loadJson(tablesPath);
        }
    } catch (err) {
        console.error(`Failed to load tables RAG file for project ${projectId}:`, err.message);
    }
    
    return result;
}

export function getVectorData(type = 'combined') {
    const data = ensureLoaded();
    if (type === 'api') return data.api;
    if (type === 'table') return data.table;
    return data.combined;
}

/**
 * Perform semantic search over vectorized data
 * @param {string} query - The search query
 * @param {string} type - Data type: 'combined', 'api', or 'table'
 * @param {number} topK - Number of top results to return
 * @param {number} projectId - Project ID for loading project-specific RAG files
 * @returns {Promise<Array>} Top-K most similar items with their content
 */
export async function semanticSearch(query, type = 'combined', topK = 10, projectId = null) {
    if (!query || typeof query !== 'string') {
        throw new Error('Query must be a non-empty string');
    }

    let data = [];
    
    // If projectId is provided, load project-specific RAG
    if (projectId) {
        const projectRag = loadProjectRag(projectId);
        
        // Check if RAG files exist and have data
        if ((type === 'api' || type === 'combined') && projectRag.api.length === 0) {
            if (type === 'api') {
                throw new Error('RAG is missing. Please contact your admin.');
            }
        }
        if ((type === 'table' || type === 'combined') && projectRag.table.length === 0) {
            if (type === 'table') {
                throw new Error('RAG is missing. Please contact your admin.');
            }
        }
        
        if (type === 'api') {
            data = projectRag.api;
        } else if (type === 'table') {
            data = projectRag.table;
        } else if (type === 'combined') {
            data = [...projectRag.table, ...projectRag.api];
        }
    } else {
        // Fallback to default vectorized-data
        data = getVectorData(type);
    }
    
    if (!data || data.length === 0) {
        console.warn(`[VectorStore] No data available for type: ${type}, projectId: ${projectId}`);
        return [];
    }

    // Get embedding for the query
    console.log(`[VectorStore] Generating embedding for query: "${query.substring(0, 100)}..."`);
    const queryEmbedding = await embed({ input: query });
    
    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
        throw new Error('Failed to generate query embedding');
    }

    console.log(`[VectorStore] Searching through ${data.length} items (projectId=${projectId})`);

    // Calculate similarity scores for all items
    const scored = data
        .filter(item => item.embedding && Array.isArray(item.embedding))
        .map(item => ({
            ...item,
            similarity: cosineSimilarity(queryEmbedding, item.embedding)
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);

    console.log(`[VectorStore] Top ${topK} results:`, scored.map(s => ({ 
        id: s.id || s.name, 
        similarity: s.similarity.toFixed(4) 
    })));

    return scored;
}

export function reloadVectors(basePath = DEFAULT_BASE) {
    cached = null;
    return ensureLoaded(basePath);
}

export function getVectorPaths() {
    const data = ensureLoaded();
    const { basePath } = data;
    return {
        combined: path.join(basePath, 'vectorized-data.json'),
        api: path.join(basePath, 'api', 'vectorized-data.json'),
        table: path.join(basePath, 'table', 'vectorized-data.json')
    };
}

