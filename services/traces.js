import express from 'express';
import {
  listTraces,
  getTraceDetail,
  deleteTrace,
  listSessions,
  getSessionDetail
} from '../controller/traces.js';
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools';
import * as auth from '../controller/auth/auth';

const router = express.Router();

// List traces with pagination and total count (POST)
router.post('/list', async (req, res) => {
  console.log('api: POST /traces/list');
  const { limit = 100, offset = 0, filter } = req.body || {};
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

      listTraces({ limit, offset, filter, userId: myId })
        .then(result => {
          generalApiResponseSender(res, result);
        })
        .catch(err => {
          console.error('Error status:', err);
          generalApiErrorHandler(res, err);
        });
  } catch (err) {
      console.error('Error status: ', err);
      generalApiErrorHandler(res, err);
  }
});


// List sessions by session_id (POST)
router.post('/sessions/list', async (req, res) => {
  console.log('api: POST /traces/sessions/list');
  const {
    limit = 100,
    offset = 0,
    filterQuery = '',
    filterParams = {},
    searchQuery = '',
    searchParams = {}
  } = req.body || {};
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

      listSessions({ 
        limit, 
        offset, 
        filterQuery, 
        filterParams, 
        searchQuery, 
        searchParams, 
        userId: myId 
      })
        .then(result => {
          generalApiResponseSender(res, result);
        })
        .catch(err => {
          console.error('Error status:', err);
          generalApiErrorHandler(res, err);
        });
  } catch (err) {
      console.error('Error status: ', err);
      generalApiErrorHandler(res, err);
  }
});

// Get all traces for a session
router.get('/sessions/:sessionId', async (req, res) => {
  console.log('api: GET /traces/sessions/:sessionId');
  const { sessionId } = req.params;
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

      getSessionDetail({ sessionId, userId: myId })
        .then(result => {
          generalApiResponseSender(res, result);
        })
        .catch(err => {
          console.error('Error status:', err);
          generalApiErrorHandler(res, err);
        });
  } catch (err) {
      console.error('Error status: ', err);
      generalApiErrorHandler(res, err);
  }
});

// Get trace detail
router.get('/detail/:id', async (req, res) => {
  console.log('api: GET /traces/detail/:id');
  const { id } = req.params;
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

      getTraceDetail({ id, userId: myId })
        .then(result => {
          if (!result) {
            generalApiErrorHandler(res, { message: 'Trace not found' });
          } else {
            generalApiResponseSender(res, result);
          }
        })
        .catch(err => {
          console.error('Error status:', err);
          generalApiErrorHandler(res, err);
        });
  } catch (err) {
      console.error('Error status: ', err);
      generalApiErrorHandler(res, err);
  }
});

// Delete trace
router.delete('/delete/:id', async (req, res) => {
  console.log('api: DELETE /traces/delete/:id');
  const { id } = req.params;
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

      deleteTrace({ id, userId: myId })
        .then(result => {
          if (!result || !result.success) {
            generalApiErrorHandler(res, { message: 'Trace not found' });
          } else {
            generalApiResponseSender(res, { success: true });
          }
        })
        .catch(err => {
          console.error('Error status:', err);
          generalApiErrorHandler(res, err);
        });
  } catch (err) {
      console.error('Error status: ', err);
      generalApiErrorHandler(res, err);
  }
});

export { router as traces };
