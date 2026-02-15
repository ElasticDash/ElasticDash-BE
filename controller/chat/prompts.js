import fs from 'fs';
import path from 'path';

const DEFAULT_PROMPT_DIR = path.join(process.cwd(), 'resources', 'chat', 'prompts');
const cache = new Map();

export function loadPrompt(name, baseDir = DEFAULT_PROMPT_DIR) {
    const key = `${baseDir}:${name}`;
    if (cache.has(key)) return cache.get(key);
    const filePath = path.join(baseDir, name);
    if (!fs.existsSync(filePath)) {
        throw new Error(`Prompt file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    cache.set(key, content);
    return content;
}

export function clearPromptCache() {
    cache.clear();
}
