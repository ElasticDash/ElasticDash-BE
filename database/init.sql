DROP TABLE IF EXISTS Users CASCADE;

CREATE TABLE Users (
	id SERIAL PRIMARY KEY,
	role_id INT, -- 1: Admin, 2: User
	username VARCHAR(100),
	email VARCHAR(200),
	email_verified BOOLEAN DEFAULT FALSE,
	validating_code VARCHAR(6),
	phone_number VARCHAR(20),
	password TEXT,
	business_name VARCHAR(100),
	gst_number VARCHAR(20),
	nzbn VARCHAR(20),
	company_address_line_1 VARCHAR(200),
	company_address_line_2 VARCHAR(200),
	company_city VARCHAR(100),
	company_state VARCHAR(100),
	company_zip_code VARCHAR(20),
	company_country_id INT,
	agent_number INT DEFAULT 1,
	full_name VARCHAR(100),
	photo_url VARCHAR(200),
	country VARCHAR(100),
	logged_in BOOLEAN DEFAULT FALSE,
	last_active TIMESTAMP DEFAULT NOW(),
	last_login_time TIMESTAMP DEFAULT NOW(),
	active BOOLEAN DEFAULT TRUE,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS DatabaseConnections CASCADE;

CREATE TABLE DatabaseConnections (
	id SERIAL PRIMARY KEY,
	user_id INT,
	connection_string TEXT,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS TestProjects CASCADE;

CREATE TABLE TestProjects (
	id SERIAL PRIMARY KEY,
	user_id INT,
	name VARCHAR(200),
	description TEXT,
	project_id VARCHAR(100),
	api_base_url VARCHAR(200),
	oauth_token VARCHAR(255),
	llm_token VARCHAR(255),
	llm_provider_id INT DEFAULT 1,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

INSERT INTO TestProjects
(user_id, name, description, project_id, api_base_url)
VALUES
(2, 'Demo Project 1', 'This is a demo test project.', 'project-id', 'https://demo.elasticdash.com');

--------------------------------------------

DROP TABLE IF EXISTS TestProjectLlms CASCADE;

CREATE TABLE TestProjectLlms (
	id SERIAL PRIMARY KEY,
	project_id INT,
	llm_token VARCHAR(255),
	llm_provider_id INT DEFAULT 1,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS BillingAddresses CASCADE;

CREATE TABLE BillingAddresses (
	id SERIAL PRIMARY KEY,
	user_id INT,
	full_name VARCHAR(100),
	phone_number VARCHAR(20),
	address_line_1 VARCHAR(200),
	address_line_2 VARCHAR(200),
	city VARCHAR(100),
	state VARCHAR(100),
	zip_code VARCHAR(20),
	country_id INT,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS CreditCards CASCADE;

CREATE TABLE CreditCards (
	id SERIAL PRIMARY KEY,
	user_id INT,
	last_4_digits VARCHAR(20),
	stripe_customer_id VARCHAR(100),
	stripe_card_id VARCHAR(100),
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS UserApiTokens CASCADE;

CREATE TABLE UserApiTokens (
	id SERIAL PRIMARY KEY,
	user_id INT,
	token VARCHAR(200),
	status INT DEFAULT 1, -- 1: Active, 2: Inactive
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT NOT NULL,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT NOT NULL
);

--------------------------------------------

DROP TABLE IF EXISTS EmailVerifyLinks CASCADE;

CREATE TABLE EmailVerifyLinks (
	id SERIAL PRIMARY KEY NOT NULL,
	email VARCHAR(200),
	new_email VARCHAR(200),
	url VARCHAR(200),
	code VARCHAR(6),
	user_id INT,
	user_type INT DEFAULT 1,
	used BOOLEAN DEFAULT FALSE,
	deleted BOOLEAN DEFAULT FALSE,
	valid_before TIMESTAMP NOT NULL,
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

--------------------------------------------

DROP TABLE IF EXISTS Roles CASCADE;

CREATE TABLE Roles (
	id SERIAL PRIMARY KEY,
	name TEXT,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

INSERT INTO Roles (id, name)
VALUES 
(1, 'Admin'),
(2, 'User');

--------------------------------------------

DROP TABLE IF EXISTS ResetPasswordUrls CASCADE;

CREATE TABLE ResetPasswordUrls (
	id SERIAL PRIMARY KEY,
	user_id INT NOT NULL,
	alternative_id INT,
	url VARCHAR(200) NOT NULL,
	valid BOOLEAN DEFAULT TRUE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

--------------------------------------------

DROP TABLE IF EXISTS UnsubscriptionUniqueUrls CASCADE;

CREATE TABLE UnsubscriptionUniqueUrls (
	id SERIAL PRIMARY KEY,
	email VARCHAR(200) NOT NULL,
	url VARCHAR(200) NOT NULL,
	user_id INT,
	used BOOLEAN DEFAULT FALSE,
	user_type INT DEFAULT 2, -- 2: User, 1: Undefined
	disabled BOOLEAN DEFAULT FALSE,
	reason_id INT,
	content TEXT,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT
);

----------------------------------------------

DROP TABLE IF EXISTS UserProfiles CASCADE;

CREATE TABLE UserProfiles (
	id SERIAL PRIMARY KEY,
	user_id INT,
	current_role_level_id INT,
	current_job_title VARCHAR(100),
	desired_annual_salary VARCHAR(50),
	desired_country_id INT,
	resume_url VARCHAR(200),
	linkedin_url VARCHAR(200),
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS Notifications CASCADE;

CREATE TABLE Notifications (
	id SERIAL PRIMARY KEY,
	user_id INT,
	type_id INT,
	item_id INT,
	title VARCHAR(100),
	content TEXT,
	read BOOLEAN DEFAULT FALSE,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS Plans CASCADE;

CREATE TABLE Plans (
	id SERIAL PRIMARY KEY,
	name VARCHAR(100),
	description TEXT,
	price DECIMAL(10, 2),
	currency VARCHAR(10),
	period INT, -- 1: Monthly, 2: Quarterly, 3: Yearly
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS Subscriptions CASCADE;

CREATE TABLE Subscriptions (
	id SERIAL PRIMARY KEY,
	user_id INT,
	plan_id INT,
	subscription_start_date DATE,
	subscription_end_date DATE,
	subscription_status INT, -- 1: Active, 2: Inactive
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS EmailAuthorizations CASCADE;

CREATE TABLE EmailAuthorizations (
	id SERIAL PRIMARY KEY,
	email VARCHAR(200),
	platform_id INT, -- 1: Gmail, 2: Outlook
	code VARCHAR(6),
	valid_before TIMESTAMP,
	used BOOLEAN DEFAULT FALSE,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS UserCreditBalances CASCADE;

CREATE TABLE IF NOT EXISTS UserCreditBalances (
	id SERIAL PRIMARY KEY,
	user_id INT REFERENCES Users(id),
	amount INT DEFAULT 0, -- USD Cents
	-- Standard audit fields
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS UserCreditBalanceHistories CASCADE;

CREATE TABLE IF NOT EXISTS UserCreditBalanceHistories (
	id SERIAL PRIMARY KEY,
	user_id INT REFERENCES Users(id),
	amount INT DEFAULT 0, -- USD Cents
	message TEXT,
	-- Standard audit fields
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS UserPlans CASCADE;

CREATE TABLE IF NOT EXISTS UserPlans (
	id SERIAL PRIMARY KEY,
	title TEXT,
	price INT DEFAULT 0,
	amount INT DEFAULT 0,
	purchase_link VARCHAR(200),
	stripe_prod_id VARCHAR(100),
	hidden BOOLEAN DEFAULT FALSE,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS UserPlanSubscriptions CASCADE;

CREATE TABLE IF NOT EXISTS UserPlanSubscriptions (
	id SERIAL PRIMARY KEY,
	user_id INT REFERENCES Users(id),
	plan_id INT REFERENCES UserPlans(id),
	stripe_event_id VARCHAR(100),
	stripe_subscription_id VARCHAR(100),
	start_date DATE,
	end_date DATE,
	amount INT DEFAULT 0,
	status INT DEFAULT 1, -- 0: Paused, 1: Active, 2: Cancelled
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS SavedTasks CASCADE;

CREATE TABLE IF NOT EXISTS SavedTasks (
	id SERIAL PRIMARY KEY,
	user_id INT REFERENCES Users(id),
	task_name VARCHAR(200),
	task_type INT, -- 1: FETCH, 2: MODIFY
	task_content TEXT,
	entities TEXT[],
	last_executed_at TIMESTAMP,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS SavedTaskSteps CASCADE;

CREATE TABLE IF NOT EXISTS SavedTaskSteps (
	id SERIAL PRIMARY KEY,
	saved_task_id INT REFERENCES SavedTasks(id),
	step_order INT,
	step_type INT, -- 1: FETCH, 2: MODIFY
	step_content TEXT,
	step_json_content JSONB,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS TestProjectFeatures CASCADE;

CREATE TABLE IF NOT EXISTS TestProjectFeatures (
	id SERIAL PRIMARY KEY,
	test_project_id INT REFERENCES TestProjects(id),
	displayed_name VARCHAR(200),
	feature_name VARCHAR(200),
	feature_description TEXT,
	prompt_changed_risk BOOLEAN DEFAULT FALSE,
	enabled BOOLEAN DEFAULT TRUE,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

----------------------------------------------

DROP TABLE IF EXISTS SupportedAiModels CASCADE;

CREATE TABLE IF NOT EXISTS SupportedAiModels (
	id SERIAL PRIMARY KEY,
	model_name VARCHAR(200),
	display_name VARCHAR(200),
	provider_id INT,
	description TEXT,
	deleted BOOLEAN DEFAULT FALSE,
	created_at TIMESTAMP DEFAULT NOW(),
	created_by INT DEFAULT 0,
	updated_at TIMESTAMP DEFAULT NOW(),
	updated_by INT DEFAULT 0
);

INSERT INTO SupportedAiModels
  	(model_name, display_name, provider_id, description)
VALUES
	-- New OpenAI GPT-3.5 Turbo variants
	('gpt-3.5-turbo-instruct', 'GPT-3.5 Turbo Instruct', 1, 'OpenAI GPT-3.5 Turbo Instruct model'),
	('gpt-3.5-turbo-instruct-0914', 'GPT-3.5 Turbo Instruct 0914', 1, 'OpenAI GPT-3.5 Turbo Instruct model (0914)'),
	('gpt-3.5-turbo-1106', 'GPT-3.5 Turbo 1106', 1, 'OpenAI GPT-3.5 Turbo model (1106)'),
	('gpt-3.5-turbo-0125', 'GPT-3.5 Turbo 0125', 1, 'OpenAI GPT-3.5 Turbo model (0125)'),
	('gpt-3.5-turbo-16k', 'GPT-3.5 Turbo 16K', 1, 'OpenAI GPT-3.5 Turbo model with 16K context window'),
	-- New OpenAI GPT-4 and Turbo variants
	('gpt-4-0613', 'GPT-4 0613', 1, 'OpenAI GPT-4 model (0613)'),
	('gpt-4-1106-preview', 'GPT-4 1106 Preview', 1, 'OpenAI GPT-4 model (1106 preview)'),
	('gpt-4-0125-preview', 'GPT-4 0125 Preview', 1, 'OpenAI GPT-4 model (0125 preview)'),
	('gpt-4-turbo-preview', 'GPT-4 Turbo Preview', 1, 'OpenAI GPT-4 Turbo Preview'),
	('gpt-4-turbo', 'GPT-4 Turbo', 1, 'OpenAI GPT-4 Turbo'),
	('gpt-4-turbo-2024-04-09', 'GPT-4 Turbo 2024-04-09', 1, 'OpenAI GPT-4 Turbo (2024-04-09)'),
	('gpt-4o-2024-05-13', 'GPT-4o 2024-05-13', 1, 'OpenAI GPT-4o (2024-05-13)'),
	('gpt-4o-2024-08-06', 'GPT-4o 2024-08-06', 1, 'OpenAI GPT-4o (2024-08-06)'),
	('gpt-4o-2024-11-20', 'GPT-4o 2024-11-20', 1, 'OpenAI GPT-4o (2024-11-20)'),
	('gpt-4o-2024-05-13', 'GPT-4o 2024-05-13', 1, 'OpenAI GPT-4o (2024-05-13)'),
	('gpt-4o-mini', 'GPT-4o Mini', 1, 'OpenAI GPT-4o Mini'),
	('gpt-4o-mini-2024-07-18', 'GPT-4o Mini 2024-07-18', 1, 'OpenAI GPT-4o Mini (2024-07-18)'),
	('gpt-4o-mini-realtime-preview', 'GPT-4o Mini Realtime Preview', 1, 'OpenAI GPT-4o Mini Realtime Preview'),
	('gpt-4o-mini-realtime-preview-2024-12-17', 'GPT-4o Mini Realtime Preview 2024-12-17', 1, 'OpenAI GPT-4o Mini Realtime Preview (2024-12-17)'),
	('gpt-4o-mini-tts', 'GPT-4o Mini TTS', 1, 'OpenAI GPT-4o Mini TTS'),
	('gpt-4o-mini-tts-2025-03-20', 'GPT-4o Mini TTS 2025-03-20', 1, 'OpenAI GPT-4o Mini TTS (2025-03-20)'),
	-- New OpenAI GPT-4.1 and 5 series
	('gpt-4.1', 'GPT-4.1', 1, 'OpenAI GPT-4.1'),
	('gpt-4.1-2025-04-14', 'GPT-4.1 2025-04-14', 1, 'OpenAI GPT-4.1 (2025-04-14)'),
	('gpt-4.1-mini', 'GPT-4.1 Mini', 1, 'OpenAI GPT-4.1 Mini'),
	('gpt-4.1-mini-2025-04-14', 'GPT-4.1 Mini 2025-04-14', 1, 'OpenAI GPT-4.1 Mini (2025-04-14)'),
	('gpt-4.1-nano', 'GPT-4.1 Nano', 1, 'OpenAI GPT-4.1 Nano'),
	('gpt-4.1-nano-2025-04-14', 'GPT-4.1 Nano 2025-04-14', 1, 'OpenAI GPT-4.1 Nano (2025-04-14)'),
	('gpt-5', 'GPT-5', 1, 'OpenAI GPT-5'),
	('gpt-5-2025-08-07', 'GPT-5 2025-08-07', 1, 'OpenAI GPT-5 (2025-08-07)'),
	('gpt-5-mini', 'GPT-5 Mini', 1, 'OpenAI GPT-5 Mini'),
	('gpt-5-mini-2025-08-07', 'GPT-5 Mini 2025-08-07', 1, 'OpenAI GPT-5 Mini (2025-08-07)'),
	('gpt-5-nano', 'GPT-5 Nano', 1, 'OpenAI GPT-5 Nano'),
	('gpt-5-nano-2025-08-07', 'GPT-5 Nano 2025-08-07', 1, 'OpenAI GPT-5 Nano (2025-08-07)'),
	('gpt-5-pro', 'GPT-5 Pro', 1, 'OpenAI GPT-5 Pro'),
	('gpt-5-pro-2025-10-06', 'GPT-5 Pro 2025-10-06', 1, 'OpenAI GPT-5 Pro (2025-10-06)'),
	('gpt-5.1', 'GPT-5.1', 1, 'OpenAI GPT-5.1'),
	('gpt-5.1-2025-11-13', 'GPT-5.1 2025-11-13', 1, 'OpenAI GPT-5.1 (2025-11-13)'),
	('gpt-5.2', 'GPT-5.2', 1, 'OpenAI GPT-5.2'),
	('gpt-5.2-2025-12-11', 'GPT-5.2 2025-12-11', 1, 'OpenAI GPT-5.2 (2025-12-11)'),
	('gpt-5.2-pro', 'GPT-5.2 Pro', 1, 'OpenAI GPT-5.2 Pro'),
	('gpt-5.2-pro-2025-12-11', 'GPT-5.2 Pro 2025-12-11', 1, 'OpenAI GPT-5.2 Pro (2025-12-11)'),
	-- ChatGPT and O series
	('chatgpt-4o-latest', 'ChatGPT-4o Latest', 1, 'OpenAI ChatGPT-4o Latest'),
	('gpt-4o-2024-05-13', 'GPT-4o 2024-05-13', 1, 'OpenAI GPT-4o (2024-05-13)'),
	('o1', 'O1', 1, 'OpenAI O1'),
	('o1-2024-12-17', 'O1 2024-12-17', 1, 'OpenAI O1 (2024-12-17)'),
	('o1-pro', 'O1 Pro', 1, 'OpenAI O1 Pro'),
	('o1-pro-2025-03-19', 'O1 Pro 2025-03-19', 1, 'OpenAI O1 Pro (2025-03-19)'),
	('o3', 'O3', 1, 'OpenAI O3'),
	('o3-2025-04-16', 'O3 2025-04-16', 1, 'OpenAI O3 (2025-04-16)'),
	('o3-mini', 'O3 Mini', 1, 'OpenAI O3 Mini'),
	('o3-mini-2025-01-31', 'O3 Mini 2025-01-31', 1, 'OpenAI O3 Mini (2025-01-31)'),
	('o4-mini', 'O4 Mini', 1, 'OpenAI O4 Mini'),
	('o4-mini-2025-04-16', 'O4 Mini 2025-04-16', 1, 'OpenAI O4 Mini (2025-04-16)'),
	('o4-mini-deep-research', 'O4 Mini Deep Research', 1, 'OpenAI O4 Mini Deep Research'),
	('o4-mini-deep-research-2025-06-26', 'O4 Mini Deep Research 2025-06-26', 1, 'OpenAI O4 Mini Deep Research (2025-06-26)'),
	-- ChatGPT latest
	('gpt-5-chat-latest', 'GPT-5 Chat Latest', 1, 'OpenAI GPT-5 Chat Latest'),
	('gpt-5.1-chat-latest', 'GPT-5.1 Chat Latest', 1, 'OpenAI GPT-5.1 Chat Latest'),
	('gpt-5.2-chat-latest', 'GPT-5.2 Chat Latest', 1, 'OpenAI GPT-5.2 Chat Latest'),
	-- Google Gemini and related models
	('models/gemini-2.5-flash', 'Gemini 2.5 Flash', 2, 'Google Gemini 2.5 Flash model'),
	('models/gemini-2.5-pro', 'Gemini 2.5 Pro', 2, 'Google Gemini 2.5 Pro model'),
	('models/gemini-2.0-flash', 'Gemini 2.0 Flash', 2, 'Google Gemini 2.0 Flash model'),
	('models/gemini-2.0-flash-001', 'Gemini 2.0 Flash 001', 2, 'Google Gemini 2.0 Flash model (001)'),
	('models/gemini-2.0-flash-lite', 'Gemini 2.0 Flash Lite', 2, 'Google Gemini 2.0 Flash Lite model'),
	('models/gemini-2.0-flash-lite-001', 'Gemini 2.0 Flash Lite 001', 2, 'Google Gemini 2.0 Flash Lite model (001)'),
	('models/gemini-exp-1206', 'Gemini Exp 1206', 2, 'Google Gemini Experimental 1206'),
	('models/gemini-flash-latest', 'Gemini Flash Latest', 2, 'Google Gemini Flash Latest'),
	('models/gemini-flash-lite-latest', 'Gemini Flash Lite Latest', 2, 'Google Gemini Flash Lite Latest'),
	('models/gemini-pro-latest', 'Gemini Pro Latest', 2, 'Google Gemini Pro Latest'),
	('models/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 2, 'Google Gemini 2.5 Flash Lite'),
	('models/gemini-2.5-flash-preview-09-2025', 'Gemini 2.5 Flash Preview 09-2025', 2, 'Google Gemini 2.5 Flash Preview (09-2025)'),
	('models/gemini-2.5-flash-lite-preview-09-2025', 'Gemini 2.5 Flash Lite Preview 09-2025', 2, 'Google Gemini 2.5 Flash Lite Preview (09-2025)'),
	('models/gemini-3-pro-preview', 'Gemini 3 Pro Preview', 2, 'Google Gemini 3 Pro Preview'),
	('models/gemini-3-flash-preview', 'Gemini 3 Flash Preview', 2, 'Google Gemini 3 Flash Preview'),
	('models/gemini-robotics-er-1.5-preview', 'Gemini Robotics ER 1.5 Preview', 2, 'Google Gemini Robotics ER 1.5 Preview'),
	('models/gemini-2.5-computer-use-preview-10-2025', 'Gemini 2.5 Computer Use Preview 10-2025', 2, 'Google Gemini 2.5 Computer Use Preview (10-2025)'),
	('models/deep-research-pro-preview-12-2025', 'Deep Research Pro Preview 12-2025', 2, 'Google Deep Research Pro Preview (12-2025)');

----------------------------------------------

