DROP TABLE IF EXISTS AiCalls CASCADE;
DROP TABLE IF EXISTS TestCases CASCADE;
DROP TABLE IF EXISTS TestCaseRun CASCADE;
DROP TABLE IF EXISTS TestCaseRunAICall CASCADE;
DROP TABLE IF EXISTS TestCaseRunRecords CASCADE;
DROP TABLE IF EXISTS TestCaseDrafts CASCADE;
DROP TABLE IF EXISTS TestCaseDraftAiCalls CASCADE;

-- Table for test cases
CREATE TABLE IF NOT EXISTS TestCases (
	id SERIAL PRIMARY KEY,
	name VARCHAR(255) NOT NULL,
	description TEXT,
	trace_id VARCHAR(100),
	feature_id INT,
	project_id INT DEFAULT 1,
	api_url VARCHAR(500),
	http_method VARCHAR(10),
	body JSONB,
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INT DEFAULT 0
);

-- Table for AI calls within a test case
CREATE TABLE IF NOT EXISTS AiCalls (
	id SERIAL PRIMARY KEY,
	test_case_id INTEGER REFERENCES TestCases(id) ON DELETE CASCADE,
	step_order INTEGER NOT NULL,
	ai_model VARCHAR(255) NOT NULL,
	api_endpoint VARCHAR(255),
	validation_prompt TEXT,
	input JSONB NOT NULL,
	expected_output TEXT NOT NULL,
	output_match_type VARCHAR(50) DEFAULT 'same_meaning', -- e.g. exact, contains, regex, same_meaning
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TestCaseRunRecords (
	id SERIAL PRIMARY KEY,
	test_case_ids INTEGER[] NOT NULL,
	times INTEGER DEFAULT 1,
	status VARCHAR(50) DEFAULT 'pending', -- e.g. pending, running, success, failed
	result JSONB,
	started_at TIMESTAMP,
	completed_at TIMESTAMP,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TestCaseDrafts (
	id SERIAL PRIMARY KEY,
	test_case_id INTEGER REFERENCES TestCases(id) ON DELETE CASCADE,
	test_case_run_record_id INTEGER REFERENCES TestCaseRunRecords(id) ON DELETE SET NULL,
	name VARCHAR(255),
	description TEXT,
	trace_id VARCHAR(100),
	feature_id INT,
	api_url VARCHAR(500),
	http_method VARCHAR(10),
	body JSONB,
	status INT, -- e.g. 0: draft, 1: ready for review, 2: approved, 3: rejected
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TestCaseDraftAiCalls (
	id SERIAL PRIMARY KEY,
	test_case_draft_id INTEGER REFERENCES TestCaseDrafts(id) ON DELETE CASCADE,
	step_order INTEGER NOT NULL,
	ai_model VARCHAR(255) NOT NULL,
	api_endpoint VARCHAR(255),
	input JSONB NOT NULL,
	expected_output TEXT NOT NULL,
	output_match_type VARCHAR(50) DEFAULT 'exact', -- e.g. exact, contains, regex, same_meaning
    deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TestCaseRun (
	id SERIAL PRIMARY KEY,
	test_case_id INTEGER REFERENCES TestCases(id) ON DELETE CASCADE,
	test_case_run_record_id INTEGER REFERENCES TestCaseRunRecords(id) ON DELETE SET NULL,
	is_rerun BOOLEAN DEFAULT FALSE,
	status VARCHAR(50) DEFAULT 'pending', -- e.g. pending, running, success, failed, outdated
	result JSONB,
	started_at TIMESTAMP,
	completed_at TIMESTAMP,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_test_case_run_record_id ON TestCaseRun(test_case_run_record_id);

CREATE TABLE IF NOT EXISTS TestCaseRunAICall (
	id SERIAL PRIMARY KEY,
	test_case_run_id INTEGER REFERENCES TestCaseRun(id) ON DELETE CASCADE,
	ai_call_id INTEGER REFERENCES AiCalls(id) ON DELETE CASCADE,
	ai_model VARCHAR(255),
	api_endpoint VARCHAR(255),
	input JSONB NOT NULL,
	output TEXT,
	validation_score FLOAT,
	failure_reason TEXT,
	status VARCHAR(50) DEFAULT 'pending', -- e.g. pending, success, failed
	human_validation BOOLEAN,
	started_at TIMESTAMP,
	completed_at TIMESTAMP,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);
