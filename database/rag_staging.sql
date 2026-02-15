-- Version-based knowledge base schema: supports draft and active versions
-- Users upload docs → parsed into draft → user reviews/edits → submits → promotes to active (ready for RAG)

DROP TABLE IF EXISTS RagKnowledgeBaseTables CASCADE;
DROP TABLE IF EXISTS RagKnowledgeBaseApis CASCADE;
DROP TABLE IF EXISTS RagKnowledgeBaseDatabases CASCADE;

-- Database metadata for each project (non-versioned, current configuration)
-- Tracks which database this project's tables come from and where to find the connection secret
CREATE TABLE IF NOT EXISTS RagKnowledgeBaseDatabases (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    db_type VARCHAR(50) NOT NULL, -- 'postgres' | 'mysql' | 'mssql' | etc.
    secret_id TEXT NOT NULL, -- AWS Secrets Manager secret name (NOT the actual connection string)
    description TEXT, -- optional notes about this database
    status INT DEFAULT 1, -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    UNIQUE(project_id, deleted) -- one active database per project (soft delete allows history)
);

-- Table entries with version tracking (draft vs active)
CREATE TABLE IF NOT EXISTS RagKnowledgeBaseTables (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    tags VARCHAR(50)[], -- user-defined tags for categorization
    database_id INT, -- foreign key to RagKnowledgeBaseDatabases (optional, could be null if schema is from OpenAPI or other source)
    table_name VARCHAR(255) NOT NULL,
    kb_version VARCHAR(20) NOT NULL, -- 'draft' | 'active'
    description TEXT, -- optional brief summary provided by user
    schema_source VARCHAR(50) DEFAULT 'ddl', -- 'ddl' | 'json' | 'inferred'
    schema_json JSONB NOT NULL, -- parsed structure: columns, types, constraints
    pk_columns TEXT[],
    fk_relations JSONB, -- [{column, ref_table, ref_column}]
    generated_txt TEXT, -- LLM-generated human-readable description
    generation_status VARCHAR(50) DEFAULT 'pending', -- 'pending' | 'generated' | 'error'
    submission_status VARCHAR(50) DEFAULT 'editing', -- 'editing' | 'submitted'
    ready_for_rag BOOLEAN DEFAULT FALSE, -- TRUE only for active version when promoted
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    FOREIGN KEY (database_id) REFERENCES RagKnowledgeBaseDatabases(id) ON DELETE SET NULL,
    UNIQUE(project_id, table_name, kb_version, deleted) -- one draft and one active per table
);

-- API entries with version tracking (draft vs active)
CREATE TABLE IF NOT EXISTS RagKnowledgeBaseApis (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    api_path TEXT NOT NULL,
    description TEXT,
    tags VARCHAR(50)[], -- extracted from OpenAPI spec
    api_method VARCHAR(10) NOT NULL,
    kb_version VARCHAR(20) NOT NULL, -- 'draft' | 'active'
    openapi_operation JSONB NOT NULL, -- operation detail (summary, parameters, request/response)
    submission_status VARCHAR(50) DEFAULT 'editing', -- 'editing' | 'submitted'
    ready_for_rag BOOLEAN DEFAULT FALSE, -- TRUE only for active version when promoted
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    UNIQUE(project_id, api_path, api_method, kb_version, deleted) -- one draft and one active per API endpoint
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_kb_tables_project_version ON RagKnowledgeBaseTables(project_id, kb_version);
CREATE INDEX IF NOT EXISTS idx_kb_apis_project_version ON RagKnowledgeBaseApis(project_id, kb_version);
CREATE INDEX IF NOT EXISTS idx_kb_tables_ready ON RagKnowledgeBaseTables(ready_for_rag) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_kb_apis_ready ON RagKnowledgeBaseApis(ready_for_rag) WHERE deleted = FALSE;
