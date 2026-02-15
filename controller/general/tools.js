import Jimp from "jimp";
export const AWS = require('aws-sdk');

AWS.config.update({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_AK, // Optional if using IAM roles or environment variables
    secretAccessKey: process.env.AWS_SAK // Optional if using IAM roles or environment variables
});

export const snake2Camel = (obj) => {
    if (!obj) return obj;

    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            obj[i] = snake2Camel(obj[i]);
        }
    }
    else {
        if (typeof obj !== 'object') {
            return obj;
        }
        else {
            Object.keys(obj).forEach((key) => {
                if (key.toString().includes('_')) {
                    Object.defineProperty(obj, convertSnakeToCamel(key), Object.getOwnPropertyDescriptor(obj, key));
                    delete obj[key];
                }
            });
        }
        //console.log('updated obj: ', obj); 
    }
    return obj;
}

export const camel2Snake = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(item => camel2Snake(item));
    }
    else if (typeof obj !== 'object' || obj === null) {
        return obj;
    }
    else {
        const snakeObj = {};
        Object.keys(obj).forEach((key) => {
            const snakeKey = convertCamelToSnake(key);
            snakeObj[snakeKey] = obj[key];
        });
        return snakeObj;
    }
}

function convertSnakeToCamel(str) {
    return str.replace(
        /([-_][a-z])/g,
        (group) => group.toUpperCase()
            .replace('-', '')
            .replace('_', '')
    )
    .replace(/-/g, '')
    .replace(/_/g, '');
}

function convertCamelToSnake(str) {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
        .toLowerCase();
}

export const randomString = (number) => {    
    number = number || 8;
    var a = "ABCDEFGHJKMNPQRSTWXYZ1234567890",
    b = a.length,
    n = "";
    for (let i = 0; i < number; i++) {
        n += a.charAt(Math.floor(Math.random() * b))
    }
    return n
}

export const generateCsvData = (titles, content) => {
    console.log('generateCsvData is triggered');
    console.log('titles: ', titles);
    console.log('content: ', content);

    let row = "";
    let csvData = "";
    for (const title of titles) {
        row += '"' + title + '",';
    }
    csvData += row + "\r\n"; // 添加换行符号
    for (const item of content) {
        row = "";
        for (let key in item) {
            if (item[key]) {
                row += '"' + item[key] + '",';
            }
            else {
                row += '"",';
            }
        }
        csvData += row + "\r\n"; // 添加换行符号
    }
    if (!csvData) return;
}

export const validateBodyWithKeys = (body, keys) => {
    if (typeof body === 'object' && Array.isArray(keys) && keys['length'] && typeof keys[0] === 'string') {
        for (let k of keys) {
            if (!Object.prototype.hasOwnProperty.call(body, k)) {
                return false;
            }
        }
        return true;
    }
    else {
        console.error('type error in validateBodyWithKeys, abort');
        return false;
    }
}

export const generalApiErrorHandler = (response, err) => {
    if (!response.headersSent) {
        if (err['status'] && err['message']) {
            response.status(err['status']).send(err['message']);
        }
        else if (typeof err === 'number') {
            response.sendStatus(err);
        }
        else {
            response.sendStatus(500);
        }
    }
}

export const generalApiResponseSender = (response, data, useStatus = true) => {
    if (!response.headersSent) {
        if (
            typeof data === 'object' &&
            data !== null &&
            data.hasOwnProperty('status') &&
            Object.keys(data).every(k => k === 'status' || k === 'message')
        ) {
            response.status(data['status']).send({
                success: true,
                result: snake2Camel(data)
            });
        }
        else if (typeof data !== "number") {
            response.send({
                success: true,
                result: snake2Camel(data)
            });
        }
        else {
            response.sendStatus(data);
        }
    }
}

export const randomName = [
    {
        name: 'Sarah Walker',
        gender: 'female'
    },
    {
        name: 'Alex Carney',
        gender: 'male'
    },
    {
        name: 'Christine McLeavey',
        gender: 'female'
    },
    {
        name: 'Jeff Belgum',
        gender: 'male'
    },
    {
        name: 'Katie Malone',
        gender: 'female'
    },
    {
        name: 'Peter Welinder',
        gender: 'male'
    }
]

