# Development Guidelines

This guide provides coding standards, best practices, and development workflows for contributing to ElasticDash Backend.

## Coding Standards

### API Endpoint Pattern (REQUIRED)

**All API endpoints MUST follow this pattern** as defined in `/CLAUDE.md`:

```javascript
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools';

router.post('/example', async (req, res) => {
  // 1. Extract parameters from req (body, params, query)
  // Avoid using req directly in business logic
  const { attribute1, attribute2 } = req.body;

  try {
    // 2. Call controller function with extracted parameters
    const result = await functionLogic(attribute1, attribute2);

    // 3. Send response using standardized handler
    generalApiResponseSender(res, result);
  } catch (err) {
    // 4. Handle errors using standardized handler
    generalApiErrorHandler(res, err);
  }
});
```

**Key Requirements**:
1. ✅ Extract parameters from `req.body`, `req.params`, or `req.query`
2. ✅ Never pass `req` object directly to controller functions
3. ✅ Use `generalApiResponseSender` for all success responses
4. ✅ Use `generalApiErrorHandler` for all error responses
5. ✅ Avoid using query or path parameters in POST requests (use body instead)
6. ✅ Wrap async operations in try-catch blocks

**Example Reference**: See `services/plan.js` for the canonical implementation.

### Response Patterns

#### Success Response

```javascript
// Simple success
generalApiResponseSender(res, result);

// With status code
generalApiResponseSender(res, result, 201); // Created

// Response structure
{
  // Direct data response or
  "success": true,
  "data": { ... }
}
```

#### Error Response

```javascript
// Simple error
generalApiErrorHandler(res, err);

// Custom error
generalApiErrorHandler(res, {
  status: 400,
  message: "Invalid input parameters"
});

// Error structure
{
  "status": 400,
  "message": "Error description",
  "error": { ... } // Optional
}
```

### Controller Organization

Business logic should be in `/controller` folder, NOT in `/services`:

```
services/user.js          # Route handlers only
  └─→ Calls functions in:
controller/user/profile.js   # Business logic and DB operations
controller/user/settings.js
controller/user/feedback.js
```

**Never put database operations directly in services files.**

## File Structure Guidelines

### Adding a New Service

1. **Create Service File** (`services/new-service.js`):
```javascript
import express from 'express';
import {
  generalApiResponseSender,
  generalApiErrorHandler
} from '../controller/general/tools';

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const result = await listItems();
    generalApiResponseSender(res, result);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

export { router as newService };
```

2. **Create Controller** (`controller/new-service/new-service.js`):
```javascript
import { pool } from '../../postgres';

export const listItems = async () => {
  const result = await pool.query('SELECT * FROM items');
  return result.rows;
};
```

3. **Register Route** (`routes.js`):
```javascript
import { newService } from './services/new-service';

export function root(app) {
  // ... existing routes
  app.use('/api/new-service', newService);
}
```

4. **Add OpenAPI Documentation** (`openapi-doc/openapi-new-service.json`):
```json
{
  "openapi": "3.0.0",
  "info": {
    "title": "New Service API",
    "version": "1.0.0"
  },
  "paths": {
    "/new-service/list": {
      "get": {
        "summary": "List items",
        "responses": {
          "200": {
            "description": "Items retrieved successfully"
          }
        }
      }
    }
  }
}
```

### Adding a New Endpoint to Existing Service

1. **Add Route Handler** (e.g., `services/user.js`):
```javascript
router.post('/new-endpoint', async (req, res) => {
  const { param1, param2 } = req.body;

  try {
    const result = await newEndpointLogic(param1, param2);
    generalApiResponseSender(res, result);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});
```

2. **Add Controller Function** (e.g., `controller/user/operations.js`):
```javascript
export const newEndpointLogic = async (param1, param2) => {
  // Validate inputs
  if (!param1 || !param2) {
    throw { status: 400, message: 'Missing required parameters' };
  }

  // Business logic
  const result = await pool.query(
    'INSERT INTO table (col1, col2) VALUES ($1, $2) RETURNING *',
    [param1, param2]
  );

  return result.rows[0];
};
```

3. **Update OpenAPI Documentation** (`openapi-doc/openapi-user.json`):
```json
{
  "/user/new-endpoint": {
    "post": {
      "summary": "New endpoint description",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["param1", "param2"],
              "properties": {
                "param1": { "type": "string" },
                "param2": { "type": "number" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Success" },
        "400": { "description": "Bad request" }
      }
    }
  }
}
```

## Database Best Practices

### Using Connection Pool

