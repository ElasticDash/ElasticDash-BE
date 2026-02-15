import { GoogleGenAI } from '@google/genai';

const DEFAULT_MODEL = 'gemini-pro';

function getClient(providerToken) {
    const apiKey = providerToken || process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not set');
    }
    return new GoogleGenAI({apiKey});
}

function withTimeout(promise, timeoutMs, label) {
    if (!timeoutMs) return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label || 'request'} timed out after ${timeoutMs}ms`)), timeoutMs))
    ]);
}

// Convert OpenAI-style messages to Gemini format
function convertMessagesToGeminiFormat(messages) {
    const history = [];
    let lastMessage = null;

    for (const msg of messages) {

        const role = msg.role === 'system' ? 'user' : 
            msg.role === 'assistant' ? 
                'model' : 
                    'user';

        const parts = [{ text: msg.parts || msg.content }];

        if (lastMessage) {
            history.push(lastMessage);
        }

        lastMessage = { role, parts };
    }

    return { history, lastMessage };
}

export async function chatCompletion({ messages, model = DEFAULT_MODEL, temperature = 0.3, maxTokens, timeoutMs }, providerToken) {
    const genAI = getClient(providerToken);

    // Extract model name without 'models/' prefix if present
    const modelName = model.startsWith('models/') ? model.replace('models/', '') : model;

    const { history, lastMessage } = convertMessagesToGeminiFormat(messages);

    const generationConfig = {
        temperature,
        maxOutputTokens: maxTokens,
    };

    const chat = genAI.chats.create({
        model: modelName,
        history,
        config: generationConfig
    })

    // const req = chat.sendMessage({ message: lastMessage.parts[0].text });
    // const response = await withTimeout(req, timeoutMs, 'chatCompletion');
    const response = await chat.sendMessage({ message: lastMessage.parts[0].text });

    // Convert Gemini response to OpenAI-like format
    return {
        choices: [
            {
                message: {
                    role: 'assistant',
                    content: response.text
                },
                finish_reason: 'stop'
            }
        ],
        model: model,
        usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0
        }
    };
}

export async function chatCompletionUnsupervised({ messages, model = DEFAULT_MODEL, temperature = 0.3, maxTokens, timeoutMs }, providerToken) {
    return chatCompletion({ messages, model, temperature, maxTokens, timeoutMs }, providerToken);
}
