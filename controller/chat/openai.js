import OpenAI from 'openai';
import { NodeSDK } from "@opentelemetry/sdk-node";
// import { observeOpenAI } from "@elasticdash/openai";
import { ElasticDashSpanProcessor } from "@elasticdash/otel";

const sdk = new NodeSDK({
  spanProcessors: [new ElasticDashSpanProcessor()],
});
 
sdk.start();

// Lightweight OpenAI helper with per-call timeouts
const DEFAULT_MODEL = process.env.OPENAI_DEFAULT_MODEL;
const DEFAULT_EMBED_MODEL = 'text-embedding-ada-002';

function getClient(providerToken) {
    const apiKey = providerToken || process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY is not set');
    }
    return new OpenAI({ apiKey });
}

function withTimeout(promise, timeoutMs, label) {
    if (!timeoutMs) return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label || 'request'} timed out after ${timeoutMs}ms`)), timeoutMs))
    ]);
}

export async function chatCompletion({ messages, model = DEFAULT_MODEL, temperature = 0.3, maxTokens, timeoutMs, extra }) {
    const client = getClient();
    // const client = observeOpenAI(getClient(), { isProd: process.env.NODE_ENV === 'production' });
    const payload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...extra,
    };
    const req = client.chat.completions.create(payload);
    const res = await withTimeout(req, timeoutMs, 'chatCompletion');
    return res;
}

export async function chatCompletionUnsupervised({ messages, model = DEFAULT_MODEL, temperature = 0.3, maxTokens, timeoutMs, extra }, providerToken) {
    const client = getClient(providerToken);
    // const client = observeOpenAI(getClient(), { isProd: process.env.NODE_ENV === 'production' });
    const payload = {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        ...extra,
    };
    const req = client.chat.completions.create(payload);
    const res = await withTimeout(req, timeoutMs, 'chatCompletion');
    return res;
}

export async function embed({ input, model = DEFAULT_EMBED_MODEL, timeoutMs }) {
    const client = getClient();
    // const client = observeOpenAI(getClient(), { isProd: process.env.NODE_ENV === 'production' });
    const req = client.embeddings.create({ model, input });
    const res = await withTimeout(req, timeoutMs, 'embedding');
    return res.data?.[0]?.embedding || res.data?.[0];
}

export function getDefaultModels() {
    return { chatModel: DEFAULT_MODEL, embedModel: DEFAULT_EMBED_MODEL };
}