```javascript
import { pool } from '../../postgres';

// Good: Use parameterized queries
const result = await pool.query(
  'SELECT * FROM users WHERE email = $1',
  [email]
);

// Bad: String concatenation (SQL injection risk!)
const result = await pool.query(
  `SELECT * FROM users WHERE email = '${email}'`
);
```

### Transactions

For multi-step operations that must succeed or fail together:

```javascript
export const createUserWithProfile = async (userData, profileData) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Step 1: Insert user
    const userResult = await client.query(
      'INSERT INTO users (email, password) VALUES ($1, $2) RETURNING id',
      [userData.email, userData.password]
    );

    const userId = userResult.rows[0].id;

    // Step 2: Insert profile
    await client.query(
      'INSERT INTO profiles (user_id, first_name, last_name) VALUES ($1, $2, $3)',
      [userId, profileData.firstName, profileData.lastName]
    );

    await client.query('COMMIT');
    return { success: true, userId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
```

### Query Optimization

```javascript
// Good: Select only needed columns
SELECT id, email, first_name FROM users WHERE id = $1

// Bad: Select all columns when not needed
SELECT * FROM users WHERE id = $1

// Good: Use LIMIT for pagination
SELECT * FROM traces ORDER BY created_at DESC LIMIT 20 OFFSET 0

// Good: Create indexes for frequently queried columns
CREATE INDEX idx_traces_user_id ON traces(user_id);
CREATE INDEX idx_traces_created_at ON traces(created_at DESC);
```

## Authentication Implementation

### Protected Endpoints

```javascript
import { verifyToken } from '../controller/auth/auth';

// Method 1: Manual verification
router.get('/protected', async (req, res) => {
  try {
    const userDetail = await verifyToken(req, res, {});

    if (!userDetail || userDetail.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "Authentication required"
      });
    }

    const userId = userDetail.userId;
    // Continue with authenticated logic
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});

// Method 2: Middleware pattern (preferred)
const authMiddleware = async (req, res, next) => {
  try {
    const userDetail = await verifyToken(req, res, {});

    if (!userDetail || userDetail.statusCode === 401) {
      return generalApiErrorHandler(res, {
        status: 401,
        message: "Authentication required"
      });
    }

    req.user = userDetail; // Attach user to request
    next();
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
};

router.get('/protected', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  // Authenticated logic
});
```

## Error Handling

### Standard Error Format

```javascript
// Throw errors with status and message
throw {
  status: 400, // HTTP status code
  message: "Descriptive error message"
};

// With additional details
throw {
  status: 422,
  message: "Validation failed",
  errors: {
    email: "Invalid email format",
    password: "Password too short"
  }
};
```

### Common HTTP Status Codes

```javascript
// 200 OK - Success
generalApiResponseSender(res, result);

// 201 Created - Resource created
generalApiResponseSender(res, result, 201);

// 400 Bad Request - Invalid input
throw { status: 400, message: "Missing required parameters" };

// 401 Unauthorized - Authentication required
throw { status: 401, message: "Token invalid or expired" };

// 403 Forbidden - Insufficient permissions
throw { status: 403, message: "Access denied" };

// 404 Not Found - Resource not found
throw { status: 404, message: "User not found" };

// 422 Unprocessable Entity - Validation failed
throw { status: 422, message: "Email already exists" };

// 500 Internal Server Error - Server error
throw { status: 500, message: "Database connection failed" };
```

## Input Validation

### Validate Early

```javascript
router.post('/create-user', async (req, res) => {
  const { email, password, firstName } = req.body;

  try {
    // Validate required fields
    if (!email || !password || !firstName) {
      throw {
        status: 400,
        message: "Missing required fields: email, password, firstName"
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw { status: 400, message: "Invalid email format" };
    }

    // Validate password strength
    if (password.length < 8) {
      throw { status: 400, message: "Password must be at least 8 characters" };
    }

    // Continue with logic
    const result = await createUser(email, password, firstName);
    generalApiResponseSender(res, result);
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});
```

### Reusable Validation Helper

```javascript
// controller/general/validation.js
export const validateBodyWithKeys = (body, requiredKeys, allowEmpty = false) => {
  for (const key of requiredKeys) {
    if (!(key in body)) {
      throw {
        status: 400,
        message: `Missing required field: ${key}`
      };
    }

    if (!allowEmpty && !body[key]) {
      throw {
        status: 400,
        message: `Field cannot be empty: ${key}`
      };
    }
  }

  return true;
};

// Usage
import { validateBodyWithKeys } from '../controller/general/validation';

router.post('/endpoint', async (req, res) => {
  const body = req.body;

  try {
    validateBodyWithKeys(body, ['email', 'password'], false);
    // Continue with logic
  } catch (err) {
    generalApiErrorHandler(res, err);
  }
});
```

