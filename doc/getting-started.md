# Getting Started Guide

This guide provides a step-by-step walkthrough to get ElasticDash API running on your local machine.

## Prerequisites Checklist

Before starting, ensure you have completed:

- [ ] Installed Node.js (v14+)
- [ ] Installed PostgreSQL
- [ ] Installed Git
- [ ] Read the [Installation Guide](installation.md)

## Step-by-Step Guide

### Step 1: Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd ElasticDash-API

# Verify you're in the project directory
ls -la
# You should see: package.json, index.js, services/, controller/, etc.
```

### Step 2: Install Dependencies

```bash
# Install all npm packages
npm install

# This may take 2-3 minutes
# Wait for "added XXX packages" message
```

**Expected output:**
```
added 1234 packages from 567 contributors and audited 1234 packages in 120s
```

### Step 3: Set Up PostgreSQL Database

#### Create Database and Users

```bash
# Connect to PostgreSQL
psql -U postgres

# In psql prompt:
CREATE DATABASE testdb;
CREATE USER black_ace WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE testdb TO black_ace;

# Exit psql
\q
```

#### Initialize Database Schema

```bash
# Connect to the new database
psql -U black_ace -d testdb

# Check if there are schema files in /database folder
ls -la database/

# Run schema files if they exist
# \i database/schema.sql
```

**Note**: Check the `/database` folder for initialization scripts and run them in order.

### Step 4: Configure Environment Variables

```bash
# Copy environment template
cp .env.staging .env

# Edit the .env file
nano .env  # or use your preferred editor
```

#### Minimal Configuration

Update these essential variables in `.env`:

```bash
# Database connection
DB_CONNECTION_STRING=postgres://black_ace:your_secure_password@localhost:5432/testdb?sslmode=disable

# JWT secret (generate a random string)
SECRET=your_random_secret_key_min_32_chars

# Server configuration
PORT=3000
NODE_ENV=development

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000/api

# OpenAI API (get from https://platform.openai.com/api-keys)
OPENAI_API_KEY=sk-proj-your-actual-api-key-here
OPENAI_DEFAULT_MODEL=gpt-4-turbo

# AWS (optional for basic testing, required for file uploads)
AWS_REGION=ap-southeast-2
AWS_AK=your_aws_access_key
AWS_SAK=your_aws_secret_key
S3_BUCKET_NAME=elasticdash-test
```

**Generate a secure JWT secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

For complete configuration options, see [Configuration Guide](configuration.md).

### Step 5: Verify Configuration

Test your database connection:

```bash
# Test PostgreSQL connection
psql -U black_ace -d testdb -c "SELECT version();"
```

**Expected output:** PostgreSQL version information

### Step 6: Start the Development Server

```bash
# Start server with hot reload
npm run dev
```

**Expected output:**
```
Server is listening on port 3000
PostgreSQL connected
Socket.IO server started
Worker loops initialized
```

### Step 7: Verify the Server is Running

#### Test Basic Connectivity

```bash
# In a new terminal window, test the server
curl http://localhost:3000/api/health
```

**Expected response:** `{"status": "ok"}` or similar

#### Check Server Logs

In your server terminal, you should see:
```
Server is listening on port 3000
[timestamp] GET /api/health
Worker: Test case run worker started (interval: 5000ms)
Worker: Auto feature analyzer started
```

### Step 8: Test Authentication Endpoints

#### Register a New User

```bash
curl -X POST http://localhost:3000/api/user/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!",
    "firstName": "Test",
    "lastName": "User"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```

#### Login with the User

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePassword123!"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "sessionId": "uuid-session-id"
}
```

Save the token for authenticated requests!

### Step 9: Test an Authenticated Endpoint

```bash
# Use the token from previous step
export TOKEN="your_jwt_token_here"

# Get current user profile
curl -X GET http://localhost:3000/api/user/profile/my \
  -H "Authorization: Bearer $TOKEN"
```

**Expected response:**
```json
{
  "id": 1,
  "email": "test@example.com",
  "firstName": "Test",
  "lastName": "User",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

### Step 10: (Optional) Populate Test Data

For testing the chat features and API patterns, you can populate the Pokemon database with data from PokeAPI:

```bash
# Fetch sample Pokemon data
curl https://pokeapi.co/api/v2/pokemon/pikachu
curl https://pokeapi.co/api/v2/pokemon/charizard
curl https://pokeapi.co/api/v2/pokemon/bulbasaur

# Use POST endpoints to add Pokemon to your database
curl -X POST http://localhost:3000/api/pokemon \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pikachu",
    "type": "Electric",
    "hp": 35,
    "attack": 55
  }'
```

> **Note**: The Pokemon service (`/pokemon`) and associated chat testing features are for development/testing only and should be removed before production deployment. See the [Development Guidelines](development.md) for the production deployment checklist.

### Step 11: Explore the API Documentation

The project includes comprehensive OpenAPI documentation:

```bash
# View available OpenAPI documentation files
ls -la openapi-doc/

