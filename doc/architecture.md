# Architecture Guide

This document explains the technical architecture, design patterns, and project structure of ElasticDash Backend.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Applications                      │
│    (Web App, Mobile App, CLI, External Services)                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS/WSS
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ElasticDash Backend Server                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Express.js Application (index.js)                       │  │
│  │  - CORS Middleware                                       │  │
│  │  - Authentication Middleware                             │  │
│  │  - Body Parsers (JSON, URL-encoded)                     │  │
│  │  - Error Handlers                                        │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │         Routes (routes.js)                               │  │
│  │  /auth, /user, /project, /testcase, /traces, etc.      │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │         Services Layer (services/*.js)                   │  │
│  │  - Route handlers                                        │  │
│  │  - Request validation                                    │  │
│  │  - Response formatting                                   │  │
│  └──────────────────────┬───────────────────────────────────┘  │
│                         │                                        │
│  ┌──────────────────────┴───────────────────────────────────┐  │
│  │       Controllers Layer (controller/*/*.js)              │  │
│  │  - Business logic                                        │  │
│  │  - Database operations                                   │  │
│  │  - External API calls                                    │  │
│  │  - Data processing                                       │  │
│  └──────────────────────┬───────────────────────────────────┘  │
└───────────────────────┬─┴───────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │  ClickHouse  │ │  AWS Services│
│   (Primary   │ │  (Analytics) │ │  - S3        │
│   Database)  │ │              │ │  - Secrets   │
│              │ │              │ │  - SQS       │
└──────────────┘ └──────────────┘ └──────────────┘

        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   OpenAI     │ │   Claude     │ │  xAI/Gemini  │
│     API      │ │     API      │ │     APIs     │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Technology Stack

### Core Technologies

- **Runtime**: Node.js (v14+)
- **Language**: JavaScript with ES6+ modules (Babel transpilation)
- **Framework**: Express.js 4.x
- **Real-time**: Socket.IO 4.x

### Databases

- **PostgreSQL**: Primary relational database
  - User data
  - Projects, test cases, features
  - Traces and sessions
  - Transactional data

- **ClickHouse**: Analytics and time-series data
  - High-volume logging
  - Performance metrics
  - Analytical queries

### External Services

- **AWS Services**:
  - **S3**: File storage and CDN
  - **Secrets Manager**: Secure credential storage
  - **SQS**: Message queues for background jobs

- **AI Providers**:
  - **OpenAI**: GPT models (gpt-4, gpt-3.5-turbo)
  - **Anthropic Claude**: Claude models (opus, sonnet, haiku)
  - **xAI**: Grok models
  - **Google**: Gemini models

- **Payment Processing**:
  - **Stripe**: Subscription and payment management

- **Email Service**:
  - **SendPulse**: Transactional emails and notifications

- **Observability**:
  - **OpenTelemetry**: Distributed tracing and metrics
  - **ElasticDash OTEL**: Custom OTEL integration

## Project Structure

