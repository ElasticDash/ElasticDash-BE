import * as auth from '../controller/auth/auth';
import express from 'express';
import {
    generalApiResponseSender,
    generalApiErrorHandler,
    snake2Camel
} from '../controller/general/tools';
import { postChatCompletion } from '../controller/chat/completion.js';
import { postDuplicatedChat } from '../controller/duplicated_chat/route.js';
import * as sessionDAO from '../controller/chat/sessionDAO.js';
import * as messageDAO from '../controller/chat/messageDAO.js';
import * as conversationDAO from '../controller/chat/conversationDAO.js';
import { io } from '../index.js';

const router = express.Router();

// POST /chat/completion - Orchestrated chat endpoint with planning, approval, and execution
router.post('/completion', async (request, response) => {
    console.log('api: POST /chat/completion');
    const { messages, conversationId, isApproval, customerUserId } = request.body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        console.warn('POST /chat/completion: Invalid messages - missing or not an array');
        return generalApiErrorHandler(response, {
            status: 400,
            message: 'messages array required'
        });
    }

    try {
        const b_tokenValidated = await auth.verifyToken(request, response, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
        const myId = b_tokenValidated.userId;
        request.body.userId = myId; // Attach validated userId to request body

        // If approval, resolve latest session for this conversation
        if (isApproval && conversationId) {
            // Find latest session for this conversation
            const latestSession = await sessionDAO.getLatestSessionByConversationId(conversationId);
            if (!latestSession) {
                return generalApiErrorHandler(response, {
                    status: 404,
                    message: 'No session found for this conversation.'
                });
            }
            // Attach sessionId for approval path
            request.body.sessionId = latestSession.id;
        } else {
            // Remove sessionId from request if present
            delete request.body.sessionId;
        }

        const data = {
            inProgress: true,
            conversationId,
            isApproval,
            customerUserId
        };
        generalApiResponseSender(response, data);

        // Call the completion handler
        postChatCompletion(request)
            .then(result => {
                console.log(`POST /chat/completion: Completed successfully`);
                io.in(myId.toString()).emit('chat_update', { conversationId });
                return result;
            })
            .catch(err => {
                console.error('POST /chat/completion error:', err);
                generalApiErrorHandler(response, {
                    status: 500,
                    message: err.message || 'Chat completion failed'
                });
            });
    } catch (err) {
        console.error('Error status: ', err);
        generalApiErrorHandler(response, err);
    }
});

