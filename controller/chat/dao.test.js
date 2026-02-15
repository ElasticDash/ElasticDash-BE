import * as conversationDAO from './conversationDAO.js';
import * as messageDAO from './messageDAO.js';
import * as planDAO from './planDAO.js';
import * as planStepDAO from './planStepDAO.js';
import * as feedbackDAO from './feedbackDAO.js';
import * as sessionDAO from './sessionDAO.js';
import { query } from '../../postgres.js';

// Mock the database client
jest.mock('../../postgres.js', () => ({
  query: jest.fn(),
  formatTimestamp: jest.fn(() => '2026-01-12T12:00:00Z'),
  transaction: jest.fn(),
  sanitizeDbError: jest.fn((err) => 'Database error'),
}));

describe('conversationDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createConversation inserts and returns conversation with id', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, user_id: 1, customer_user_id: 'ext-123', title: 'Chat', created_at: '2026-01-12T12:00:00Z' }],
    });

    const result = await conversationDAO.createConversation({
      userId: 1,
      customerUserId: 'ext-123',
      title: 'Chat',
    });

    expect(result.id).toBe(1);
    expect(result.customer_user_id).toBe('ext-123');
    expect(query).toHaveBeenCalled();
  });

  test('getConversationById returns conversation with access control', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, user_id: 1, title: 'Chat' }],
    });

    const result = await conversationDAO.getConversationById(1, 1);

    expect(result.id).toBe(1);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE id = $1 AND user_id = $2'),
      [1, 1]
    );
  });

  test('deleteConversation performs soft delete', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1 }],
    });

    const result = await conversationDAO.deleteConversation(1, 1);

    expect(result).toBe(true);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE Conversations'),
      expect.arrayContaining([1, 1])
    );
  });
});

describe('messageDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('insertMessage stores user and assistant messages', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, conversation_id: 1, role: 'user', content: 'Hello' }],
    });

    const result = await messageDAO.insertMessage({
      conversationId: 1,
      userId: 1,
      customerUserId: 'ext-123',
      role: 'user',
      content: 'Hello',
      messageType: 'text',
    });

    expect(result.id).toBe(1);
    expect(result.role).toBe('user');
    expect(query).toHaveBeenCalled();
  });

  test('getMessagesByConversationId retrieves conversation history with access control', async () => {
    query.mockResolvedValue({
      rows: [
        { id: 1, conversation_id: 1, role: 'user', content: 'Hello' },
        { id: 2, conversation_id: 1, role: 'assistant', content: 'Hi there' },
      ],
    });

    const result = await messageDAO.getMessagesByConversationId(1, 1);

    expect(result).toHaveLength(2);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('JOIN Conversations c ON'),
      expect.arrayContaining([1, 1])
    );
  });

  test('countMessages returns message count for conversation', async () => {
    query.mockResolvedValue({
      rows: [{ count: 5 }],
    });

    const result = await messageDAO.countMessages(1);

    expect(result).toBe(5);
  });
});

describe('planDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('createPlan stores execution plan', async () => {
    const planJson = {
      execution_plan: [
        { step_number: 1, description: 'do thing', api: { path: '/api/x', method: 'GET' } },
      ],
    };

    query.mockResolvedValue({
      rows: [{ id: 100, conversation_id: 1, status: 'pending', needs_approval: true }],
    });

    const result = await planDAO.createPlan({
      conversationId: 1,
      userId: 1,
      planJson,
      intentType: 'FETCH',
    });

    expect(result.id).toBe(100);
    expect(result.status).toBe('pending');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ChatPlans'),
      expect.any(Array)
    );
  });

  test('approvePlan updates status and sets approved_at', async () => {
    query.mockResolvedValue({
      rows: [{ id: 100, status: 'approved', approved_at: '2026-01-12T12:00:00Z' }],
    });

    const result = await planDAO.approvePlan(100, 1);

    expect(result.status).toBe('approved');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ChatPlans'),
      expect.arrayContaining(['approved'])
    );
  });

  test('rejectPlan updates status with rejection reason', async () => {
    query.mockResolvedValue({
      rows: [{ id: 100, status: 'rejected', rejection_reason: 'Too complex' }],
    });

    const result = await planDAO.rejectPlan(100, 1, 'Too complex');

    expect(result.status).toBe('rejected');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ChatPlans'),
      expect.arrayContaining(['rejected'])
    );
  });
});