# Files:
# - openapi-auth.json          (Authentication)
# - openapi-user.json          (User management)
# - openapi-project.json       (Projects and Knowledge Base)
# - openapi-test-case.json     (Test cases)
# - openapi-traces.json        (Trace management)
# - openapi-trace-analysis.json (Trace analysis)
# - openapi-features.json      (Feature management)
# - openapi-chat.json          (AI chat)
# - openapi-general.json       (General utilities)
# - openapi-persona.json       (AI personas)
# - openapi-plan.json          (Subscription plans)
# - openapi-pokemon.json       (Pokemon API - demo/test)
# - openapi-admin.json         (Admin operations)
# - openapi.json               (Task management)
```

You can import these files into:
- **Postman**: Import → OpenAPI 3.0
- **Insomnia**: Import → OpenAPI
- **Swagger UI**: Point to the JSON files
- **API Documentation Generators**: Use with Redoc, RapiDoc, etc.

## Common Workflows

### Start Development Server

```bash
# Start with hot reload (recommended for development)
npm run dev

# Or start without hot reload
npm start
```

### Run Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch
```

### Database Operations

```bash
# Connect to database
psql -U black_ace -d testdb

# List all tables
\dt

# Describe a table
\d table_name

# Run a query
SELECT * FROM users LIMIT 10;

# Exit
\q
```

### Check Server Logs

The server logs important information to console:
- API requests (method + path)
- Database queries
- Worker status
- Error messages
- WebSocket connections

### Stop the Server

```bash
# In the terminal running the server
Ctrl + C

# Or kill the process
lsof -i :3000
kill -9 <PID>
```

## API Testing Tools

### Using Postman

1. Install Postman from https://www.postman.com/
2. Import OpenAPI files from `/openapi-doc/`
3. Create environment with `baseUrl = http://localhost:3000/api`
4. Add `Authorization` header: `Bearer {{token}}`
5. Test endpoints

### Using curl

```bash
# Set base URL and token
export BASE_URL="http://localhost:3000/api"
export TOKEN="your_jwt_token"

# Make authenticated requests
curl -X GET $BASE_URL/user/profile/my \
  -H "Authorization: Bearer $TOKEN"
```

### Using HTTPie (Recommended)

```bash
# Install HTTPie
brew install httpie  # macOS
pip install httpie   # Python

# Make requests with better formatting
http GET localhost:3000/api/user/profile/my \
  Authorization:"Bearer $TOKEN"
```

## Development Workflow

### 1. Create a New API Endpoint

See [Development Guidelines](development.md) for detailed instructions.

### 2. Test Your Changes

```bash
# Run tests
npm test

# Manual testing with curl/Postman
```

### 3. Update OpenAPI Documentation

If you added/modified endpoints, update the corresponding OpenAPI file in `/openapi-doc/`.

### 4. Code Formatting

Follow the coding standards in `/CLAUDE.md`:
- Use `generalApiResponseSender` for responses
- Use `generalApiErrorHandler` for errors
- Extract parameters from `req.body`, `req.params`, `req.query`

## Troubleshooting

### Server Won't Start

**Issue**: Port 3000 already in use
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in .env
PORT=3001
```

**Issue**: Database connection error
```bash
# Check PostgreSQL is running
pg_isready

# Check connection string in .env
# Verify username, password, host, port, database name
```

### Authentication Fails

**Issue**: "Token invalid" or "Token expired"
```bash
# Generate new token by logging in again
curl -X POST $BASE_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'
```

**Issue**: "Secret not configured"
```bash
# Ensure SECRET is set in .env
echo $SECRET  # Should output your secret key
```

### OpenAI API Errors

**Issue**: "Invalid API key"
```bash
# Verify your OpenAI API key
# Check at: https://platform.openai.com/api-keys
# Ensure OPENAI_API_KEY is set correctly in .env
```

**Issue**: "Insufficient quota"
```bash
# Check your OpenAI billing and usage
# Visit: https://platform.openai.com/account/usage
```

### AWS S3 Errors

**Issue**: "Access Denied" or "Bucket not found"
```bash
# Verify AWS credentials
aws sts get-caller-identity

# Check bucket exists
aws s3 ls s3://elasticdash-test

# Verify bucket region matches AWS_REGION in .env
```

## Next Steps

Now that your server is running:

1. **Explore the API**: Review [API Overview](api-overview.md) for all available services
2. **Understand Architecture**: Read [Architecture Guide](architecture.md) to understand the project structure
3. **Start Developing**: Follow [Development Guidelines](development.md) for coding standards
4. **Test Endpoints**: Use OpenAPI documentation in `/openapi-doc/` with Postman or other tools

## Quick Reference Commands

```bash
# Development
npm run dev          # Start dev server with hot reload
npm start            # Start production server
npm test             # Run tests

# Database
psql -U black_ace -d testdb             # Connect to database
psql -U black_ace -d testdb -f file.sql # Run SQL file

# Debugging
NODE_ENV=development npm run dev         # Run with debug logs
DEBUG=* npm run dev                      # Enable all debug logs

# Server Management
lsof -i :3000       # Check what's using port 3000
kill -9 <PID>       # Kill process by ID
```

## Support

- Check [API Overview](api-overview.md) for endpoint documentation
- Review [Architecture](architecture.md) for system design
- See [Development Guidelines](development.md) for coding standards
- Examine `/openapi-doc/` for detailed API specifications
