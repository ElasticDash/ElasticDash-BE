# ElasticDash Backend Documentation

Welcome to the ElasticDash Backend documentation. This comprehensive guide will help you set up, configure, and develop with the ElasticDash Backend platform.

## What is ElasticDash?

ElasticDash is a comprehensive API platform that provides intelligent monitoring, tracing, and analytics for applications. It offers AI-powered features for testing, debugging, and observability, with support for multiple AI providers (OpenAI, Claude, xAI, Gemini) and advanced knowledge base management.

## Key Features

- **Multi-AI Provider Support**: Integration with OpenAI, Claude, xAI, and Gemini
- **Knowledge Base Management**: Draft/active workflow for API and database schema documentation
- **Trace Analysis**: Advanced application tracing and observability
- **Test Case Management**: AI-powered test case generation and execution
- **User Management**: Complete authentication and authorization system
- **Real-time Communication**: WebSocket support for live updates
- **File Storage**: S3-based file management and CDN
- **Subscription Management**: Stripe integration for payment processing
- **OpenAPI Documentation**: Comprehensive API documentation for all 14 services

## ⚠️ Important Notes for Production

**Test Features - Remove Before Production:**

- **Pokemon Service** (`/pokemon`): Demo service for testing purposes only. Uses PokeAPI dataset to demonstrate API patterns and test chat functionality with ElasticDash. **Must be removed before production deployment.**

- **Chat Service** (`/chat`): Currently configured for testing AI chat integrations. Review and configure appropriately for production use cases before deployment.

**Testing with Pokemon Data:**
You can populate the Pokemon database using [PokeAPI](https://pokeapi.co/) data to test ElasticDash chat features and API patterns during development.

## Documentation Index

### Getting Started

1. **[Installation Guide](installation.md)** - Prerequisites, dependencies, and setup
2. **[Configuration Guide](configuration.md)** - Environment variables and configuration
3. **[Getting Started](getting-started.md)** - Step-by-step guide to run the project

### Developer Resources

4. **[API Overview](api-overview.md)** - Overview of all API services and endpoints
5. **[Architecture](architecture.md)** - Technical architecture and project structure
6. **[Development Guidelines](development.md)** - Coding standards and best practices

### API Documentation

All API endpoints are documented using OpenAPI 3.0 specification:

- **OpenAPI Documentation Files**: Located in `/openapi-doc/`
- **14 Service Modules**: auth, chat, features, persona, plan, pokemon, project, task, testCase, traceAnalysis, traces, user, general, admin
- **180+ Endpoints**: Comprehensive coverage of all API functionality

## Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd ElasticDash-API

# Install dependencies
npm install

# Configure environment
cp .env.staging .env
# Edit .env with your configuration

# Start development server
npm run dev
```

The API will be available at `http://localhost:3000/api`

## Technology Stack

- **Runtime**: Node.js with Babel
- **Framework**: Express.js
- **Database**: PostgreSQL
- **Cache/Analytics**: ClickHouse
- **File Storage**: AWS S3
- **Secrets Management**: AWS Secrets Manager
- **AI Providers**: OpenAI, Anthropic Claude, xAI, Google Gemini
- **Payment Processing**: Stripe
- **Real-time**: Socket.IO
- **Testing**: Jest
- **Observability**: OpenTelemetry

## Project Structure

```
ElasticDash-API/
├── controller/        # Business logic and database operations
├── services/          # Express route handlers (14 service modules)
├── openapi-doc/       # OpenAPI 3.0 documentation files
├── database/          # Database schemas and migrations
├── worker/            # Background workers and scheduled tasks
├── doc/               # Project documentation (this folder)
├── routes.js          # Main route aggregator
└── index.js           # Application entry point
```

## Support and Contribution

For issues, questions, or contributions:

- Review the [Development Guidelines](development.md)
- Check existing OpenAPI documentation in `/openapi-doc/`
- Follow the coding standards defined in `/CLAUDE.md`

## License

ISC

## Next Steps

- Read the [Installation Guide](installation.md) to set up your development environment
- Review the [Configuration Guide](configuration.md) to understand environment variables
- Follow the [Getting Started Guide](getting-started.md) for a step-by-step walkthrough
- Explore the [API Overview](api-overview.md) to understand available services
