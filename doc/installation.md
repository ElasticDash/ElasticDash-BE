# Installation Guide

This guide walks you through installing and setting up the ElasticDash Backend on your local development environment.

## Prerequisites

Before you begin, ensure you have the following installed and configured:

### Required Software

1. **Node.js** (v14 or higher recommended)
   ```bash
   node --version  # Should be v14.x or higher
   ```

2. **npm** (comes with Node.js)
   ```bash
   npm --version
   ```

3. **PostgreSQL** (v12 or higher)
   ```bash
   psql --version
   ```

4. **Git**
   ```bash
   git --version
   ```

### Optional but Recommended

5. **ClickHouse** (for analytics and logging)
   - Download from: https://clickhouse.com/docs/en/install

6. **AWS CLI** (for AWS services configuration)
   ```bash
   aws --version
   ```

## ⚠️ Note: Test Features

This project includes test/demo features that should be removed before production:
- **Pokemon Service**: For testing API patterns with [PokeAPI](https://pokeapi.co/) data
- **Chat Service**: Currently configured for testing (review before production)

See the [Development Guidelines](development.md#production-deployment-checklist) for the production deployment checklist.

## Installation Steps

### 1. Clone the Repository

```bash
git clone <repository-url>
cd ElasticDash-API
```

### 2. Install Dependencies

Install all Node.js dependencies using npm:

```bash
npm install
```

This will install:
- **Core Dependencies**: Express, PostgreSQL client, Socket.IO
- **AWS SDK**: S3, Secrets Manager, OpenSearch clients
- **AI SDKs**: OpenAI, Anthropic (Claude), Google GenAI, xAI
- **Database**: PostgreSQL (pg), ClickHouse
- **Authentication**: jsonwebtoken
- **Payment**: Stripe
- **Observability**: OpenTelemetry, @elasticdash/otel
- **Development Tools**: Babel, ESLint, Nodemon, Jest

### 3. Set Up PostgreSQL Database

#### Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE testdb;

# Create users
CREATE USER black_ace WITH PASSWORD 'p3xJ0sarS46sq';
CREATE USER readonly_user WITH PASSWORD 'strong_password';

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE testdb TO black_ace;
GRANT CONNECT ON DATABASE testdb TO readonly_user;
```

#### Initialize Database Schema

```bash
# Connect to your new database
psql -U black_ace -d testdb

# Run schema migrations (if migration files exist)
# Check the /database folder for schema files
```

Navigate to the `/database` folder to find schema initialization scripts and run them in order.

### 4. Set Up ClickHouse (Optional)

If you're using ClickHouse for analytics:

```bash
# Start ClickHouse server
# Follow installation instructions from: https://clickhouse.com/docs/en/install

# Create database
clickhouse-client --query "CREATE DATABASE IF NOT EXISTS default"
```

### 5. Configure AWS Services

You'll need AWS credentials for:
- **S3**: File storage
- **Secrets Manager**: Secure credential storage
- **SQS**: Background job queues (optional)

#### Configure AWS Credentials

```bash
# Option 1: Using AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., ap-southeast-2)

# Option 2: Set environment variables (covered in configuration.md)
```

#### Create S3 Buckets

```bash
# Create main bucket
aws s3 mb s3://elasticdash-test --region ap-southeast-2

# Create public resources bucket
aws s3 mb s3://elasticdash-public-resources --region ap-southeast-2

# Configure bucket policies for public access (if needed)
```

### 6. Obtain API Keys

You'll need API keys from various services:

1. **OpenAI API Key**
   - Sign up at: https://platform.openai.com/
   - Generate API key from: https://platform.openai.com/api-keys

2. **Anthropic Claude API Key**
   - Sign up at: https://console.anthropic.com/
   - Generate API key from console

3. **xAI API Key** (if using xAI/Grok)
   - Sign up at: https://x.ai/
   - Generate API key from console

4. **Google Gemini API Key** (if using Gemini)
   - Sign up at: https://ai.google.dev/
   - Generate API key from Google AI Studio

5. **Stripe API Keys** (for payment processing)
   - Sign up at: https://stripe.com/
   - Get keys from: https://dashboard.stripe.com/apikeys
   - Get webhook secret from: https://dashboard.stripe.com/webhooks

6. **SendPulse Credentials** (for email notifications)
   - Sign up at: https://sendpulse.com/
   - Get credentials from API settings

## Verification

After installation, verify everything is set up correctly:

```bash
# Check Node.js installation
node --version

# Check npm packages are installed
npm list --depth=0

# Check PostgreSQL connection
psql -U black_ace -d testdb -c "SELECT version();"

# Check ClickHouse connection (if installed)
clickhouse-client --query "SELECT version()"
```

## Common Issues

### Issue: PostgreSQL Connection Refused

**Solution**: Ensure PostgreSQL service is running
```bash
# macOS
brew services start postgresql

# Linux
sudo systemctl start postgresql

# Windows
# Start PostgreSQL service from Services panel
```

### Issue: Port 3000 Already in Use

**Solution**: Either stop the process using port 3000 or change PORT in `.env`
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change PORT in .env file
PORT=3001
```

### Issue: AWS Credentials Not Found

**Solution**: Set AWS credentials in environment or `.env` file
```bash
# Set environment variables
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=ap-southeast-2
```

### Issue: npm install Fails

**Solution**: Clear npm cache and retry
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

After completing installation:

1. **Configure Environment**: See [Configuration Guide](configuration.md)
2. **Start the Server**: See [Getting Started Guide](getting-started.md)
3. **Test API Endpoints**: Use the OpenAPI documentation in `/openapi-doc/`

## Additional Resources

- **PostgreSQL Documentation**: https://www.postgresql.org/docs/
- **ClickHouse Documentation**: https://clickhouse.com/docs
- **AWS SDK Documentation**: https://docs.aws.amazon.com/sdk-for-javascript/
- **Express.js Documentation**: https://expressjs.com/
