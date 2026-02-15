-- =====================================================
-- Trace Post-Analysis System Tables
-- Migration: 2026-01-28
-- Purpose: Add prompt fingerprinting and drift analysis
-- =====================================================

-- Drop tables if they exist (for clean re-run)
DROP TABLE IF EXISTS TraceAnalysisResults CASCADE;
DROP TABLE IF EXISTS PromptFingerprints CASCADE;
DROP TABLE IF EXISTS PromptHashStats CASCADE;

-- =====================================================
-- Table: PromptHashStats
-- Purpose: Track global statistics for prompt hashes
-- =====================================================
CREATE TABLE IF NOT EXISTS PromptHashStats (
    id SERIAL PRIMARY KEY,
    hash_value VARCHAR(64) NOT NULL UNIQUE,
    hash_type VARCHAR(20) NOT NULL CHECK (hash_type IN ('system', 'user', 'combined', 'assistant')),
    seen_count INT DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for fast hash lookups
CREATE INDEX idx_prompt_hash_stats_hash_value ON PromptHashStats(hash_value);
CREATE INDEX idx_prompt_hash_stats_type ON PromptHashStats(hash_type);
CREATE INDEX idx_prompt_hash_stats_seen_count ON PromptHashStats(seen_count DESC);

-- =====================================================
-- Table: PromptFingerprints
-- Purpose: Store prompt version fingerprints with stability classification
-- =====================================================
CREATE TABLE IF NOT EXISTS PromptFingerprints (
    id SERIAL PRIMARY KEY,
    feature_id INT REFERENCES TestProjectFeatures(id) ON DELETE CASCADE,
    prompt_fingerprint VARCHAR(64) NOT NULL,
    combined_system_hash VARCHAR(64),
    combined_user_hash VARCHAR(64),
    model VARCHAR(100),
    temperature DECIMAL(3,2),
    max_tokens INT,
    top_p DECIMAL(3,2),
    tools_enabled BOOLEAN DEFAULT FALSE,
    seen_count INT DEFAULT 1,
    first_seen_at TIMESTAMP DEFAULT NOW(),
    last_seen_at TIMESTAMP DEFAULT NOW(),
    classification VARCHAR(50) CHECK (classification IN ('stable_template', 'unstable', 'ad_hoc', 'pending')),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INT DEFAULT 0,
    UNIQUE(prompt_fingerprint)
);

-- Indexes for performance
CREATE INDEX idx_prompt_fingerprints_feature_id ON PromptFingerprints(feature_id);
CREATE INDEX idx_prompt_fingerprints_fingerprint ON PromptFingerprints(prompt_fingerprint);
CREATE INDEX idx_prompt_fingerprints_classification ON PromptFingerprints(classification);
CREATE INDEX idx_prompt_fingerprints_seen_count ON PromptFingerprints(seen_count DESC);
CREATE INDEX idx_prompt_fingerprints_last_seen ON PromptFingerprints(last_seen_at DESC);

-- =====================================================
-- Table: TraceAnalysisResults
-- Purpose: Store analysis results with root cause attribution
-- =====================================================
CREATE TABLE IF NOT EXISTS TraceAnalysisResults (
    id SERIAL PRIMARY KEY,
    trace_id VARCHAR(255) NOT NULL,
    feature_id INT REFERENCES TestProjectFeatures(id) ON DELETE SET NULL,
    prompt_fingerprint VARCHAR(64),
    previous_fingerprint VARCHAR(64),
    system_prompt_classification VARCHAR(50),
    root_cause VARCHAR(50) CHECK (root_cause IN (
        'SYSTEM_CHANGED',
        'MODEL_INSTABILITY',
        'USER_INTENT_CHANGED',
        'PROMPT_AD_HOC',
        'NO_PREVIOUS_DATA',
        'UNKNOWN'
    )),
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    analysis_details JSONB,
    debug_metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0
);

-- Indexes for fast queries
CREATE INDEX idx_trace_analysis_trace_id ON TraceAnalysisResults(trace_id);
CREATE INDEX idx_trace_analysis_feature_id ON TraceAnalysisResults(feature_id);
CREATE INDEX idx_trace_analysis_fingerprint ON TraceAnalysisResults(prompt_fingerprint);
CREATE INDEX idx_trace_analysis_root_cause ON TraceAnalysisResults(root_cause);
CREATE INDEX idx_trace_analysis_created_at ON TraceAnalysisResults(created_at DESC);
CREATE UNIQUE INDEX idx_trace_analysis_trace_id_unique ON TraceAnalysisResults(trace_id);

-- =====================================================
-- Comments for documentation
-- =====================================================
COMMENT ON TABLE PromptHashStats IS 'Global statistics for tracking prompt hash stability and frequency';
COMMENT ON TABLE PromptFingerprints IS 'Prompt version fingerprints with model parameters and stability classification';
COMMENT ON TABLE TraceAnalysisResults IS 'Post-analysis results for traces with root cause attribution for drift detection';

COMMENT ON COLUMN PromptFingerprints.prompt_fingerprint IS 'SHA-256 hash of: combined_system_hash + model + temperature + max_tokens + tools_enabled';
COMMENT ON COLUMN PromptFingerprints.classification IS 'Stability classification: stable_template (seen often), unstable (occasionally), ad_hoc (once), pending (needs more data)';
COMMENT ON COLUMN TraceAnalysisResults.root_cause IS 'Attribution for why output differs: SYSTEM_CHANGED (prompt modified), MODEL_INSTABILITY (same prompt different output), USER_INTENT_CHANGED (user input changed), PROMPT_AD_HOC (unstable prompt)';
COMMENT ON COLUMN TraceAnalysisResults.confidence_score IS 'Confidence in root cause determination (0.0-1.0): high = stable prompt match, medium = unstable or no history, low = single occurrence';

-- =====================================================
-- Migration Complete
-- =====================================================
