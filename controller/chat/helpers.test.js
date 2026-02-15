import fs from 'fs';
import os from 'os';
import path from 'path';
import { reloadVectors, getVectorData, getVectorPaths } from './vectorStore.js';
import { loadPrompt, clearPromptCache } from './prompts.js';
import { SessionStore } from './sessionStore.js';

describe('vectorStore', () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'vectors-'));

  beforeAll(() => {
    fs.mkdirSync(path.join(tmpBase, 'api'), { recursive: true });
    fs.mkdirSync(path.join(tmpBase, 'table'), { recursive: true });
    fs.writeFileSync(path.join(tmpBase, 'vectorized-data.json'), JSON.stringify([{ id: 1, name: 'combined' }]), 'utf-8');
    fs.writeFileSync(path.join(tmpBase, 'api', 'vectorized-data.json'), JSON.stringify([{ id: 2, name: 'api' }]), 'utf-8');
    fs.writeFileSync(path.join(tmpBase, 'table', 'vectorized-data.json'), JSON.stringify([{ id: 3, name: 'table' }]), 'utf-8');
  });

  afterAll(() => {
    // Reload default vectors to avoid leaking test state
    reloadVectors();
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  test('loads combined, api, and table vectors from custom base path', () => {
    reloadVectors(tmpBase);
    expect(getVectorData('combined')).toEqual([{ id: 1, name: 'combined' }]);
    expect(getVectorData('api')).toEqual([{ id: 2, name: 'api' }]);
    expect(getVectorData('table')).toEqual([{ id: 3, name: 'table' }]);
    const paths = getVectorPaths();
    expect(paths.combined).toContain('vectorized-data.json');
    expect(paths.api).toContain(path.join('api', 'vectorized-data.json'));
    expect(paths.table).toContain(path.join('table', 'vectorized-data.json'));
  });
});

describe('prompts loader', () => {
  const promptDir = fs.mkdtempSync(path.join(os.tmpdir(), 'prompts-'));
  const promptFile = path.join(promptDir, 'example.txt');

  beforeAll(() => {
    fs.writeFileSync(promptFile, 'first', 'utf-8');
  });

  afterEach(() => {
    clearPromptCache();
  });

  afterAll(() => {
    fs.rmSync(promptDir, { recursive: true, force: true });
  });

  test('caches prompt content until cache cleared', () => {
    const first = loadPrompt('example.txt', promptDir);
    expect(first).toBe('first');
    fs.writeFileSync(promptFile, 'second', 'utf-8');
    const cached = loadPrompt('example.txt', promptDir);
    expect(cached).toBe('first');
    clearPromptCache();
    const refreshed = loadPrompt('example.txt', promptDir);
    expect(refreshed).toBe('second');
  });
});

describe('SessionStore', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('expires entries after TTL and cleans up', () => {
    const store = new SessionStore({ ttlMs: 50, cleanupIntervalMs: 20 });
    store.set('k1', 'v1');
    expect(store.get('k1')).toBe('v1');
    jest.advanceTimersByTime(60);
    expect(store.get('k1')).toBeUndefined();
  });
});