## Testing

### Unit Tests

```javascript
// tests/user.test.js
import { createUser } from '../controller/user/user';

describe('User Controller', () => {
  test('createUser should create a new user', async () => {
    const result = await createUser('test@example.com', 'password123', 'Test');

    expect(result).toHaveProperty('id');
    expect(result.email).toBe('test@example.com');
  });

  test('createUser should throw error for duplicate email', async () => {
    await expect(
      createUser('duplicate@example.com', 'pass', 'Test')
    ).rejects.toThrow('Email already exists');
  });
});
```

### Integration Tests

```javascript
// tests/api/user.test.js
import request from 'supertest';
import app from '../index';

describe('User API', () => {
  test('POST /user/register should create user', async () => {
    const response = await request(app)
      .post('/api/user/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!',
        firstName: 'Test',
        lastName: 'User'
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('token');
  });
});
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- user.test.js

# Run with coverage
npm test -- --coverage

# Run in watch mode
npm test -- --watch
```

## Git Workflow

### Branch Naming

```bash
# Feature branches
git checkout -b feature/add-user-settings

# Bug fixes
git checkout -b fix/authentication-error

# Hotfixes
git checkout -b hotfix/security-patch
```

### Commit Messages

Follow conventional commits format:

```bash
# Feature
git commit -m "feat: add user settings endpoint"

# Bug fix
git commit -m "fix: resolve JWT token expiration issue"

# Documentation
git commit -m "docs: update API documentation for user service"

# Refactoring
git commit -m "refactor: extract validation logic to helper"

# Tests
git commit -m "test: add unit tests for user controller"
```

### Pull Request Process

1. Create feature branch
2. Make changes and commit
3. Write/update tests
4. Update OpenAPI documentation
5. Push and create PR
6. Code review
7. Merge to development/main branch

## Environment Management

### Development

```bash
# .env file
NODE_ENV=development
PORT=3000
# Development database
DB_CONNECTION_STRING=postgres://...localhost...
# Test API keys
OPENAI_API_KEY=sk-test-...
```

### Staging

```bash
# .env.staging file
NODE_ENV=staging
PORT=3000
# Staging database
DB_CONNECTION_STRING=postgres://...staging-db...
# Staging API keys
OPENAI_API_KEY=sk-staging-...
```

### Production

```bash
# .env.production.local file
NODE_ENV=production
PORT=3000
# Production database (use environment variables, not .env file)
# Production API keys (use AWS Secrets Manager)
```

## Code Style

### ES6+ Features

```javascript
// Use const/let, not var
const userId = 123;
let counter = 0;

// Use arrow functions
const mapUsers = users.map(u => ({ id: u.id, name: u.name }));

// Use template literals
const message = `User ${userId} created`;

// Use destructuring
const { email, password } = req.body;

// Use spread operator
const newUser = { ...baseUser, ...updates };

// Use async/await
const result = await fetchData();
```

### Naming Conventions

```javascript
// Variables and functions: camelCase
const userCount = 10;
function getUserById(id) { }

// Constants: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
const API_TIMEOUT = 5000;

// Classes: PascalCase
class UserService { }

// Files: kebab-case
// user-service.js
// auth-middleware.js
```

### Comments

```javascript
// Good: Explain WHY, not WHAT
// Use JWT for stateless authentication to avoid session storage
const token = jwt.sign(payload, SECRET);

// Bad: Obvious comment
// Create a token
const token = jwt.sign(payload, SECRET);

// Good: Document complex logic
/**
 * Builds RAG embeddings for knowledge base
 * Uses OpenAI ada-002 for vector generation
 * Stores in ClickHouse for similarity search
 */
async function buildRAGEmbeddings() { }
```

## Performance Best Practices

### Database

```javascript
// Use connection pooling (already configured)
import { pool } from './postgres';

// Use indexes
CREATE INDEX idx_user_email ON users(email);

// Paginate large result sets
SELECT * FROM traces LIMIT 20 OFFSET 0;

// Use EXPLAIN to analyze slow queries
EXPLAIN ANALYZE SELECT * FROM traces WHERE user_id = 123;
```

### Caching

```javascript
// Cache expensive operations
const cache = new Map();

export const getExpensiveData = async (key) => {
  if (cache.has(key)) {
    return cache.get(key);
  }

  const data = await expensiveOperation(key);
  cache.set(key, data);

  // Expire after 5 minutes
  setTimeout(() => cache.delete(key), 5 * 60 * 1000);

  return data;
};
```

