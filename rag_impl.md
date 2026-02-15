# RAG Implementation Documentation

## Overview

This document describes the current RAG (Retrieval-Augmented Generation) implementation for the ElasticDash API project management system. The system allows users to create projects, upload API and database documentation, and prepare them for LLM-based querying through a structured staging workflow with draft/active versioning.

## Architecture: Staging Workflow

The system uses a **versioned knowledge base (KB)** model with **draft/active** semantics:

1. **Upload Phase**: User uploads OpenAPI docs and SQL DDL files
2. **Parse Phase**: System parses and upserts to **draft** KB (only mentioned items updated; others preserved)
3. **Review Phase**: User reviews, edits, and generates LLM descriptions in draft
4. **Submit Phase**: User marks draft as submitted
5. **Promote Phase**: User promotes draft → **active** (marks `ready_for_rag`)
6. **Build Phase**: System builds separate RAG files (tables + APIs) and writes to `rags/<uniqueKey>_tables.json` and `rags/<uniqueKey>_apis.json`
7. **Clean Phase**: Draft is deleted after successful promotion

This prevents hallucination by:
- Deriving structure only from user-provided DDL/JSON (no DB introspection)
- Allowing user review/approval before RAG use
- Grounding LLM descriptions to parsed schema
- Maintaining history via soft deletes

## Database Structure

### 1. RagProjects
**Purpose**: Root container for all RAG-related resources.

```sql
CREATE TABLE RagProjects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    unique_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    rag_path VARCHAR(255) NOT NULL,  -- Base path for RAG files (rags/<uniqueKey>)
    status INT DEFAULT 0 NOT NULL,   -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT
);
```

**Fields**:
- `project_name`: Human-readable name for the project
- `user_id`: Owner of the project
- `unique_key`: Unique identifier for file naming and external references
- `description`: Optional project description
- `rag_path`: Base path to RAG files (e.g., `rags/my-project`; actual files use `_tables.json` and `_apis.json` suffixes)
- `status`: 0 = inactive, 1 = active

---

### 2. RagKnowledgeBaseDatabases
**Purpose**: Tracks database metadata and connection secrets (non-versioned, one per project).

```sql
CREATE TABLE RagKnowledgeBaseDatabases (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    db_type VARCHAR(50) NOT NULL,        -- 'postgres' | 'mysql' | 'mssql' | etc.
    secret_id TEXT NOT NULL,             -- AWS Secrets Manager secret name (NOT connection string)
    description TEXT,                    -- optional notes about this database
    status INT DEFAULT 1,                -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    UNIQUE(project_id, deleted)          -- one active database per project
);
```

**Security Model**: 
- Connection strings are **NOT** stored in this table
- `secret_id` references AWS Secrets Manager
- This separation allows RAG metadata to be stored separately from credentials

---

### 3. RagKnowledgeBaseTables (Versioned)
**Purpose**: Documents individual tables within a database, with draft/active versioning.

```sql
CREATE TABLE RagKnowledgeBaseTables (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    database_id INT,                      -- links to RagKnowledgeBaseDatabases (optional)
    table_name VARCHAR(255) NOT NULL,
    kb_version VARCHAR(20) NOT NULL,      -- 'draft' | 'active'
    description TEXT,                     -- user-provided brief summary
    schema_source VARCHAR(50) DEFAULT 'ddl', -- 'ddl' | 'json' | 'inferred'
    schema_json JSONB NOT NULL,           -- parsed structure: columns, types, constraints
    pk_columns TEXT[],                    -- primary key columns
    fk_relations JSONB,                   -- [{column, ref_table, ref_column}]
    generated_txt TEXT,                   -- LLM-generated human-readable description
    generation_status VARCHAR(50),        -- 'pending' | 'generated' | 'error'
    submission_status VARCHAR(50),        -- 'editing' | 'submitted'
    ready_for_rag BOOLEAN DEFAULT FALSE,  -- TRUE only for active version when promoted
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    FOREIGN KEY (database_id) REFERENCES RagKnowledgeBaseDatabases(id) ON DELETE SET NULL,
    UNIQUE(project_id, table_name, kb_version, deleted)
);
```

**Key Features**:
- **Versioning**: Separate draft and active records per table
- **Schema Parsing**: `schema_json` stores parsed DDL (columns, types, PK/FK)
- **LLM Generation**: `generated_txt` holds Claude-generated description
- **Workflow Tracking**: `generation_status` and `submission_status` track progress
- **RAG Readiness**: `ready_for_rag` indicates approval for RAG embedding

---

