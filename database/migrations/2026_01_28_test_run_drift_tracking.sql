-- =====================================================
-- Test Run Drift Tracking Enhancement
-- Migration: 2026-01-28
-- Purpose: Add prompt drift tracking to test execution
-- =====================================================

-- =====================================================
-- 1. Add prompt fingerprint tracking to TestCases
-- =====================================================
ALTER TABLE TestCases
ADD COLUMN IF NOT EXISTS prompt_fingerprint VARCHAR(64),
ADD COLUMN IF NOT EXISTS prompt_fingerprint_updated_at TIMESTAMP;

-- Index for fast fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_test_cases_prompt_fingerprint
ON TestCases(prompt_fingerprint);

-- Comment
COMMENT ON COLUMN TestCases.prompt_fingerprint IS 'Prompt fingerprint when test case was created/last updated';
COMMENT ON COLUMN TestCases.prompt_fingerprint_updated_at IS 'Timestamp when prompt fingerprint was last recorded';

-- =====================================================
-- 2. Add drift detection to TestCaseRun
-- =====================================================
ALTER TABLE TestCaseRun
ADD COLUMN IF NOT EXISTS prompt_fingerprint_at_run VARCHAR(64),
ADD COLUMN IF NOT EXISTS prompt_drift_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prompt_drift_severity VARCHAR(20) CHECK (prompt_drift_severity IN ('none', 'low', 'medium', 'high'));

-- Indexes for filtering and querying
CREATE INDEX IF NOT EXISTS idx_test_case_run_drift_detected
ON TestCaseRun(prompt_drift_detected);

CREATE INDEX IF NOT EXISTS idx_test_case_run_drift_severity
ON TestCaseRun(prompt_drift_severity);

-- Comments
COMMENT ON COLUMN TestCaseRun.prompt_fingerprint_at_run IS 'Prompt fingerprint at the time of test execution';
COMMENT ON COLUMN TestCaseRun.prompt_drift_detected IS 'Whether prompt drift was detected compared to original test case';
COMMENT ON COLUMN TestCaseRun.prompt_drift_severity IS 'Severity of prompt drift: none, low, medium, high';

-- =====================================================
-- 3. Add drift risk tracking to TestCaseRunAICall
-- =====================================================
ALTER TABLE TestCaseRunAICall
ADD COLUMN IF NOT EXISTS prompt_drift_risk BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS prompt_drift_details JSONB;

-- Index for filtering at-risk AI calls
CREATE INDEX IF NOT EXISTS idx_test_case_run_ai_call_drift_risk
ON TestCaseRunAICall(prompt_drift_risk);

-- GIN index for JSONB queries
CREATE INDEX IF NOT EXISTS idx_test_case_run_ai_call_drift_details
ON TestCaseRunAICall USING GIN(prompt_drift_details);

-- Comments
COMMENT ON COLUMN TestCaseRunAICall.prompt_drift_risk IS 'Whether this AI call is at risk due to prompt drift';
COMMENT ON COLUMN TestCaseRunAICall.prompt_drift_details IS 'Detailed information about prompt drift: root_cause, confidence_score, original_classification, current_classification, warning';

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verification queries (optional - for testing)
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'testcases' AND column_name LIKE 'prompt%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'testcaserun' AND column_name LIKE 'prompt%';
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'testcaserunacall' AND column_name LIKE 'prompt%';