export const randomVoice = [
    {
        name: 'alloy',
        gender: 'female'
    },
    {
        name: 'echo',
        gender: 'male'
    },
    {
        name: 'fable',
        gender: 'female'
    },
    {
        name: 'onyx',
        gender: 'male'
    },
    {
        name: 'nova',
        gender: 'female'
    },
    {
        name: 'shimmer',
        gender: 'female'
    },
]

export const resizeImage = (buffer, width, height) => {
    return new Promise((resolve, reject) => {
        try {
            Jimp.read(buffer)
            .then(async image => {
                const newImg = new Jimp(width, height, 0x00000000);

                await newImg.composite(image, 0, 0);

                newImg.getBufferAsync(Jimp.MIME_PNG)
                .then(data => {
                    resolve(data);
                })
            })
            .catch(err => {
                reject(err);
            })
        }
        catch (err) {
            reject(err);
        }
    })
}

export const chatGptUrl = 'https://api.openai.com/v1/chat/completions';
  
export const chatGptHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
};

export const xaiUrl = 'https://api.x.ai/v1/chat/completions';

export const xaiHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
};

export const claudeUrl = 'https://api.anthropic.com/v1/messages';

export const claudeHeaders = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
    'x-api-key': `${process.env.CLAUDE_API_KEY}`
};

export function bodyFormatterClaude(messageArr, systemMessage) {
    return {
        "model": "claude-3-7-sonnet-20250219", 
        // Maximum 64000 tokens
        "max_tokens": 10000, 
        "system": systemMessage ? systemMessage : "You are a professional prompt engineer for VS Code GitHub Copilot and Cursor. Your task is to locate relevant items based on the provided prompt and context.", 
        "messages": messageArr,
        "temperature": 0.2 
    }
}

export function getApiClassCodeBlock(apiLines, index) {
    let codeBlock = '';
    let openBraces = 0;
    let closeBraces = 0;
    let openBrackets = 0;
    let closeBrackets = 0;
    let openParentheses = 0;
    let closeParentheses = 0;
    let i = index;
    while (i < apiLines.length) {
        const line = apiLines[i];
        codeBlock += line + '\n';
        for (let j = 0; j < line.length; j++) {
            if (line[j] === '{') {
                openBraces++;
            }
            else if (line[j] === '}') {
                closeBraces++;
            }
            else if (line[j] === '[') {
                openBrackets++;
            }
            else if (line[j] === ']') {
                closeBrackets++;
            }
            else if (line[j] === '(') {
                openParentheses++;
            }
            else if (line[j] === ')') {
                closeParentheses++;
            }
        }
        // Ignore the check if the line has no braces, brackets, or parentheses
        if (
            line.includes('{') || 
            line.includes('}') || 
            line.includes('[') || 
            line.includes(']') || 
            line.includes('(') || 
            line.includes(')')
        ) {
            if (
                openBraces === closeBraces &&
                openBrackets === closeBrackets &&
                openParentheses === closeParentheses
            ) {
                break;
            }
        }
        i++;
    }
    return {
        codeBlock,
        index: i
    };
}

/**
 * Count tokens in a message or array of messages
 * @param {Object|Array<Object>} messages - Message object or array of message objects
 * @returns {Promise<number>} - Token count
 */
export const countTokens = async (messages) => {
    try {
        // Simple estimation function - approximately 4 chars per token
        if (Array.isArray(messages)) {
            let totalTokens = 0;
            for (const message of messages) {
                if (typeof message === 'object' && message.content) {
                    // Add tokens for the message content (approx 4 chars per token)
                    totalTokens += Math.ceil(message.content.length / 4);
                    
                    // Add tokens for role (approx 3 tokens per role)
                    totalTokens += 3;
                }
            }
            return totalTokens;
        } else if (typeof messages === 'object' && messages.content) {
            // Add tokens for the message content (approx 4 chars per token)
            let totalTokens = Math.ceil(messages.content.length / 4);
            
            // Add tokens for role (approx 3 tokens per role)
            totalTokens += 3;
            
            return totalTokens;
        }
        
        return 0;
    } catch (err) {
        console.error('Error counting tokens:', JSON.stringify(err, null, 2));
        // Return a conservative estimate in case of error
        return 1000;
    }
}
