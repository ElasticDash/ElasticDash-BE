# Configuration Guide

This guide explains all configuration options and environment variables needed to run ElasticDash API.

## Environment Files

The project uses `.env` files for configuration. Multiple environment files are available:

- `.env` - Local development (default)
- `.env.staging` - Staging environment
- `.env.production.local` - Production environment
- `.env.test.local` - Testing environment

## Configuration Steps

### 1. Create Your Environment File

```bash
# Copy one of the existing environment files
cp .env.staging .env

# Or create a new one
touch .env
```

### 2. Configure Required Variables

Edit your `.env` file with the following configuration:

## Environment Variables Reference

### Database Configuration

#### PostgreSQL (Primary Database)

```bash
# Main database connection (read-write access)
DB_CONNECTION_STRING=postgres://username:password@host:port/database?sslmode=disable

# Read-only connection (for queries that don't need write access)
DB_CONNECTION_STRING_READONLY=postgres://readonly_user:password@host:port/database?sslmode=disable

# Logger database connection (for logging and audit trails)
DB_CONNECTION_LOGGER=postgres://postgres:postgres@localhost:5433/postgres
```

**Format**: `postgres://[user]:[password]@[host]:[port]/[database]?[options]`

**Example**:
```bash
DB_CONNECTION_STRING=postgres://black_ace:p3xJ0sarS46sq@localhost:5432/testdb?sslmode=disable
```

#### ClickHouse (Analytics Database)

```bash
# ClickHouse HTTP endpoint
CLICKHOUSE_URL=http://172.31.1.47:8123

# ClickHouse native protocol endpoint (for migrations)
CLICKHOUSE_MIGRATION_URL=clickhouse://172.31.1.47:9000

# Cluster configuration
CLICKHOUSE_CLUSTER_NAME=default
CLICKHOUSE_DB=default
CLICKHOUSE_USER=clickhouse
CLICKHOUSE_PASSWORD=clickhouse
CLICKHOUSE_CLUSTER_ENABLED=false
```

### AWS Services Configuration

#### S3 Buckets

```bash
# Main application bucket (for user uploads, traces, etc.)
S3_BUCKET_NAME=elasticdash-test

# Public resources bucket (for public assets, images, etc.)
S3_PUBLIC_BUCKET_NAME=elasticdash-public-resources
```

#### AWS Credentials

```bash
# AWS Region (must match your S3 bucket region)
AWS_REGION=ap-southeast-2

# AWS Access Key
AWS_AK=your_access_key_id

# AWS Secret Access Key
AWS_SAK=your_secret_access_key
```

**Security Note**: Never commit actual AWS credentials to version control. Use IAM roles in production.

#### AWS SQS (Message Queues)

```bash
# Repository processing queue
AWS_SQS_URL_REPOSITORY=https://sqs.ap-southeast-2.amazonaws.com/account-id/queue-name

# Scanner queue
AWS_SQS_URL_SCANNER=https://sqs.ap-southeast-2.amazonaws.com/account-id/queue-name

# Commit scanner queue
AWS_SQS_URL_COMMIT_SCANNER=https://sqs.ap-southeast-2.amazonaws.com/account-id/queue-name

# Test queue
AWS_SQS_URL_TEST=https://sqs.ap-southeast-2.amazonaws.com/account-id/queue-name
```

#### AWS Secrets Manager

```bash
# Secrets Manager endpoint (usually based on region)
AWS_SECRET_MANAGER_URL=https://secretsmanager.ap-southeast-2.amazonaws.com
```

### AI Provider API Keys

#### OpenAI

```bash
# OpenAI API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-...

# Default model to use for OpenAI requests
OPENAI_DEFAULT_MODEL=gpt-4-turbo
```

**Available Models**: `gpt-4`, `gpt-4-turbo`, `gpt-3.5-turbo`

#### Anthropic Claude

```bash
# Claude API key from https://console.anthropic.com/
CLAUDE_API_KEY=sk-ant-api03-...
```

**Available Models**: `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku`

#### xAI (Grok)

```bash
# xAI API key from https://x.ai/
XAI_API_KEY=xai-...
```

#### Google Gemini

```bash
# Gemini API key from https://ai.google.dev/
GEMINI_API_KEY=AIza...
```

### Authentication & Security

```bash
# JWT secret for token signing (use a strong random string)
SECRET=your_jwt_secret_key_here

# Local API key for internal services
LOCAL_API_KEY=your_local_api_key
```

**Generating a strong secret**:
```bash
# Generate a random 32-character string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Payment Processing (Stripe)

```bash
# Stripe secret key from https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_...