```
ElasticDash-API/
│
├── index.js                 # Application entry point
├── config.js                # Environment configuration loader
├── routes.js                # Main route aggregator
├── postgres.js              # PostgreSQL connection pool
│
├── services/                # Express route handlers (14 modules)
│   ├── auth.js              # Authentication routes
│   ├── user.js              # User management routes
│   ├── project.js           # Project & KB routes
│   ├── testCase.js          # Test case routes
│   ├── traces.js            # Trace management routes
│   ├── traceAnalysis.js     # Trace analysis routes
│   ├── features.js          # Feature flag routes
│   ├── chat.js              # AI chat routes (⚠️ review for production)
│   ├── persona.js           # AI persona routes
│   ├── general.js           # General utility routes
│   ├── plan.js              # Subscription routes
│   ├── task.js              # Background task routes
│   ├── admin.js             # Admin routes
│   └── pokemon.js           # Demo/test routes (⚠️ remove before production)
│
├── controller/              # Business logic layer
│   ├── auth/                # Authentication logic
│   │   └── auth.js          # JWT token handling, verification
│   │
│   ├── user/                # User operations
│   │   ├── profile.js       # Profile management
│   │   ├── settings.js      # User settings
│   │   └── feedback.js      # Feedback handling
│   │
│   ├── project/             # Project operations
│   │   ├── project.js       # Project CRUD
│   │   ├── staging.js       # KB draft/active workflow
│   │   └── rag.js           # RAG file generation
│   │
│   ├── testCase/            # Test case operations
│   │   ├── testCase.js      # Test CRUD
│   │   ├── run.js           # Test execution
│   │   └── ai.js            # AI test generation
│   │
│   ├── trace/               # Trace operations
│   │   ├── trace.js         # Trace CRUD
│   │   └── analysis.js      # Trace analysis
│   │
│   ├── chat/                # AI chat operations
│   │   ├── openai.js        # OpenAI integration
│   │   ├── claude.js        # Claude integration
│   │   └── gemini.js        # Gemini integration
│   │
│   └── general/             # General utilities
│       ├── file.js          # S3 file operations
│       ├── secret.js        # AWS Secrets Manager
│       ├── aihandler.js     # AI provider proxies
│       ├── dbhandler.js     # SQL query execution
│       └── tools.js         # Response/error handlers
│
├── worker/                  # Background workers
│   ├── testCaseRunWorker.js # Automated test execution
│   └── autoFeatureAnalyzer.js # Feature analysis worker
│
├── database/                # Database schemas and migrations
│   ├── schema.sql           # Database schema
│   └── migrations/          # Database migrations
│
├── openapi-doc/             # OpenAPI 3.0 documentation
│   ├── openapi-auth.json
│   ├── openapi-user.json
│   ├── openapi-project.json
│   └── ... (14 files total)
│
├── doc/                     # Project documentation
│   ├── README.md
│   ├── installation.md
│   ├── configuration.md
│   ├── getting-started.md
│   ├── api-overview.md
│   ├── architecture.md      # This file
│   └── development.md
│
├── .env                     # Environment variables (gitignored)
├── .env.staging             # Staging configuration
├── .env.production.local    # Production configuration
├── package.json             # Dependencies and scripts
├── .babelrc                 # Babel configuration
├── .eslintrc                # ESLint configuration
└── CLAUDE.md                # Development guidelines
```

## Test vs Production Services

### ⚠️ Services Requiring Attention Before Production