### 4. RagKnowledgeBaseApis (Versioned)
**Purpose**: Documents API endpoints for LLM calls, with draft/active versioning.

```sql
CREATE TABLE RagKnowledgeBaseApis (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    api_path TEXT NOT NULL,               -- e.g., '/users/{id}'
    api_method VARCHAR(10) NOT NULL,      -- 'GET' | 'POST' | 'PUT' | 'DELETE'
    kb_version VARCHAR(20) NOT NULL,      -- 'draft' | 'active'
    openapi_operation JSONB NOT NULL,     -- full OpenAPI operation (summary, params, responses, etc.)
    submission_status VARCHAR(50),        -- 'editing' | 'submitted'
    ready_for_rag BOOLEAN DEFAULT FALSE,  -- TRUE only for active version when promoted
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE,
    UNIQUE(project_id, api_path, api_method, kb_version, deleted)
);
```

**Key Features**:
- **Versioning**: Separate draft and active records per API endpoint
- **OpenAPI Integration**: Stores complete OpenAPI operation specification
- **Workflow Tracking**: Same submission and RAG-readiness flow as tables

---

### 5. RagProjectAccessTokens
**Purpose**: Manages authentication tokens required for API calls.

```sql
CREATE TABLE RagProjectAccessTokens (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    source_type INT NOT NULL,             -- 1: cookie, 2: local storage
    source_key VARCHAR(255) NOT NULL,
    source_value_default TEXT,            -- default value if not found
    header_key VARCHAR(255),              -- HTTP header name (e.g., 'Authorization')
    header_value_template TEXT,           -- template for header value (e.g., 'Bearer {token}')
    status INT DEFAULT 0 NOT NULL,        -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE
);
```

**Use Case**: Defines how LLM extracts and formats authentication tokens for API calls.

---

## API Endpoints

### Projects
- `POST /project/projects` - Create a new RAG project
- `GET /project/projects` - List all user's projects
- `GET /project/projects/:projectId` - Get single project details
- `PUT /project/projects/:projectId` - Update project
- `DELETE /project/projects/:projectId` - Delete project (soft delete)

### Databases
- `POST /project/databases` - Add database to project (stores connection secret in AWS Secrets Manager)
- `GET /project/projects/:projectId/databases` - List project databases
- `PUT /project/databases/:databaseId` - Update database
- `DELETE /project/databases/:databaseId` - Delete database (soft delete)

### Access Tokens
- `POST /project/access-tokens` - Configure authentication
- `GET /project/projects/:projectId/access-tokens` - List auth configs
- `PUT /project/access-tokens/:tokenId` - Update auth config
- `DELETE /project/access-tokens/:tokenId` - Delete auth config

### Knowledge Base Staging (Draft/Active Versioning)
- `POST /project/kb/upload-openapi` - Upload OpenAPI spec → parse and upsert to draft
- `POST /project/kb/upload-sql` - Upload SQL DDL → parse and upsert to draft
- `GET /project/kb/draft/tables?projectId=N` - List draft tables for review
- `GET /project/kb/active/tables?projectId=N` - List active (approved) tables
- `GET /project/kb/tables/:id` - Get single draft table
- `PUT /project/kb/tables/:id` - Edit draft table (schema, description, generated_txt)
- `POST /project/kb/tables/:id/generate` - Trigger LLM generation of table description
- `POST /project/kb/submit` - Mark draft KB as submitted (ready for promotion)
- `POST /project/kb/update-rag` - Promote draft → active and build RAG files
- `POST /project/kb/discard-draft` - Discard draft, reset from active
- `POST /project/kb/build-rag` - Build separate RAG files from active KB

---

## RAG Build Process

### Build-RAG Endpoint: `POST /project/kb/build-rag`

**Request**:
```json
{
  "projectId": 1
}
```

**Response**:
```json
{
  "success": true,
  "ragPathBase": "rags/my-project",
  "ragPathTables": "rags/my-project_tables.json",
  "ragPathApis": "rags/my-project_apis.json",
  "tableCount": 5,
  "apiCount": 12
}
```

**Process**:
1. Promote draft → active (marks `ready_for_rag = TRUE`)
2. Delete all draft rows (soft delete)
3. Fetch all active tables and APIs
4. For each table: embed schema and generated_txt
5. For each API: embed OpenAPI operation
6. Write separate files:
   - `rags/<uniqueKey>_tables.json` — vectorized table schemas
   - `rags/<uniqueKey>_apis.json` — vectorized API specs
7. Update project.rag_path to base path
8. Remove old RAG files if path changed

