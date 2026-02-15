-- Table for persona definitions
CREATE TABLE IF NOT EXISTS persona (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_preset BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INT DEFAULT 0,
    deleted BOOLEAN DEFAULT FALSE
);

-- Table for conversation records (from logger DB, but can be referenced here)
CREATE TABLE IF NOT EXISTS conversation (
    id SERIAL PRIMARY KEY,
    external_id VARCHAR(255), -- id from logger DB
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0
);

-- Mapping table between persona and conversation
CREATE TABLE IF NOT EXISTS persona_conversation (
    id SERIAL PRIMARY KEY,
    persona_id INT REFERENCES persona(id) ON DELETE CASCADE,
    conversation_id INT REFERENCES conversation(id) ON DELETE CASCADE,
    estimated_by_llm BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INT DEFAULT 0
);