// POST /chat/duplicated - Alternative chat endpoint using duplicated_chat controller
// This endpoint uses the duplicated_chat route.js implementation with conversation-based flow
//
// Request Body Format:
//   {
//     "message": "string",                       // Required: Current user message (non-empty)
//     "conversationId": number,                  // Required: ID of the conversation this message belongs to
//     "isApproval": boolean                      // Optional: true = explicit plan approval
//                                                // If omitted, inferred from message content
//                                                // (e.g., "approve", "yes", "proceed", "ok", "confirm", "go ahead")
//   }
//
// Request Headers:
//   Content-Type: application/json              // Required
//   Authorization: Bearer <token>               // Optional, but required for executing protected endpoints
//
// Conversation Flow:
//   - Normal request: Fetches last 10 messages from the conversation for context
//   - Approval request: Fetches last 2 messages (includes the plan that was sent)
//   - Historical messages are automatically retrieved using conversationId
//
// Response Variations:
//   - Resolution-only: { message, refinedQuery, topKResults, planResponse, planningDurationMs }
//   - Executed plan: { message, refinedQuery, topKResults, executedSteps, accumulatedResults, iterations }
//   - Awaiting approval: { message, planSummary, awaitingApproval: true, conversationId, ... }
//   - No execution: { message, refinedQuery, topKResults, planResponse, usedReferencePlan }
//   - Error: { error: "message" } with status 400/500
router.post('/duplicated', async (request, response) => {
    console.log('api: POST /chat/duplicated');
    console.log('Request body:', request.body);
    
    try {
        const b_tokenValidated = await auth.verifyToken(request, response, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(response, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
        const myId = b_tokenValidated.userId;
        const userToken = b_tokenValidated.token;
        const body = request.body;
        // Call the duplicated_chat POST handler directly
        const result = await postDuplicatedChat(body, myId, userToken);
        
        // The POST function returns a NextResponse, we need to extract the data
        if (result && result.json) {
            const data = await result.json();
            return response.json(data);
        } else if (result) {
            return response.json(result);
        }
    } catch (error) {
        console.error('POST /chat/duplicated error:', error);
        return generalApiErrorHandler(response, {
            status: 500,
            message: error.message || 'Duplicated chat completion failed'
        });
    }
});

// GET /chat/history/:sessionId/:firstMessageId - Fetch chat history for a session, requires auth and ownership
router.get('/history/:sessionId/:firstMessageId', async (req, res) => {
    console.log('api: GET /chat/history/' + req.params.sessionId + '/' + req.params.firstMessageId);
    try {
        // Auth check
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
        const userId = b_tokenValidated.userId;
        const sessionId = req.params.sessionId;
        const firstMessageId = parseInt(req.params.firstMessageId, 10);
        if (!sessionId || isNaN(firstMessageId)) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: 'sessionId and valid firstMessageId required'
            });
        }

        // Check session ownership
        const session = await sessionDAO.getSession(sessionId);
        if (!session || session.user_id !== userId) {
            return generalApiErrorHandler(res, {
                status: 403,
                message: 'You do not have access to this session.'
            });
        }

        // Fetch all messages for the session with id >= firstMessageId, ordered by id asc
        const messages = await messageDAO.getMessagesBySessionIdFromId(sessionId, firstMessageId);
        // Format: match POST /chat/completion (role, content, time, messageType)
        const formatted = (messages || []).map(msg => ({
            role: msg.role,
            content: msg.content,
            time: msg.created_at || msg.time || null,
            messageType: msg.message_type || msg.messageType || 'text',
            id: msg.id
        }));

        const data = {
            sessionId,
            firstMessageId,
            messages: formatted
        };
        generalApiResponseSender(res, data);
    } catch (err) {
        console.error('GET /chat/history error:', err);
        generalApiErrorHandler(res, {
            status: 500,
            message: err.message || 'Failed to fetch chat history.'
        });
    }
});

// GET /chat/conversation/:conversationId/:lastMessageId - Fetch 20 messages by conversationId and lastMessageId
router.get('/conversation/:conversationId/:lastMessageId', async (req, res) => {
    console.log('api: GET /chat/conversation/' + req.params.conversationId + '/' + req.params.lastMessageId);
    try {
        // Auth check
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
        const userId = b_tokenValidated.userId;
        const conversationId = parseInt(req.params.conversationId, 10);
        const lastMessageId = parseInt(req.params.lastMessageId, 10);
        if (!conversationId || isNaN(lastMessageId)) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: 'conversationId and valid lastMessageId required'
            });
        }

        // Check conversation ownership
        const conversation = await conversationDAO.getConversationById(conversationId, userId);
        if (!conversation) {
            return generalApiErrorHandler(res, {
                status: 403,
                message: 'You do not have access to this conversation.'
            });
        }

        // Fetch messages
        const messages = await messageDAO.getMessagesByConversationIdFromId(conversationId, lastMessageId);
        const formatted = snake2Camel((messages || []).map(msg => ({
            role: msg.role === 'assistant' ? 'agent' : msg.role,
            content: msg.content,
            time: msg.created_at || msg.time || null,
            messageType: msg.message_type || msg.messageType || 'text',
            id: msg.id,
            ...msg
        })));
        res.json({
            conversationId,
            lastMessageId,
            messages: formatted
        });
    } catch (err) {
        console.error('GET /chat/conversation error:', err);
        generalApiErrorHandler(res, {
            status: 500,
            message: err.message || 'Failed to fetch conversation messages.'
        });
    }
});

// GET /chat/conversations - Fetch list of conversations ordered by updated_at desc
router.get('/conversations', async (req, res) => {
    console.log('api: GET /chat/conversations');
    try {
        // Auth check
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }
        const userId = b_tokenValidated.userId;
        const conversationDAO = require('../controller/chat/conversationDAO');
        const conversations = await conversationDAO.getConversationsByUserId(userId);
        res.json({
            conversations
        });
    } catch (err) {
        console.error('GET /chat/conversations error:', err);
        generalApiErrorHandler(res, {
            status: 500,
            message: err.message || 'Failed to fetch conversations.'
        });
    }
});

export { router as chat };

