DROP TABLE IF EXISTS RagProjects CASCADE;

CREATE TABLE RagProjects (
    id SERIAL PRIMARY KEY,
    project_name VARCHAR(255) NOT NULL,
    user_id INT NOT NULL,
    unique_key VARCHAR(255) UNIQUE NOT NULL,
    description TEXT,
    rag_path VARCHAR(255) NOT NULL,
    status INT DEFAULT 0 NOT NULL, -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS RagProjectAccessTokens CASCADE;

CREATE TABLE RagProjectAccessTokens (
    id SERIAL PRIMARY KEY,
    project_id INT NOT NULL,
    source_type INT NOT NULL, -- e.g., 1: cookie, 2: local storage
    source_key VARCHAR(255) NOT NULL,
    source_value_default TEXT,
    header_key VARCHAR(255),
    header_value_template TEXT,
    status INT DEFAULT 0 NOT NULL, -- 0: inactive, 1: active
    deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INT,
    FOREIGN KEY (project_id) REFERENCES RagProjects(id) ON DELETE CASCADE
);

--------------------------------------------
