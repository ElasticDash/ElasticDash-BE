# API Overview

This document provides a high-level overview of all API services available in ElasticDash API.

## ⚠️ Important: Test Services

**The following services are for testing/development only and must be reviewed or removed before production:**

- **Pokemon Service** (`/pokemon`): Demo service for testing purposes. Use [PokeAPI](https://pokeapi.co/) data to populate for testing. **Remove before production.**
- **Chat Service** (`/chat`): Currently configured for testing. Review and configure for production use cases.

## API Base URL

### Development
```
http://localhost:3000/api
```

### Staging
```
https://devserver.elasticdash.com/api
```

### Production
```
https://server.elasticdash.com/api
```

## Authentication

Most API endpoints require authentication using JWT (JSON Web Tokens).

### Authentication Flow

1. **Register or Login** to obtain a JWT token
2. **Include the token** in the `Authorization` header for subsequent requests
3. **Token expires** after a set period (refresh by logging in again)

### Header Format

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Public Endpoints (No Authentication Required)

- `POST /auth/login` - User login
- `POST /user/register` - User registration
- `GET /general/files/{key}` - Public file access
- `POST /plan/webhook` - Stripe webhook (validated differently)

## API Services

ElasticDash API is organized into 14 service modules, each handling specific functionality:

### 1. Authentication Service (`/auth`)

**OpenAPI Documentation**: `openapi-doc/openapi-auth.json`

Handles user authentication and session management.

**Endpoints:**
- `POST /auth/login` - User login with email/password
- `GET /auth/session/{sessionId}` - Get session details

**Key Features:**
- JWT token generation
- Session tracking
- Password validation

---

### 2. User Service (`/user`)

**OpenAPI Documentation**: `openapi-doc/openapi-user.json`

Complete user management, profiles, settings, and feedback.

**Key Endpoint Groups:**
- **Account Management**: Register, login, password reset, email verification
- **Profile**: Get/update user profile, upload photo
- **Notifications**: List, mark read, delete notifications
- **Settings**: API base URL, OAuth tokens, LLM configuration, database connections
- **Feedback**: Submit and manage user feedback
- **Subscriptions**: Manage email subscriptions

**Example:**
```bash
GET /user/profile/my
PUT /user/profile
GET /user/settings/llm
POST /user/feedbacks/post
```

**Total Endpoints**: 42

---

### 3. Project Service (`/project`)

**OpenAPI Documentation**: `openapi-doc/openapi-project.json`

Manages projects, databases, access tokens, and knowledge base (KB) management.

**Key Endpoint Groups:**

#### Projects
- `GET /projects` - List all projects
- `POST /projects` - Create new project
- `GET /projects/{id}` - Get project details
- `PUT /projects/{id}` - Update project
- `DELETE /projects/{id}` - Delete project

#### Knowledge Base (KB) - Draft/Active Workflow
- **Upload & Parse**: Upload OpenAPI specs or SQL schemas
- **APIs Management**: CRUD for API documentation (draft/active)
- **Tables Management**: CRUD for database schemas (draft/active)
- **Workflow**: Submit drafts, build RAG, promote to active, discard drafts

**KB Workflow:**
```
1. Upload OpenAPI/SQL → 2. Edit in Draft → 3. Submit Draft → 4. Build RAG → 5. Promote to Active
```

**Example:**
```bash
POST /project/kb/upload-openapi
GET /project/kb/draft/apis
POST /project/kb/submit
POST /project/kb/build-rag
```

**Total Endpoints**: 40

---

### 4. Test Case Service (`/testcase`)

**OpenAPI Documentation**: `openapi-doc/openapi-test-case.json`

Test case management, execution, and AI-powered test generation.

**Key Endpoint Groups:**
- **Test Cases**: CRUD operations
- **AI Generation**: Generate test cases from descriptions
- **Test Runs**: Execute tests and track results
- **Drafts**: Manage test case drafts
- **Records**: Test execution history

**Example:**
```bash
POST /testcase/create
POST /testcase/generate
POST /testcase/run
GET /testcase/runs/list
```

**Total Endpoints**: 26

---

### 5. Traces Service (`/traces`)

**OpenAPI Documentation**: `openapi-doc/openapi-traces.json`

Application tracing and observability for debugging and monitoring.

**Key Features:**
- List and filter traces
- Session-based trace grouping
- Detailed trace inspection
- Trace deletion

**Example:**
```bash
POST /traces/list
GET /traces/sessions/{sessionId}
GET /traces/detail/{id}
DELETE /traces/delete/{id}
```

**Total Endpoints**: 5

---

### 6. Trace Analysis Service (`/traceanalysis`)

**OpenAPI Documentation**: `openapi-doc/openapi-trace-analysis.json`

AI-powered trace analysis, fingerprinting, and drift detection.

**Key Features:**
- Analyze trace patterns
- Generate trace fingerprints
- Detect behavioral drift
- Track observation changes

**Example:**
```bash
POST /traceanalysis/analyze
POST /traceanalysis/fingerprint
POST /traceanalysis/drift
```

**Total Endpoints**: 7

---

### 7. Features Service (`/features`)

**OpenAPI Documentation**: `openapi-doc/openapi-features.json`

Feature flag management and AI-powered feature analysis.

**Key Features:**
- CRUD for feature flags
- AI analysis of features
- Feature enabling/disabling

**Example:**
```bash
GET /features/list
POST /features/create
POST /features/analyze
PUT /features/update/{id}
```

**Total Endpoints**: 6

---

### 8. Chat Service (`/chat`)

**OpenAPI Documentation**: `openapi-doc/openapi-chat.json`

> **⚠️ TEST SERVICE WARNING**: This service is currently configured for testing AI chat integrations with ElasticDash. Review and configure appropriately for your production use cases before deployment.

AI chat completion with multi-provider support and conversation management.

**Key Features:**
- Chat completion (OpenAI, Claude, xAI, Gemini)
- Conversation history
- Message threading
- Duplicate conversation handling

**Example:**
```bash
POST /chat/completion
GET /chat/conversations
GET /chat/history/{sessionId}/{firstMessageId}
```

**Total Endpoints**: 5

---

### 9. Persona Service (`/persona`)

**OpenAPI Documentation**: `openapi-doc/openapi-persona.json`

AI persona management for customized AI behaviors.

**Key Features:**
- Create/list/delete personas
- Estimate token usage
- Persona configuration

**Example:**
```bash
GET /persona
POST /persona
DELETE /persona/{id}
POST /persona/estimate
```

**Total Endpoints**: 4

---

### 10. General Service (`/general`)

**OpenAPI Documentation**: `openapi-doc/openapi-general.json`

Utility endpoints for files, secrets, AI services, and database queries.

**Key Endpoint Groups:**
- **Files**: S3 file access
- **Secrets**: AWS Secrets Manager integration
- **AI Services**: Direct access to OpenAI, Claude, xAI
- **Database**: Execute read-only SQL queries

**Example:**
```bash
GET /general/files/{key}
GET /general/secret/list
POST /general/aiservice/openai
POST /general/sql/query
```

**Total Endpoints**: 9

---

### 11. Plan Service (`/plan`)

**OpenAPI Documentation**: `openapi-doc/openapi-plan.json`

Subscription plan management and billing with Stripe integration.

**Key Features:**
- List available plans
- Check account balance
- Current subscription info
- Stripe webhook handling

**Example:**
```bash
GET /plan/list
GET /plan/balance
GET /plan/subscription/current
POST /plan/webhook
```

**Total Endpoints**: 4

---

### 12. Task Service (`/task`)

**OpenAPI Documentation**: `openapi-doc/openapi.json`

Background task and job management.

**Key Features:**
- Create tasks
- List task status
- Delete tasks

**Example:**
```bash
POST /task
GET /task/list
DELETE /task/single/{taskId}
```

**Total Endpoints**: 3

---

### 13. Admin Service (`/admin`)

**OpenAPI Documentation**: `openapi-doc/openapi-admin.json`

Administrative operations and user management.

**Key Features:**
- User search and management
- System testing endpoints
- Real-time admin notifications (WebSocket)

**Example:**
```bash
GET /admin/allrealusers
GET /admin/user/search
POST /admin/socket
```

**Total Endpoints**: 11

---

### 14. Pokemon Service (`/pokemon`)

**OpenAPI Documentation**: `openapi-doc/openapi-pokemon.json`

> **⚠️ TEST SERVICE - REMOVE BEFORE PRODUCTION**: This service is for testing and demonstration purposes only. It showcases API patterns and is used to test ElasticDash chat functionality. Use [PokeAPI](https://pokeapi.co/) data to populate the Pokemon database for testing. **This service must be removed before production deployment.**

Demo/test service showcasing API patterns and best practices.

**Key Features:**
- Pokemon CRUD
- Team management
- Move and ability tracking
- Watchlist functionality

**Testing with PokeAPI:**
```bash
# Example: Fetch Pokemon data from PokeAPI for testing
curl https://pokeapi.co/api/v2/pokemon/pikachu
curl https://pokeapi.co/api/v2/pokemon/charizard
```

**Total Endpoints**: 17

---

## Response Format

All API endpoints follow a consistent response format:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

Or simplified:
```json
{
  // Direct data response
}
```

### Error Response

```json
{
  "status": 400,
  "message": "Error description here",
  "error": {
    // Optional error details
  }
}
```

### HTTP Status Codes

- `200 OK` - Request succeeded
- `201 Created` - Resource created successfully
- `400 Bad Request` - Invalid request parameters
- `401 Unauthorized` - Authentication required or failed
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

## Common Request Patterns

### GET Request (List)

```bash
curl -X GET http://localhost:3000/api/features/list \
  -H "Authorization: Bearer $TOKEN"
```

### POST Request (Create)

```bash
curl -X POST http://localhost:3000/api/features/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Feature",
    "description": "Feature description",
    "enabled": true
  }'
```

### PUT Request (Update)

```bash
curl -X PUT http://localhost:3000/api/features/update/123 \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Feature Name",
    "enabled": false
  }'
```

### DELETE Request

```bash
curl -X DELETE http://localhost:3000/api/features/delete/123 \
  -H "Authorization: Bearer $TOKEN"
```

## Rate Limiting

Currently, no rate limiting is enforced, but it's recommended to:
- Limit client-side requests to reasonable levels
- Cache responses when appropriate
- Use pagination for large datasets

## Pagination

For endpoints that return lists, pagination may be supported:

```bash
GET /endpoint?limit=20&offset=0
```

Parameters:
- `limit` - Number of items to return (default: 10-50 depending on endpoint)
- `offset` - Number of items to skip (default: 0)

## WebSocket Support

Real-time updates are available via Socket.IO:

**Connect:**
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:3000', {
  auth: {
    token: 'your_jwt_token'
  }
});