### Async Operations

```javascript
// Good: Parallel execution
const [users, projects, traces] = await Promise.all([
  getUsers(),
  getProjects(),
  getTraces()
]);

// Bad: Sequential execution (slower)
const users = await getUsers();
const projects = await getProjects();
const traces = await getTraces();
```

## Security Checklist

- [ ] Never commit `.env` files or secrets
- [ ] Use parameterized queries (prevent SQL injection)
- [ ] Validate all user inputs
- [ ] Use HTTPS in production
- [ ] Implement rate limiting
- [ ] Hash passwords (never store plain text)
- [ ] Validate JWT tokens on protected endpoints
- [ ] Use CORS whitelist
- [ ] Sanitize user input for XSS prevention
- [ ] Keep dependencies updated (`npm audit`)

## Debugging Tips

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=* npm run dev

# Enable specific module logs
DEBUG=express:* npm run dev
```

### Database Query Logging

```javascript
// Enable query logging in postgres.js
pool.on('connect', () => {
  console.log('PostgreSQL connected');
});

pool.on('error', (err) => {
  console.error('PostgreSQL error:', err);
});
```

### API Request Logging

```javascript
// Add logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

## Common Pitfalls to Avoid

### 1. Not Extracting Parameters

```javascript
// Bad: Using req directly in controller
const result = await createUser(req);

// Good: Extract parameters first
const { email, password } = req.body;
const result = await createUser(email, password);
```

### 2. Inconsistent Error Handling

```javascript
// Bad: Multiple error patterns
res.status(400).json({ error: "Bad request" });
return res.send({ status: 500, msg: "Error" });

// Good: Always use standardized handler
generalApiErrorHandler(res, { status: 400, message: "Bad request" });
```

### 3. Forgetting to Update OpenAPI Docs

Always update OpenAPI documentation when adding/modifying endpoints!

### 4. Not Using Transactions

```javascript
// Bad: Multiple operations without transaction
await pool.query('INSERT INTO users ...');
await pool.query('INSERT INTO profiles ...'); // If this fails, user is orphaned

// Good: Use transaction
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO users ...');
  await client.query('INSERT INTO profiles ...');
  await client.query('COMMIT');
} catch {
  await client.query('ROLLBACK');
} finally {
  client.release();
}
```

## Resources

- **Project Guidelines**: `/CLAUDE.md`
- **Architecture**: [Architecture Guide](architecture.md)
- **API Documentation**: `/openapi-doc/` directory
- **Examples**: See `services/plan.js` for reference implementation

## Getting Help

- Review existing code in `services/` and `controller/` folders
- Check OpenAPI documentation for endpoint patterns
- Read the [Architecture Guide](architecture.md) for system design
- Refer to `/CLAUDE.md` for project-specific rules

## Production Deployment Checklist

Before deploying to production:

### ⚠️ Remove Test Services

- [ ] **Remove Pokemon Service** (`/pokemon`)
  - Delete `services/pokemon.js`
  - Delete `controller/pokemon/` directory
  - Remove route from `routes.js`
  - Remove `openapi-doc/openapi-pokemon.json`
  - Drop Pokemon-related database tables

- [ ] **Review Chat Service** (`/chat`)
  - Configure for production use cases
  - Review and update conversation storage policies
  - Set appropriate rate limits
  - Configure production AI provider settings

### Security Checklist

- [ ] All test/demo endpoints removed
- [ ] Production environment variables configured
- [ ] Secrets stored in AWS Secrets Manager (not `.env`)
- [ ] HTTPS enforced
- [ ] Rate limiting implemented
- [ ] CORS whitelist updated for production domains
- [ ] Database backup strategy in place
- [ ] Error messages don't expose sensitive information
- [ ] Monitoring and alerting configured

### Performance Checklist

- [ ] Database indexes optimized
- [ ] Caching strategy implemented
- [ ] Connection pool sizes tuned
- [ ] Load testing completed
- [ ] CDN configured for static assets

## Summary Checklist

Before submitting code:

- [ ] Follows API endpoint pattern from `/CLAUDE.md`
- [ ] Uses `generalApiResponseSender` and `generalApiErrorHandler`
- [ ] Extracts parameters from req (not passing req directly)
- [ ] Includes input validation
- [ ] Has proper error handling (try-catch)
- [ ] Uses parameterized database queries
- [ ] Updates OpenAPI documentation
- [ ] Writes/updates tests
- [ ] Follows naming conventions
- [ ] No secrets in code
- [ ] Commits with conventional commit messages
