import express from 'express';
import * as testCaseController from '../controller/testcases/testCaseController.js';
import testCaseValidator from '../controller/testcases/testCaseValidator.js';
import * as auth from '../controller/auth/auth.js';
import { t } from '../src/constants.js';
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools.js';

const router = express.Router();

// Create test case
router.post('/create', async (req, res) => {
  console.log('api: POST /testcases/create');
  console.log('Calling: createTestCase');
  const { name, description, created_by } = req.body;
  try {
    if (!testCaseValidator.validateTestCase(req.body)) {
      return generalApiErrorHandler(res, { status: 400, message: t('testCase.invalidInput') });
    }
    const testCase = await testCaseController.createTestCase({ name, description, created_by });
    generalApiResponseSender(res, testCase);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Edit test case
router.put('/edit/:id', async (req, res) => {
  console.log('api: PUT /testcases/edit/' + req.params.id);
  console.log('Calling: editTestCase');
  const { id } = req.params;
  const { name, description, updated_by } = req.body;
  try {
    if (!testCaseValidator.validateTestCase(req.body)) {
      return generalApiErrorHandler(res, { status: 400, message: t('testCase.invalidInput') });
    }
    const testCase = await testCaseController.editTestCase({ id, name, description, updated_by });
    generalApiResponseSender(res, testCase);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// List test cases
router.post('/list', async (req, res) => {
  console.log('api: POST /testcases/list');
  console.log('Calling: listTestCases');
  const { limit = 100, offset = 0, filter = '', search = '' } = req.body || {};
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    req.body.userId = myId; // Attach validated userId to req body

    const cases = await testCaseController.listTestCases({ limit, offset, filter, search, myId });
    generalApiResponseSender(res, cases);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Delete test case
router.delete('/delete/:id', async (req, res) => {
  console.log('api: DELETE /testcases/delete/' + req.params.id);
  console.log('Calling: deleteTestCase');
  const { id } = req.params;
  try {
    await testCaseController.deleteTestCase(id);
    generalApiResponseSender(res, { success: true });
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Get test case detail (with ai calls)
router.get('/detail/:id', async (req, res) => {
  console.log('api: GET /testcases/detail/' + req.params.id);
  console.log('Calling: getTestCaseDetail');
  const { id } = req.params;
  try {
    const detail = await testCaseController.getTestCaseDetail(id);
    generalApiResponseSender(res, detail);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Create AI call for a test case
router.post('/aicalls/:id', async (req, res) => {
  console.log('api: POST /testcases/aicalls/' + req.params.id);
  console.log('Calling: createAiCall');
  const { id } = req.params;
  const { step_order, ai_model, api_endpoint, input, expected_output, output_match_type, created_by } = req.body;
  try {
    if (!testCaseValidator.validateAiCall({ ...req.body, test_case_id: id })) {
      return generalApiErrorHandler(res, { status: 400, message: t('testCase.invalidAiCallInput') });
    }
    const aiCall = await testCaseController.createAiCall({
      test_case_id: id,
      step_order,
      ai_model,
      api_endpoint,
      input,
      expected_output,
      output_match_type,
      created_by
    });
    generalApiResponseSender(res, aiCall);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Edit AI call
router.put('/aicalls/update/:aiCallId', async (req, res) => {
  console.log('api: PUT /testcases/aicalls/update/' + req.params.aiCallId);
  console.log('Calling: editAiCall');
  const { aiCallId } = req.params;
  const { step_order, ai_model, api_endpoint, input, expected_output, output_match_type, updated_by } = req.body;
  try {
    if (!testCaseValidator.validateAiCall(req.body)) {
      return generalApiErrorHandler(res, { status: 400, message: t('testCase.invalidAiCallInput') });
    }
    const aiCall = await testCaseController.editAiCall({
      id: aiCallId,
      step_order,
      ai_model,
      api_endpoint,
      input,
      expected_output,
      output_match_type,
      updated_by
    });
    generalApiResponseSender(res, aiCall);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Delete AI call
router.delete('/aicalls/:aiCallId', async (req, res) => {
  console.log('api: DELETE /testcases/aicalls/' + req.params.aiCallId);
  console.log('Calling: deleteAiCall');
  const { aiCallId } = req.params;
  try {
    await testCaseController.deleteAiCall(aiCallId);
    generalApiResponseSender(res, { success: true });
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Update validation_prompt for AI call
router.put('/aicalls/validation-prompt', async (req, res) => {
  console.log('api: PUT /testcases/aicalls/validation-prompt');
  console.log('Calling: updateAiCallValidationPrompt');
  const { aiCallId, validationPrompt } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;

    const aiCall = await testCaseController.updateAiCallValidationPrompt({
      id: aiCallId,
      validation_prompt: validationPrompt,
      updated_by: myId
    });
    generalApiResponseSender(res, aiCall);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Create test case from traces by session id
router.post('/fromtrace', async (req, res) => {
  console.log('api: POST /testcases/fromtrace');
  console.log('body: ', req.body);
  const { traceId, name, description } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
        return generalApiErrorHandler(res, {
            status: 401,
            message: "You haven't logged in or token has expired."
        });
    }
    const myId = b_tokenValidated.userId;
    if (!traceId) {
      return generalApiErrorHandler(res, { status: 400, message: t('testCase.sessionIdRequired') });
    }
    const result = await testCaseController.createTestCaseFromTrace({ traceId, name, description, createdBy: myId });
    if (!result || result.success === false) {
      return generalApiErrorHandler(res, { status: 400, message: result.error || t('testCase.createFromTraceFailed') });
    }
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Create a test case run
router.post('/run', async (req, res) => {
  console.log('api: POST /testcases/run');
  const { id } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
        return generalApiErrorHandler(res, {
            status: 401,
            message: "You haven't logged in or token has expired."
        });
    }
    const myId = b_tokenValidated.userId;
    const run = await testCaseController.createTestCaseRun({ testCaseId: id, createdBy: myId });
    generalApiResponseSender(res, run);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// List all test case runs
router.get('/runs', async (req, res) => {
  console.log('api: GET /testcases/runs');
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
        return generalApiErrorHandler(res, {
            status: 401,
            message: "You haven't logged in or token has expired."
        });
    }
    const myId = b_tokenValidated.userId;
    const runs = await testCaseController.listTestCaseRuns(myId);
    generalApiResponseSender(res, runs);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Get test case run details (AI calls and results)
router.get('/runs/:runId', async (req, res) => {
  console.log('api: GET /testcases/runs/' + req.params.runId);
  const { runId } = req.params;
  try {
    const detail = await testCaseController.getTestCaseRunDetail(runId);
    if (!detail) {
      return generalApiErrorHandler(res, { status: 404, message: t('testCase.runNotFound') });
    }
    generalApiResponseSender(res, detail);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Create test case run record (batch execution)
router.post('/runrecords/create', async (req, res) => {
  console.log('api: POST /testcases/runrecords/create');
  const { test_case_ids, times } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;

    const record = await testCaseController.createTestCaseRunRecord({
      testCaseIds: test_case_ids,
      times: times,
      createdBy: myId
    });
    generalApiResponseSender(res, record);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// List all test case run records
router.get('/runrecords/list', async (req, res) => {
  console.log('api: GET /testcases/runrecords/list');
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const records = await testCaseController.listTestCaseRunRecords(myId);
    generalApiResponseSender(res, records);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

router.put('/runrecords/aicall/approve', async (req, res) => {
  console.log('api: PUT /testcases/runrecords/aicall/approve witn body:', req.body);
  const { testCaseRunAICallId, approved } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const result = await testCaseController.humanApproveTestCaseRunAICall({
      testCaseRunAICallId,
      approved,
      reviewerId: myId
    });
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Get test case run record detail
router.get('/runrecords/detail/:id', async (req, res) => {
  console.log('api: GET /testcases/runrecords/detail/' + req.params.id);
  const { id } = req.params;
  try {
    const detail = await testCaseController.getTestCaseRunRecordDetail(id);
    generalApiResponseSender(res, detail);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Reset test case flow from project URL and trace metadata
router.post('/reset', async (req, res) => {
  console.log('api: POST /testcases/reset');
  const { testCaseId, testCaseRunRecordId = 0 } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const result = await testCaseController.resetTestCaseFlow({ testCaseId, testCaseRunRecordId, userId: myId });
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// List test case drafts by test case run record ID
router.get('/drafts/list', async (req, res) => {
  console.log('api: GET /testcases/drafts/list');
  const { testCaseRunRecordId, testCaseId } = req.query;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    let drafts;
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }

    const myId = b_tokenValidated.userId;

    if (!testCaseRunRecordId && !testCaseId) {
      return generalApiErrorHandler(res, {
        status: 400,
        message: 'testCaseRunRecordId or testCaseId query parameter is required'
      });
    }

    if (testCaseId) {
      drafts = await testCaseController.listTestCaseDraftsByTestCaseId(testCaseId, myId);
      generalApiResponseSender(res, drafts);
      return;
    }

    drafts = await testCaseController.listTestCaseDrafts(testCaseRunRecordId);
    generalApiResponseSender(res, drafts);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Get test case draft detail
router.get('/drafts/:draftId', async (req, res) => {
  console.log('api: GET /testcases/drafts/' + req.params.draftId);
  const { draftId } = req.params;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }

    const detail = await testCaseController.getTestCaseDraftDetail(draftId);
    generalApiResponseSender(res, detail);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Approve a test case draft
router.post('/drafts/:draftId/approve', async (req, res) => {
  console.log('api: POST /testcases/drafts/' + req.params.draftId + '/approve');
  const { draftId } = req.params;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;

    const result = await testCaseController.approveDraft(draftId, myId);
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Reject a test case draft
router.post('/drafts/:draftId/reject', async (req, res) => {
  console.log('api: POST /testcases/drafts/' + req.params.draftId + '/reject');
  const { draftId } = req.params;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;

    const result = await testCaseController.rejectDraft(draftId, myId);
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Accept a rerun and update AI calls
router.post('/rerun/accept', async (req, res) => {
  console.log('api: POST /testcases/rerun/accept');
  const { testCaseRunId } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const result = await testCaseController.acceptTestCaseRerun({ testCaseRunId, userId: myId });
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Accept a rerun and update AI calls
router.post('/rerun/reject', async (req, res) => {
  console.log('api: POST /testcases/rerun/reject');
  const { testCaseRunId } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const result = await testCaseController.rejectTestCaseRerun({ testCaseRunId, userId: myId });
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

// Create new test case by rerun
router.post('/rerun/createtestcase', async (req, res) => {
  console.log('api: POST /testcases/rerun/createtestcase');
  const { testCaseRunId, name } = req.body;
  try {
    const b_tokenValidated = await auth.verifyToken(req, res, {});
    if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "You haven't logged in or token has expired."
      });
    }
    const myId = b_tokenValidated.userId;
    const result = await testCaseController.createTestCaseByRerun({ testCaseRunId, name, userId: myId });
    generalApiResponseSender(res, result);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

router.post('/supportedaimodels/list', async (req, res) => {
  console.log('api: POST /testcases/supportedaimodels/list');
  const search = req.body.search || '';

  try {
    const models = await testCaseController.listSupportedAiModels(search);
    generalApiResponseSender(res, models);
  } catch (err) {
    console.error('API Call failed, error: ', err);
    generalApiErrorHandler(res, err);
  }
});

export { router as testCase };