describe('planStepDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('insertStep creates step record before execution', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, plan_id: 100, step_number: 1, status: 'pending' }],
    });

    const result = await planStepDAO.insertStep({
      planId: 100,
      stepNumber: 1,
      description: 'Fetch data',
      apiPath: '/api/data',
      apiMethod: 'GET',
    });

    expect(result.id).toBe(1);
    expect(result.status).toBe('pending');
  });

  test('recordStepExecution logs request, response, and duration', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, status: 'success', duration_ms: 250 }],
    });

    const result = await planStepDAO.recordStepExecution({
      stepId: 1,
      status: 'success',
      apiRequest: { method: 'GET', url: '/api/data' },
      apiResponse: { data: [1, 2, 3] },
      errorMessage: null,
      durationMs: 250,
    });

    expect(result.status).toBe('success');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE ChatPlanSteps'),
      expect.any(Array)
    );
  });

  test('getExecutionSummary returns status counts', async () => {
    query.mockResolvedValue({
      rows: [{ total: 3, pending: 1, completed: 2, failed: 0, skipped: 0 }],
    });

    const result = await planStepDAO.getExecutionSummary(100);

    expect(result.total).toBe(3);
    expect(result.completed).toBe(2);
  });
});

describe('feedbackDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('upsertFeedback creates or updates feedback', async () => {
    query.mockResolvedValue({
      rows: [{ id: 1, message_id: 5, feedback_type: 'like', is_helpful: true }],
    });

    const result = await feedbackDAO.upsertFeedback({
      messageId: 5,
      conversationId: 1,
      userId: 1,
      feedbackType: 'like',
      isHelpful: true,
    });

    expect(result.feedback_type).toBe('like');
    expect(result.is_helpful).toBe(true);
  });

  test('getFeedbackByMessage returns all feedback for a message', async () => {
    query.mockResolvedValue({
      rows: [
        { id: 1, user_id: 1, feedback_type: 'like' },
        { id: 2, user_id: 2, feedback_type: 'dislike' },
      ],
    });

    const result = await feedbackDAO.getFeedbackByMessage(5);

    expect(result).toHaveLength(2);
  });

  test('addFeedbackReason stores detailed reason for feedback and creates a message', async () => {
    // Mock for the feedback lookup query
    const feedbackLookup = { rows: [{ conversation_id: 1, message_id: 5 }] };
    // Mock for the feedback reason insert
    const reasonInsert = { rows: [{ id: 1, feedback_id: 10, reason_category: 'inaccurate' }] };
    // Mock for the plan lookup query
    const planLookup = { rows: [{ id: 50, plan_json: {} }] };
    // Mock for the message insert
    const messageInsert = { rows: [{ id: 100, conversation_id: 1, role: 'system', message_type: 'feedback' }] };

    query
      .mockResolvedValueOnce(feedbackLookup)
      .mockResolvedValueOnce(reasonInsert)
      .mockResolvedValueOnce(planLookup)
      .mockResolvedValueOnce(messageInsert);

    const result = await feedbackDAO.addFeedbackReason({
      feedbackId: 10,
      reasonCategory: 'inaccurate',
      description: 'Result was not accurate',
      userId: 1,
    });

    expect(result.reason_category).toBe('inaccurate');
    expect(query).toHaveBeenCalledTimes(4);
  });
});

describe('sessionDAO', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('upsertSession creates or updates session with expiration', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'session_1', user_id: 1, expires_at: '2026-01-12T13:00:00Z' }],
    });

    const result = await sessionDAO.upsertSession({
      sessionId: 'session_1',
      userId: 1,
      conversationId: 1,
      pendingPlanId: 100,
      sessionData: { test: 'data' },
      expiresInSeconds: 3600,
    });

    expect(result.id).toBe('session_1');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ChatSessions'),
      expect.any(Array)
    );
  });

  test('getSession returns active session (not expired)', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'session_1', user_id: 1, pending_plan_id: 100 }],
    });

    const result = await sessionDAO.getSession('session_1');

    expect(result.id).toBe('session_1');
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('expires_at > CURRENT_TIMESTAMP'),
      ['session_1']
    );
  });

  test('deleteSession removes session', async () => {
    query.mockResolvedValue({
      rows: [{ id: 'session_1' }],
    });

    const result = await sessionDAO.deleteSession('session_1');

    expect(result).toBe(true);
  });

  test('cleanupExpiredSessions removes all expired entries', async () => {
    query.mockResolvedValue({
      rowCount: 5,
    });

    const result = await sessionDAO.cleanupExpiredSessions();

    expect(result).toBe(5);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('DELETE FROM ChatSessions WHERE expires_at <= CURRENT_TIMESTAMP')
    );
  });
});
