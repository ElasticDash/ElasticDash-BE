-- ElasticDash API - Latest Database Schema
-- This file contains the complete, latest database schema
-- It is safe to run multiple times (uses IF NOT EXISTS and other safeguards)

-- [Step 1] Ensure schema migration table exists
-- This table records the history of each database change, making it easy to track when and what was modified
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,                                               -- Auto-increment ID
    version VARCHAR(255) NOT NULL UNIQUE,                               -- Version number, identifies this change
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,      -- Execution time, auto-recorded
    description TEXT                                                    -- Change description, explains what was modified
);

-- [Step 2] Actual database schema changes
-- Add phone verification field to Users table
-- ALTER TABLE Users ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Add last login IP address field
ALTER TABLE Users ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);

-- [Step 3] Create indexes for new columns to improve query performance
-- Create index for phone_verified field to facilitate querying verified/unverified users
CREATE INDEX IF NOT EXISTS idx_users_phone_verified ON Users(phone_verified);

-- [Step 4] Add data constraints to ensure data quality
-- Add constraints as needed based on business requirements
--
-- Example: JSON format validation
-- ALTER TABLE Users ADD CONSTRAINT IF NOT EXISTS check_user_preferences_json 
-- CHECK (user_preferences IS NULL OR jsonb_typeof(user_preferences) = 'object');

-- [Step 5] Record this change in the migration tracking table
-- Each time this script runs, the record is updated to show the last execution time
INSERT INTO schema_migrations (version, description) 
VALUES ('20250905_latest', 'Added phone_verified and last_login_ip columns to Users table')
ON CONFLICT (version) DO UPDATE SET 
    applied_at = CURRENT_TIMESTAMP,
    description = EXCLUDED.description;

-- Add any future changes here...
-- Example for next change:
-- ALTER TABLE Users ADD COLUMN IF NOT EXISTS new_field VARCHAR(255);
-- INSERT INTO schema_migrations (version, description) 
-- VALUES ('20250905_latest', 'Updated schema with new_field') 
-- ON CONFLICT (version) DO UPDATE SET applied_at = CURRENT_TIMESTAMP;