# Stripe webhook secret from https://dashboard.stripe.com/webhooks
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Note**: Use test keys (`sk_test_`) for development, live keys (`sk_live_`) for production.

### Email Service (SendPulse)

```bash
# SendPulse API credentials from https://sendpulse.com/
SENDPULSE_CLIENT_ID=your_client_id
SENDPULSE_CLIENT_SECRET=your_client_secret
SENDPULSE_GRANT_TYPE=client_credentials
```

### URLs and Endpoints

```bash
# Frontend application URL (for CORS and redirects)
FRONTEND_URL=https://dev-app-eks.elasticdash.com

# Backend API base URL (for webhooks and callbacks)
BACKEND_URL=https://devserver.elasticdash.com/api
```

### OpenTelemetry (Observability)

```bash
# OTEL collector endpoint
OTEL_EXPORTER_OTLP_ENDPOINT=https://devserver-logger.elasticdash.com/api/public/otel

# OTEL authentication headers (base64 encoded credentials)
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic base64_encoded_credentials"

# OTEL log level (debug, info, warn, error)
OTEL_LOG_LEVEL=debug
```

### Application Settings

```bash
# Node environment (development, staging, production)
NODE_ENV=development

# Server port
PORT=3000

# Table name (for legacy compatibility)
TABLE_NAME=test_table
```

## Environment-Specific Configuration

### Development Environment

```bash
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000/api
OTEL_LOG_LEVEL=debug
```

### Staging Environment

```bash
NODE_ENV=staging
PORT=3000
FRONTEND_URL=https://staging-app.elasticdash.com
BACKEND_URL=https://staging-server.elasticdash.com/api
OTEL_LOG_LEVEL=info
```

### Production Environment

```bash
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://app.elasticdash.com
BACKEND_URL=https://server.elasticdash.com/api
OTEL_LOG_LEVEL=error
```

## Minimal Configuration (Quick Start)

For local development, you only need these essential variables:

```bash
# Database
DB_CONNECTION_STRING=postgres://black_ace:password@localhost:5432/testdb?sslmode=disable

# JWT Secret
SECRET=your_random_secret_key

# Server
PORT=3000
NODE_ENV=development

# URLs
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000/api

# At least one AI provider
OPENAI_API_KEY=sk-proj-your-key
OPENAI_DEFAULT_MODEL=gpt-4-turbo
```

## Configuration Validation

After configuring your environment, validate the configuration:

```bash
# Test database connection
node -e "require('./postgres').pool.query('SELECT NOW()', (err, res) => { console.log(err ? 'DB Error: ' + err : 'DB Connected: ' + res.rows[0].now); process.exit(); })"

# Test AWS credentials
aws s3 ls s3://elasticdash-test --region ap-southeast-2

# Start the server and check logs
npm run dev
```

## Security Best Practices

### 1. Never Commit Secrets

Add `.env` to `.gitignore`:
```bash
# .gitignore
.env
.env.local
.env.*.local
```

### 2. Use Strong Secrets

```bash
# Generate strong random secrets
openssl rand -base64 32
```

### 3. Use IAM Roles in Production

Instead of `AWS_AK` and `AWS_SAK`, use IAM roles for EC2/ECS instances.

### 4. Rotate Credentials Regularly

- Rotate JWT secrets
- Rotate API keys
- Rotate database passwords

### 5. Use Environment-Specific Keys

- Test keys for development/staging
- Production keys only in production

## Troubleshooting

### Issue: "Cannot connect to database"

Check:
- PostgreSQL is running
- Connection string format is correct
- User has correct permissions
- Host and port are accessible

### Issue: "AWS credentials not found"

Check:
- `AWS_AK` and `AWS_SAK` are set
- `AWS_REGION` matches your bucket region
- Credentials have correct S3 permissions

### Issue: "OpenAI API error 401"

Check:
- `OPENAI_API_KEY` is valid and not expired
- API key has correct permissions
- Billing is set up on OpenAI account

## Next Steps

After configuration:

1. **Verify Setup**: Test database and AWS connections
2. **Start Server**: Follow [Getting Started Guide](getting-started.md)
3. **Test Endpoints**: Use OpenAPI documentation to test APIs

## Additional Resources

- [AWS Configuration Guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html)
- [PostgreSQL Connection Strings](https://www.postgresql.org/docs/current/libpq-connect.html#LIBPQ-CONNSTRING)
- [OpenAI API Documentation](https://platform.openai.com/docs/api-reference)
- [Stripe API Documentation](https://stripe.com/docs/api)
