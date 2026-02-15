import express from 'express';
import {
    getAnalysisResult,
    getPromptFingerprint,
    getFingerprintsByFeature,
    analyzePromptDrift
} from '../controller/traceAnalysis/traceAnalysisController.js';
import { pool } from '../postgres.js';
import {
    generalApiResponseSender,
    generalApiErrorHandler
} from '../controller/general/tools.js';
import * as auth from '../controller/auth/auth.js';

const router = express.Router();

// =====================================================
// 1. GET /trace-analysis/:traceId
// Get analysis result for a specific trace
// =====================================================
router.get('/:traceId', async (req, res) => {
    console.log('api: GET /trace-analysis/:traceId');
    const { traceId } = req.params;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        if (!traceId) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "traceId is required"
            });
        }

        const result = await getAnalysisResult(traceId);

        if (!result) {
            return generalApiErrorHandler(res, {
                status: 404,
                message: "Analysis result not found for this trace"
            });
        }

        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /trace-analysis/:traceId:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 2. GET /trace-analysis/fingerprint/:fingerprint
// Get fingerprint record by hash
// =====================================================
router.get('/fingerprint/:fingerprint', async (req, res) => {
    console.log('api: GET /trace-analysis/fingerprint/:fingerprint');
    const { fingerprint } = req.params;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        if (!fingerprint) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "fingerprint is required"
            });
        }

        const result = await getPromptFingerprint(fingerprint);

        if (!result) {
            return generalApiErrorHandler(res, {
                status: 404,
                message: "Fingerprint not found"
            });
        }

        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /trace-analysis/fingerprint/:fingerprint:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 3. GET /trace-analysis/fingerprints/feature/:featureId
// Get all fingerprints for a feature
// =====================================================
router.get('/fingerprints/feature/:featureId', async (req, res) => {
    console.log('api: GET /trace-analysis/fingerprints/feature/:featureId');
    const { featureId } = req.params;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        if (!featureId) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "featureId is required"
            });
        }

        const result = await getFingerprintsByFeature(parseInt(featureId));
        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /trace-analysis/fingerprints/feature/:featureId:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 4. GET /trace-analysis/drift-history/:featureId
