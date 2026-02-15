import { postChatCompletion } from './completion.js';
import { runPlanningPipeline } from './planner.js';
import { getVectorData } from './vectorStore.js';
import { executeStep, sanitizeForSerialization } from './executor.js';
import { sessionStore } from './sessionStore.js';
import * as conversationDAO from './conversationDAO.js';
import * as messageDAO from './messageDAO.js';
import * as planDAO from './planDAO.js';
import * as planStepDAO from './planStepDAO.js';
import * as sessionDAO from './sessionDAO.js';

jest.mock('./planner.js', () => ({ runPlanningPipeline: jest.fn() }));
jest.mock('./vectorStore.js', () => ({ getVectorData: jest.fn() }));
jest.mock('./executor.js', () => ({
  executeStep: jest.fn(),
  sanitizeForSerialization: jest.fn((v) => v),
}));
jest.mock('./sessionStore.js', () => {
  const backing = new Map();
  return {
    sessionStore: {
      get: jest.fn((k) => backing.get(k)),
      set: jest.fn((k, v) => backing.set(k, v)),
      delete: jest.fn((k) => backing.delete(k)),
      _backing: backing,
    },
    SessionStore: jest.fn(),
  };
});

jest.mock('./conversationDAO.js', () => ({
  createConversation: jest.fn(),
  getConversationById: jest.fn(),
}));

jest.mock('./messageDAO.js', () => ({
  insertMessage: jest.fn(),
  getMessagesByConversationId: jest.fn(),
}));

jest.mock('./planDAO.js', () => ({
  createPlan: jest.fn(),
  getPlanById: jest.fn(),
  approvePlan: jest.fn(),
  updatePlanStatus: jest.fn(),
}));

jest.mock('./planStepDAO.js', () => ({
  insertStep: jest.fn(),
  recordStepExecution: jest.fn(),
}));

jest.mock('./sessionDAO.js', () => ({
  getSession: jest.fn(),
  upsertSession: jest.fn(),
  updateSessionData: jest.fn(),
  deleteSession: jest.fn(),
}));

function createRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('postChatCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStore._backing?.clear?.();
    getVectorData.mockReturnValue([]);
    conversationDAO.createConversation.mockResolvedValue({ id: 1, user_id: 1 });
    messageDAO.insertMessage.mockResolvedValue({ id: 1, conversation_id: 1 });
    planDAO.createPlan.mockResolvedValue({ id: 100, conversation_id: 1 });
    sessionDAO.getSession.mockResolvedValue(null);
    sessionDAO.upsertSession.mockResolvedValue({ id: 'session_1' });
  });

  test('returns 400 when messages are missing', async () => {
    const req = { body: {}, headers: {} };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'messages array required' });
  });

  test('returns 400 when userId is missing', async () => {
    const req = {
      body: { messages: [{ role: 'user', content: 'test' }] },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'userId required in request body' });
  });

  test('creates conversation and returns clarification message', async () => {
    getVectorData.mockReturnValue([{ id: 'v1' }]);
    runPlanningPipeline.mockResolvedValue({
      actionablePlan: { needs_clarification: true, clarification_question: 'Need more info' },
      planResponse: '{}',
    });

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'question?' }],
      },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(conversationDAO.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
      })
    );
    expect(messageDAO.insertMessage).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Need more info',
        refinedQuery: 'question?',
      })
    );
  });

  test('stores pending plan and requests approval on fresh plan', async () => {
    getVectorData.mockReturnValue([{ id: 'v1' }, { id: 'v2' }]);
    runPlanningPipeline.mockResolvedValue({
      actionablePlan: {
        needs_clarification: false,
        execution_plan: [
          { step_number: 1, description: 'do thing', api: { path: '/x', method: 'get' } },
        ],
      },
      planResponse: '{"ok":true}',
    });

    const req = {
      body: {
        userId: 1,
        customerUserId: 'ext-user-123',
        messages: [{ role: 'user', content: 'do work' }],
      },
      headers: { authorization: 'Bearer abc' },
    };
    const res = createRes();

    await postChatCompletion(req, res);

    // Verify conversation was created
    expect(conversationDAO.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        customerUserId: 'ext-user-123',
      })
    );

    // Verify plan was created
    expect(planDAO.createPlan).toHaveBeenCalled();

    // Verify session was stored
    expect(sessionDAO.upsertSession).toHaveBeenCalled();
    expect(sessionStore.set).toHaveBeenCalled();

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        needsApproval: true,
        conversationId: 1,
        refinedQuery: 'do work',
      })
    );
  });

  test('executes pending plan on approval from database session', async () => {
    const mockSession = {
      id: 'session_1',
      user_id: 1,
      conversation_id: 1,
      pending_plan_id: 100,
      session_data: {
        plan: {
          execution_plan: [
            { step_number: 1, description: 'call api', api: { path: '/path', method: 'get' } },
          ],
        },
        refinedQuery: 'task',
      },
    };

    sessionDAO.getSession.mockResolvedValue(mockSession);
    planDAO.getPlanById.mockResolvedValue({
      id: 100,
      conversation_id: 1,
      plan_json: JSON.stringify({
        execution_plan: [
          { step_number: 1, description: 'call api', api: { path: '/path', method: 'get' } },
        ],
      }),
    });

    executeStep.mockResolvedValue({ response: { ok: true }, error: null });
    sanitizeForSerialization.mockImplementation((v) => v);

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'approve' }],
        sessionId: 'session_1',
        isApproval: true,
      },
      headers: { authorization: 'Bearer abc' },
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(planDAO.approvePlan).toHaveBeenCalledWith(100, 1);
    expect(executeStep).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Plan executed',
        executedSteps: expect.any(Array),
      })
    );
  });

  test('executes pending plan on approval from in-memory session (fallback)', async () => {
    sessionStore.set('session_memory', {
      plan: {
        execution_plan: [
          { step_number: 1, description: 'call api', api: { path: '/path', method: 'get' } },
        ],
      },
      refinedQuery: 'task',
    });
    sessionDAO.getSession.mockResolvedValue(null); // No DB session, fallback to in-memory

    executeStep.mockResolvedValue({ response: { ok: true }, error: null });
    sanitizeForSerialization.mockImplementation((v) => v);

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'approve' }],
        sessionId: 'session_memory',
        isApproval: true,
      },
      headers: { authorization: 'Bearer abc' },
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(executeStep).toHaveBeenCalledTimes(1);
    expect(sessionStore.delete).toHaveBeenCalledWith('session_memory');
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Plan executed',
        executedSteps: [expect.objectContaining({ response: { ok: true } })],
      })
    );
  });

  test('rejects pending plan when not approved (database session)', async () => {
    const mockSession = {
      id: 'session_reject',
      user_id: 1,
      conversation_id: 1,
      pending_plan_id: 100,
    };

    sessionDAO.getSession.mockResolvedValue(mockSession);

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'no' }],
        sessionId: 'session_reject',
      },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(planDAO.rejectPlan).toHaveBeenCalledWith(100, 1, 'User rejected plan');
    expect(sessionDAO.deleteSession).toHaveBeenCalledWith('session_reject');
    expect(res.json).toHaveBeenCalledWith({ message: 'Plan rejected. Provide a new instruction or clarify.' });
  });

  test('rejects pending plan from in-memory session (fallback)', async () => {
    sessionStore.set('session_reject', { plan: { execution_plan: [] }, refinedQuery: 'task' });
    sessionDAO.getSession.mockResolvedValue(null);

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'no' }],
        sessionId: 'session_reject',
      },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(sessionStore.delete).toHaveBeenCalledWith('session_reject');
    expect(res.json).toHaveBeenCalledWith({ message: 'Plan rejected. Provide a new instruction or clarify.' });
  });

  test('returns 500 with sanitized error on database error', async () => {
    conversationDAO.createConversation.mockRejectedValue(new Error('Database connection failed'));

    const req = {
      body: {
        userId: 1,
        messages: [{ role: 'user', content: 'test' }],
      },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.any(String),
      })
    );
  });

  test('includes customerUserId in conversation creation', async () => {
    getVectorData.mockReturnValue([]);
    runPlanningPipeline.mockResolvedValue({
      actionablePlan: {
        needs_clarification: false,
        execution_plan: [],
      },
      planResponse: '{}',
    });

    const req = {
      body: {
        userId: 5,
        customerUserId: 'chatbot-client-789',
        messages: [{ role: 'user', content: 'hello' }],
      },
      headers: {},
    };
    const res = createRes();

    await postChatCompletion(req, res);

    expect(conversationDAO.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 5,
        customerUserId: 'chatbot-client-789',
      })
    );
  });
});