// Listen for events
socket.on('kb:upload-openapi:complete', (data) => {
  console.log('OpenAPI upload complete:', data);
});
```

**Events:**
- `kb:upload-openapi:complete` - OpenAPI upload finished
- `kb:upload-sql:complete` - SQL upload finished
- Notification events for admin panel

## Testing the API

### Using Postman

1. Import OpenAPI files from `/openapi-doc/`
2. Set base URL: `http://localhost:3000/api`
3. Add Authorization header: `Bearer {{token}}`
4. Test endpoints

### Using curl

```bash
# Set token variable
export TOKEN="your_jwt_token_here"

# Test endpoint
curl -X GET http://localhost:3000/api/user/profile/my \
  -H "Authorization: Bearer $TOKEN"
```

### Using HTTPie

```bash
http GET localhost:3000/api/user/profile/my \
  Authorization:"Bearer $TOKEN"
```

## API Statistics

**Total Services**: 14
**Total Endpoints**: 181+
**Documentation Coverage**: ~89%

**Fully Documented Services** (100% coverage):
- Auth, User, Project, Test Cases, Traces, Trace Analysis
- Features, Chat, Persona, General, Plan, Task, Admin, Pokemon

## OpenAPI Documentation Files

All endpoints are documented using OpenAPI 3.0 specification:

```
openapi-doc/
├── openapi-auth.json           # Authentication (2 endpoints)
├── openapi-user.json           # Users (42 endpoints)
├── openapi-project.json        # Projects & KB (40 endpoints)
├── openapi-test-case.json      # Test cases (26 endpoints)
├── openapi-traces.json         # Traces (5 endpoints)
├── openapi-trace-analysis.json # Analysis (7 endpoints)
├── openapi-features.json       # Features (6 endpoints)
├── openapi-chat.json           # Chat (5 endpoints)
├── openapi-persona.json        # Personas (4 endpoints)
├── openapi-general.json        # General (9 endpoints)
├── openapi-plan.json           # Plans (4 endpoints)
├── openapi.json                # Tasks (3 endpoints)
├── openapi-admin.json          # Admin (11 endpoints)
└── openapi-pokemon.json        # Pokemon (17 endpoints)
```

You can use these files with:
- Postman (import as OpenAPI 3.0)
- Swagger UI
- Redoc
- Stoplight
- Any OpenAPI-compatible tool

## Best Practices

1. **Always include Authorization header** for protected endpoints
2. **Handle errors gracefully** - check status codes and error messages
3. **Use appropriate HTTP methods** - GET for read, POST for create, PUT for update, DELETE for remove
4. **Validate input** on the client side before sending requests
5. **Cache responses** when appropriate to reduce server load
6. **Use pagination** for large datasets
7. **Keep tokens secure** - never expose in logs or version control

## Next Steps

- Review specific service documentation in `/openapi-doc/`
- Read [Architecture Guide](architecture.md) to understand system design
- Follow [Development Guidelines](development.md) to add new endpoints
- Check [Configuration Guide](configuration.md) for API key setup

## Support

For detailed endpoint specifications, parameters, and response schemas, refer to the OpenAPI documentation files in `/openapi-doc/`.