// Get drift history for a feature (all analysis results)
// =====================================================
router.get('/drift-history/:featureId', async (req, res) => {
    console.log('api: GET /trace-analysis/drift-history/:featureId');
    const { featureId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        if (!featureId) {
            return generalApiErrorHandler(res, {
                status: 400,
                message: "featureId is required"
            });
        }

        // Query all analysis results for this feature
        const result = await pool.query(
            `SELECT
                tar.*,
                pf.classification,
                pf.seen_count as fingerprint_seen_count
             FROM TraceAnalysisResults tar
             LEFT JOIN PromptFingerprints pf ON tar.prompt_fingerprint = pf.prompt_fingerprint
             WHERE tar.feature_id = $1
             ORDER BY tar.created_at DESC
             LIMIT $2 OFFSET $3`,
            [parseInt(featureId), parseInt(limit), parseInt(offset)]
        );

        generalApiResponseSender(res, result.rows);
    } catch (err) {
        console.error('Error in GET /trace-analysis/drift-history/:featureId:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 5. GET /trace-analysis/stats/overview
// Get overall statistics for prompt analysis
// =====================================================
router.get('/stats/overview', async (req, res) => {
    console.log('api: GET /trace-analysis/stats/overview');

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        // Get overall statistics
        const stats = await pool.query(`
            SELECT
                COUNT(DISTINCT prompt_fingerprint) as total_fingerprints,
                COUNT(DISTINCT feature_id) as features_with_fingerprints,
                COUNT(*) FILTER (WHERE classification = 'stable_template') as stable_templates,
                COUNT(*) FILTER (WHERE classification = 'unstable') as unstable_prompts,
                COUNT(*) FILTER (WHERE classification = 'ad_hoc') as ad_hoc_prompts,
                COUNT(*) FILTER (WHERE classification = 'pending') as pending_classification,
                AVG(seen_count) as avg_seen_count
            FROM PromptFingerprints
        `);

        const driftStats = await pool.query(`
            SELECT
                COUNT(*) as total_analyses,
                COUNT(DISTINCT feature_id) as features_analyzed,
                COUNT(*) FILTER (WHERE root_cause = 'SYSTEM_CHANGED') as system_changes,
                COUNT(*) FILTER (WHERE root_cause = 'MODEL_INSTABILITY') as model_instabilities,
                COUNT(*) FILTER (WHERE root_cause = 'USER_INTENT_CHANGED') as user_intent_changes,
                COUNT(*) FILTER (WHERE root_cause = 'PROMPT_AD_HOC') as ad_hoc_prompts,
                COUNT(*) FILTER (WHERE root_cause = 'NO_PREVIOUS_DATA') as first_occurrences,
                AVG(confidence_score) as avg_confidence
            FROM TraceAnalysisResults
            WHERE created_at > NOW() - INTERVAL '7 days'
        `);

        const result = {
            fingerprints: stats.rows[0],
            drift_analysis: driftStats.rows[0],
            timestamp: new Date().toISOString()
        };

        generalApiResponseSender(res, result);
    } catch (err) {
        console.error('Error in GET /trace-analysis/stats/overview:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 6. GET /trace-analysis/fingerprints/all
// List all fingerprints with pagination and filtering
// =====================================================
router.get('/fingerprints/all', async (req, res) => {
    console.log('api: GET /trace-analysis/fingerprints/all');
    const {
        limit = 50,
        offset = 0,
        classification = null,
        minSeenCount = null
    } = req.query;

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        // Build WHERE clause
        let whereClause = '1=1';
        const params = [parseInt(limit), parseInt(offset)];
        let paramIndex = 3;

        if (classification) {
            whereClause += ` AND classification = $${paramIndex}`;
            params.push(classification);
            paramIndex++;
        }

        if (minSeenCount) {
            whereClause += ` AND seen_count >= $${paramIndex}`;
            params.push(parseInt(minSeenCount));
            paramIndex++;
        }

        const query = `
            SELECT
                pf.*,
                tpf.feature_name,
                COUNT(tar.id) as analysis_count
            FROM PromptFingerprints pf
            LEFT JOIN TestProjectFeatures tpf ON pf.feature_id = tpf.id
            LEFT JOIN TraceAnalysisResults tar ON pf.prompt_fingerprint = tar.prompt_fingerprint
            WHERE ${whereClause}
            GROUP BY pf.id, tpf.feature_name
            ORDER BY pf.last_seen_at DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await pool.query(query, params);
        generalApiResponseSender(res, result.rows);
    } catch (err) {
        console.error('Error in GET /trace-analysis/fingerprints/all:', err);
        generalApiErrorHandler(res, err);
    }
});

// =====================================================
// 7. GET /trace-analysis/features/at-risk
// Get features with prompt_changed_risk flag
// =====================================================
router.get('/features/at-risk', async (req, res) => {
    console.log('api: GET /trace-analysis/features/at-risk');

    try {
        const b_tokenValidated = await auth.verifyToken(req, res, {});
        if (!b_tokenValidated || b_tokenValidated.statusCode === 401) {
            return generalApiErrorHandler(res, {
                status: 401,
                message: "You haven't logged in or token has expired."
            });
        }

        const result = await pool.query(`
            SELECT
                tpf.*,
                COUNT(DISTINCT pf.prompt_fingerprint) as fingerprint_count,
                MAX(tar.created_at) as last_analysis_at,
                MAX(tar.root_cause) as last_root_cause,
                MAX(tar.confidence_score) as last_confidence
            FROM TestProjectFeatures tpf
            LEFT JOIN PromptFingerprints pf ON tpf.id = pf.feature_id
            LEFT JOIN TraceAnalysisResults tar ON tpf.id = tar.feature_id
            WHERE tpf.prompt_changed_risk = TRUE
              AND tpf.deleted = FALSE
            GROUP BY tpf.id
            ORDER BY MAX(tar.created_at) DESC
        `);

        generalApiResponseSender(res, result.rows);
    } catch (err) {
        console.error('Error in GET /trace-analysis/features/at-risk:', err);
        generalApiErrorHandler(res, err);
    }
});

export default router;