**Pokemon Service (`/pokemon`):**
- **Purpose**: Demo/test service for showcasing API patterns
- **Use Case**: Testing ElasticDash chat features with structured data
- **Data Source**: [PokeAPI](https://pokeapi.co/) for development testing
- **Production Action**: **Must be completely removed** before production deployment
  - Delete service file (`services/pokemon.js`)
  - Remove controller (`controller/pokemon/`)
  - Remove from routes (`routes.js`)
  - Drop database tables
  - Delete OpenAPI documentation

**Chat Service (`/chat`):**
- **Purpose**: AI chat completion testing and integration
- **Current State**: Configured for testing and development
- **Production Action**: **Review and reconfigure** for production
  - Configure production conversation policies
  - Set appropriate rate limits
  - Review data retention policies
  - Configure production AI provider settings
  - Implement production-grade error handling

### Production-Ready Services

All other services (Auth, User, Project, Test Cases, Traces, etc.) are production-ready with appropriate security, validation, and error handling.

## Design Patterns

### 1. Layered Architecture

**Three-Layer Pattern**:

```
┌─────────────────────────────────────┐
│  Services Layer (services/*.js)     │  ← HTTP Request/Response
│  - Route handlers                   │
│  - Input validation                 │
│  - Response formatting              │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│ Controller Layer (controller/*/*.js)│  ← Business Logic
│ - Database operations               │
│ - External API calls                │
│ - Business rules                    │
└───────────────┬─────────────────────┘
                │
┌───────────────▼─────────────────────┐
│  Data Layer                         │  ← Data Access
│  - PostgreSQL (postgres.js)         │
│  - ClickHouse                       │
│  - AWS S3                           │
└─────────────────────────────────────┘
```

**Benefits**:
- Separation of concerns
- Testability
- Maintainability
- Reusability

### 2. Response Standardization

All endpoints use standardized response handlers:

```javascript
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools';

router.post('/endpoint', async (req, res) => {
  const { param1, param2 } = req.body;
  try {
    const result = await someOperation(param1, param2);
    generalApiResponseSender(res, result);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});
```

**Benefits**:
- Consistent error handling
- Standardized response format
- Centralized logging
- Easy debugging

### 3. JWT Authentication

**Authentication Flow**:

```
1. User Login
   POST /auth/login
   { email, password }
   │
   ▼
2. Server validates credentials
   └─→ Query database
       └─→ Verify password
   │
   ▼
3. Generate JWT token
   └─→ Sign with SECRET
       └─→ Include user data (userId, email)
   │
   ▼
4. Return token
   { token: "eyJhbGci...", sessionId: "uuid" }
   │
   ▼
5. Client stores token
   └─→ localStorage or memory
   │
   ▼
6. Subsequent requests
   Authorization: Bearer eyJhbGci...
   │
   ▼
7. Server verifies token
   └─→ verifyToken(req, res)
       └─→ Decode and validate
           └─→ Check expiration
   │
   ▼
8. Grant access or reject (401)
```

### 4. Draft/Active Workflow (Knowledge Base)

**Two-Stage Content Management**:

```
┌─────────────────────────────────────────────────────────────┐
│                     DRAFT STATE                              │
│  - Editable content                                         │
│  - No impact on production                                  │
│  - Can be discarded                                         │
│                                                             │
│  Operations:                                                │
│  - POST /kb/apis (create draft)                            │
│  - PUT /kb/apis/:id (update draft)                         │
│  - GET /kb/draft/apis (list drafts)                        │
│  - DELETE /kb/apis/:id (delete draft)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ POST /kb/submit
                       │ POST /kb/build-rag
                       │ POST /kb/update-rag
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     ACTIVE STATE                             │
│  - Read-only (via UI)                                       │
│  - Used in production                                       │
│  - Served to AI agents                                      │
│  - Vector embeddings generated                              │
│                                                             │
│  Operations:                                                │
│  - GET /kb/active/apis (list active)                       │
│  - GET /kb/active/tables (list active)                     │
└─────────────────────────────────────────────────────────────┘
```

**Benefits**:
- Safe editing without affecting production
- Review before promotion
- Rollback capability
- Version control

### 5. Asynchronous Processing with WebSockets

**Pattern for Long-Running Operations**:

```javascript
// 1. Immediate response
router.post('/kb/upload-openapi', (req, res) => {
  const { projectId, openapi } = req.body;

  // Return immediately
  generalApiResponseSender(res, {
    success: true,
    status: 'processing',
    message: 'Upload started. Updates via socket.'
  });

  // Process asynchronously
  setImmediate(async () => {
    const result = await processOpenApi(projectId, openapi);

    // Notify via WebSocket
    io.to(String(userId)).emit('kb:upload-openapi:complete', {
      status: 'success',
      data: result
    });
  });
});
```

**Benefits**:
- Fast API responses (no timeout)
- Progress updates to client
- Better user experience
- Scalable for heavy operations

## Data Flow

### Request Flow

```
1. Client Request
   └─→ HTTP/HTTPS
       └─→ localhost:3000/api/endpoint

2. Express Middleware Chain
   └─→ CORS middleware
       └─→ JSON body parser
           └─→ URL-encoded parser
               └─→ Timeout handler

3. Route Handler (services/*.js)
   └─→ Extract parameters (body, params, query)
       └─→ Validate input

4. Controller Function (controller/*/*.js)
   └─→ Business logic
       └─→ Database queries
           └─→ External API calls

5. Response
   └─→ generalApiResponseSender()
       └─→ JSON response
           └─→ Status code

6. Error Handling (if error occurs)
   └─→ generalApiErrorHandler()
       └─→ Error response
           └─→ Status code + message
```

### Authentication Flow

```
1. Token in Request Header
   Authorization: Bearer eyJhbGci...

2. verifyToken() Middleware
   └─→ Extract token from header
       └─→ Verify JWT signature
           └─→ Check expiration
               └─→ Decode payload

3. Success
   └─→ req.user = decoded user data
       └─→ Continue to route handler

4. Failure
   └─→ Return 401 Unauthorized
       └─→ "Token invalid or expired"
```

### Database Connection

```
PostgreSQL Connection Pool (postgres.js)
└─→ Max 20 connections
    └─→ Idle timeout: 30s
        └─→ Connection timeout: 2s
            └─→ Reuse connections
                └─→ Auto-reconnect on failure
```

## Scalability Considerations

### Current Architecture

- **Single Node**: Single Express server instance
- **Vertical Scaling**: Scale by increasing server resources
- **Database Connection Pooling**: Efficient PostgreSQL connection reuse

### Future Scaling Options

1. **Horizontal Scaling**:
   - Load balancer (nginx, AWS ALB)
   - Multiple Node.js instances
   - Sticky sessions for WebSockets

2. **Database Scaling**:
   - Read replicas for PostgreSQL
   - Database sharding
   - Caching layer (Redis)

3. **Microservices**:
   - Split services into independent deployments
   - Service mesh (Istio, Linkerd)
   - API gateway

4. **Serverless**:
   - AWS Lambda for specific endpoints
   - API Gateway
   - DynamoDB for certain workloads

## Security Architecture

### Authentication & Authorization

- **JWT Tokens**: Signed with SECRET, include user ID and role
- **Token Expiration**: Configurable expiration time
- **Password Hashing**: bcrypt or similar (handled by authentication controller)
- **Role-Based Access**: User roles determine permissions

### Data Protection

- **HTTPS**: Required for production (configured at load balancer/reverse proxy)
- **Environment Variables**: Sensitive data in `.env` (never committed)
- **AWS Secrets Manager**: API keys and credentials stored securely
- **SQL Injection Prevention**: Parameterized queries via pg library
- **CORS**: Whitelist-based origin validation

### Input Validation

- **Request Validation**: Parameters validated in service layer
- **SQL Injection**: Prevented by parameterized queries
- **XSS Prevention**: Input sanitization, Content-Security-Policy headers
- **Rate Limiting**: Should be implemented at reverse proxy level

## Monitoring & Observability

### OpenTelemetry Integration

```javascript
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ElasticDashSpanProcessor } from "@elasticdash/otel";

const sdk = new NodeSDK({
  spanProcessors: [new ElasticDashSpanProcessor()],
});

sdk.start();
```

**Captures**:
- Request/response traces
- Database query performance
- External API call latency
- Error rates and stack traces

### Logging

- **Console Logging**: Development and debugging
- **Structured Logs**: JSON format for log aggregation
- **Log Levels**: Debug, info, warn, error
- **OTEL Logging**: Sent to ElasticDash OTEL endpoint

### Health Checks

Implement health check endpoints:
```javascript
GET /health
→ { status: "ok", database: "connected", timestamp: "..." }
```

## Background Workers

### Test Case Run Worker

```javascript
// worker/testCaseRunWorker.js
// Polls database every 5 seconds for pending test runs
// Executes tests and updates results
```

### Auto Feature Analyzer

```javascript
// worker/autoFeatureAnalyzer.js
// Analyzes traces for new features
// AI-powered pattern detection
```

## Best Practices

### Code Organization

1. **Separate Concerns**: Keep routes, business logic, and data access separate
2. **DRY Principle**: Reuse common functions (response handlers, validators)
3. **Naming Conventions**: Clear, descriptive names for files and functions
4. **Module Exports**: Use ES6 modules consistently

### Error Handling

1. **Try-Catch**: Wrap async operations in try-catch
2. **Standardized Errors**: Use `generalApiErrorHandler` for all errors
3. **Meaningful Messages**: Provide clear error messages for debugging
4. **Status Codes**: Use appropriate HTTP status codes

### Database Operations

1. **Connection Pooling**: Reuse connections
2. **Parameterized Queries**: Prevent SQL injection
3. **Transactions**: Use for multi-step operations
4. **Indexes**: Optimize frequent queries with indexes

### API Design

1. **RESTful**: Follow REST principles (GET, POST, PUT, DELETE)
2. **Consistent Naming**: Use clear, consistent endpoint names
3. **Versioning**: Consider API versioning for breaking changes
4. **Documentation**: Maintain OpenAPI docs for all endpoints

## Next Steps

- Review [Development Guidelines](development.md) for coding standards
- Explore [API Overview](api-overview.md) for endpoint details
- Check [Configuration Guide](configuration.md) for environment setup
