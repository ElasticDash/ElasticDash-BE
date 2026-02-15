import axios from 'axios';
import {
    xaiHeaders, 
    xaiUrl, 
    claudeHeaders, 
    claudeUrl, 
    bodyFormatterClaude 
} from './tools';
import fs from 'fs';
import path from 'path';

// Import chatCompletion from chat/openai.js
import { chatCompletion, chatCompletionUnsupervised } from '../chat/openai.js';
import { chatCompletionUnsupervised as geminiChatCompletionUnsupervised } from '../chat/gemini.js';

export function sendRequestToXAI(data) {
    console.log('sendRequestToXAI is triggered');
    return new Promise((resolve, reject) => {
        console.log('sendRequestToXAI promise is triggered');
        console.log('sendRequestToXAI xaiUrl: ', xaiUrl);
        console.log('sendRequestToXAI data: ', data);
        try {
            const url = xaiUrl;
            return axios.post(url, data, {
                headers: xaiHeaders
            }).then((res) => {
                resolve(res.data);
            })
            .catch((err) => {
                console.error('sendRequestToXAI failed, error: ', err);
                reject(err);
            });
        }
        catch(err) {
            console.error('sendRequestToXAI failed, error: ', err);
            reject(err);
        }
    })
}

// Add token counting helper
export async function countTokens(data) {
    const url = 'https://api.anthropic.com/v1/messages/count_tokens';
    try {
        const response = await axios.post(url, {
            model: data.model,
            messages: data.messages,
            system: data.system
        }, {
            headers: claudeHeaders
        });
        return response.data.input_tokens;
    } catch (err) {
        console.error('Error counting tokens:', JSON.stringify(err, null, 2));
        throw err;
    }
}

export function sendRequestToClaudeAI(messageArr, systemMessage) {
    return new Promise(async (resolve, reject) => {
        let attempts = 0;
        const maxRetries = 5;
        
        const data = bodyFormatterClaude(messageArr, systemMessage);
        
        try {
            // Check token count before making the request
            const tokenCount = await countTokens(data);
            
            // 190000 (input) + 10000 (output) = 200000
            if (tokenCount > 190000) {
                throw new Error(`Token count ${tokenCount} exceeds maximum limit of 200,000`);
            }

            console.log(`Token count: ${tokenCount}`);

            const makeRequest = () => {
                attempts++;
                try {
                    const url = claudeUrl;
                    return axios.post(url, data, {
                        headers: claudeHeaders
                    }).then(async (res) => {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        resolve(res.data);
                    })
                    .catch(async (err) => {
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        console.error(`sendRequestToClaudeAI failed on attempt ${attempts}, error: `, err);
                        if (
                            err.response &&
                            [502, 529].includes(err.response.status) &&
                            attempts < maxRetries
                        ) {
                            console.log(`Retrying request... (${attempts}/${maxRetries})`);
                            makeRequest();
                        } else {
                            if (err.response && err.response.data) {
                                console.error('Error response data: ', err.response.data);
                                const errorMessage = JSON.stringify(err.response.data.error);
                                fs.writeFileSync(path.join(__dirname, '..', '..', 'temp', 'error_log.txt'), errorMessage, { flag: 'a' });
                                
                                const dataStr = JSON.stringify(data, null, 2);
                                fs.writeFileSync(path.join(__dirname, '..', '..', 'temp', 'error_request.txt'), dataStr, { flag: 'a' });
                                reject(err.response.data.error);
                            } else {
                                reject(err);
                            }
                        }
                    });
                }
                catch(err) {
                    console.error('sendRequestToClaudeAI failed, error: ', err);
                    reject(err);
                }
            };

            makeRequest();
        } catch (err) {
            reject(err);
        }
    });
}

export function sendRequestToOpenAI(data) {
    console.log('sendRequestToOpenAI is triggered');
    return new Promise((resolve, reject) => {
        console.log('sendRequestToOpenAI promise is triggered');
        // console.log('sendRequestToOpenAI data: ', data);
        try {
            chatCompletion(data).then((res) => {
                resolve(res);
            })
            .catch((err) => {
                console.error('sendRequestToOpenAI failed, error: ', err);
                reject(err);
            });
        }
        catch(err) {
            console.error('sendRequestToOpenAI failed, error: ', err);
            reject(err);
        }
    })
}

export function sendRequestToOpenAiUnsupervised(data, providerToken) {
    console.log('sendRequestToOpenAiUnsupervised is triggered');
    return new Promise((resolve, reject) => {
        console.log('sendRequestToOpenAiUnsupervised promise is triggered');
        // console.log('sendRequestToOpenAiUnsupervised data: ', data);
        try {
            chatCompletionUnsupervised(data, providerToken).then((res) => {
                resolve(res);
            })
            .catch((err) => {
                console.error('sendRequestToOpenAiUnsupervised failed, error: ', err);
                reject(err);
            });
        }
        catch(err) {
            console.error('sendRequestToOpenAiUnsupervised failed, error: ', err);
            reject(err);
        }
    })
}

export function sendRequestToGeminiUnsupervised(data, providerToken) {
    console.log('sendRequestToGeminiUnsupervised is triggered');
    return new Promise((resolve, reject) => {
        console.log('sendRequestToGeminiUnsupervised promise is triggered');
        try {
            geminiChatCompletionUnsupervised(data, providerToken).then((res) => {
                resolve(res);
            })
            .catch((err) => {
                console.error('sendRequestToGeminiUnsupervised failed, error: ', err);
                reject(err);
            });
        }
        catch(err) {
            console.error('sendRequestToGeminiUnsupervised failed, error: ', err);
            reject(err);
        }
    })
}
