import express from 'express';
import {
    listFeatures,
    getFeatureById,
    createFeature,
    updateFeature,
    deleteFeature,
    analyzeTraceFeature,
} from '../controller/features/features.js';
import {
    generalApiResponseSender,
    generalApiErrorHandler
} from '../controller/general/tools.js';
import * as auth from '../controller/auth/auth.js';

const router = express.Router();

// 1. List Features - GET /features/list?test_project_id={id}
router.get('/list', async (req, res) => {
    console.log('api: GET /features/list');

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        const result = await listFeatures(b_tokenValidated.userId);
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /features/list:', err);
        generalApiErrorHandler(res, err);
    }
});

// 2. Get Feature By ID - GET /features/:id
router.get('/:id', async (req, res) => {
    console.log('api: GET /features/:id');
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
        const result = await getFeatureById(parseInt(id), myId);
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /features/:id:', err);
        generalApiErrorHandler(res, err);
    }
});

// 3. Create Feature - POST /features/create
router.post('/create', async (req, res) => {
    console.log('api: POST /features/create');
    const { test_project_id, feature_name, feature_description, enabled } = req.body;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        const myId = b_tokenValidated.userId;

        if (!test_project_id || !feature_name) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "test_project_id and feature_name are required"
            });
        }

        const result = await createFeature(
            test_project_id,
            feature_name,
            feature_description,
            enabled,
            myId
        );
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in POST /features/create:', err);
        generalApiErrorHandler(res, err);
    }
});

// 4. Update Feature - PUT /features/update/:id
router.put('/update/:id', async (req, res) => {
    console.log('api: PUT /features/update/:id');
    const { id } = req.params;
    const { displayedName, enabled } = req.body;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        const myId = b_tokenValidated.userId;

        const result = await updateFeature(
            parseInt(id),
            displayedName,
            enabled,
            myId
        );
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in PUT /features/update/:id:', err);
        generalApiErrorHandler(res, err);
    }
});

// 5. Delete Feature - DELETE /features/delete/:id
router.delete('/delete/:id', async (req, res) => {
    console.log('api: DELETE /features/delete/:id');
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
        const result = await deleteFeature(parseInt(id), myId);
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in DELETE /features/delete/:id:', err);
        generalApiErrorHandler(res, err);
    }
});

// 6. Analyze Trace Feature (AI-Powered) - POST /features/analyze
router.post('/analyze', async (req, res) => {
    console.log('api: POST /features/analyze');
    const { trace_id } = req.body;

    try {
        if (!trace_id) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "trace_id is required"
            });
        }

        const result = await analyzeTraceFeature(trace_id);
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in POST /features/analyze:', err);
        generalApiErrorHandler(res, err);
    }
});

export { router as features };