**RAG File Format**:
```json
[
  {
    "id": "table-customers",
    "type": "table",
    "content": "Schema description with columns, types, PK/FK, and examples",
    "embedding": [0.123, -0.456, ...]
  },
  ...
]
```

---

## Current Workflow Example

### 1. Create Project
```javascript
POST /project/projects
{
  "projectName": "Customer Analytics",
  "uniqueKey": "cust-analytics-001",
  "description": "Customer data queries"
}
// Response: { id: 1, rag_path: "rags/cust-analytics-001", ... }
```

### 2. Upload Docs
```javascript
// Upload OpenAPI spec
POST /project/kb/upload-openapi
{
  "projectId": 1,
  "openapi": { paths: { "/customers/{id}": { get: {...} } } }
}

// Upload SQL DDL
POST /project/kb/upload-sql
{
  "projectId": 1,
  "databaseId": 1,
  "ddlText": "CREATE TABLE customers (id INT, email VARCHAR...)"
}
```

### 3. Review & Approve
```javascript
// List draft tables
GET /project/kb/draft/tables?projectId=1

// Edit table description
PUT /project/kb/tables/5
{
  "description": "Customer records with purchase history"
}

// Generate LLM description
POST /project/kb/tables/5/generate

// View generated text and approve
GET /project/kb/tables/5
// Response: { generated_txt: "..." }
```

### 4. Submit & Build RAG
```javascript
// Submit draft for promotion
POST /project/kb/submit
{
  "projectId": 1
}

// Build RAG files (draft → active → files)
POST /project/kb/build-rag
{
  "projectId": 1
}
// Response: tables in rags/cust-analytics-001_tables.json, apis in rags/cust-analytics-001_apis.json
```

---

## Implementation Details

### SQL DDL Parsing
- **File**: `controller/project/staging.js` → `parseSqlDdl()`
- **Approach**: Postgres-first regex parser
- **Output**: Extracts columns, types, constraints, PK/FK relations
- **Limitations**: Supports PostgreSQL syntax; graceful error handling for unsupported dialects

### LLM Description Generation
- **File**: `controller/project/staging.js` → `generateTableTxt()`
- **Provider**: Claude via `sendRequestToClaudeAI()`
- **Prompt**: `src/prompt_sql_table_description.md` (grounded to parsed schema)
- **Output**: Human-readable table description stored in `generated_txt`

### Versioned KB Logic
- **Draft/Active Semantics**: 
  - Each upload updates ONLY mentioned items in draft
  - Other items in draft are preserved (not deleted)
  - Promotion deletes old active, copies draft → active
  - Discard deletes draft, copies active → draft (reset)

### RAG File Output
- **Location**: `rags/<uniqueKey>_tables.json` and `rags/<uniqueKey>_apis.json`
- **Format**: JSON array of vectorized items (with embeddings if OpenAI available)
- **Embeddings**: Generated via OpenAI API (optional; null if unavailable)
- **Fallback**: If embedding fails, items still included with null embedding

---

## Security Considerations

1. **Never store connection strings in database**
   - Use `secret_id` to reference AWS Secrets Manager
   - Rotate secrets without updating RAG metadata

2. **User isolation**
   - All queries verify `user_id` ownership
   - Cascading deletes prevent data leaks

3. **API token handling**
   - `source_value_default` only for development
   - Production should fetch tokens from secure client-side storage

4. **SQL injection prevention**
   - All database queries use parameterized statements
   - LLM-generated SQL should be validated before execution

---

## Future Improvements

### Phase 1: Enhanced Documentation (Planned)
- [ ] Add sample queries to table documentation
- [ ] Add request/response examples to API documentation
- [ ] Support schema inference from uploaded sample data

### Phase 2: Advanced RAG
- [ ] Implement semantic search over embeddings
- [ ] Build LLM agent to query databases and call APIs
- [ ] Add feedback loop for improving descriptions

### Phase 3: Automation
- [ ] Automatic schema discovery from databases (requires secure connection)
- [ ] OpenAPI spec generation from API calls
- [ ] Query optimization and result caching

---

## Conclusion

The current implementation provides a safe, user-controlled staging workflow for RAG preparation. Key strengths:

1. ✅ **Safety**: No DB introspection; only user-provided docs used
2. ✅ **Control**: Draft/active versioning allows review before RAG use
3. ✅ **Flexibility**: Supports mixed databases and APIs in one project
4. ✅ **Security**: Connection strings secured via AWS Secrets Manager

Main areas for enhancement:

1. 📈 **Documentation Enrichment**: Sample queries, examples, relationships
2. 📈 **Semantic Search**: Vector search over embeddings
3. 📈 **Automation**: Async building, batch processing for large KBs
