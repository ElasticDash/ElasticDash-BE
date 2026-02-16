# ElasticDash Backend

Welcome to the **ElasticDash Backend**! This backend project powers the ElasticDash platform, providing robust endpoints for managing and visualizing data with high performance and scalability. The API is built with a focus on flexibility, efficiency, and ease of integration with the ElasticDash frontend.

---

## Features

- **Data Management**: CRUD operations for dashboards, widgets, and user data.
- **Authentication & Authorization**: Secure access with JWT-based authentication.
- **Scalable Architecture**: Designed to handle high-volume data and traffic.

---

## Getting Started

### Prerequisites

- **Node.js** (v20+)
- **npm** or **yarn**
- **PostgreSQL** (or any other configured relational database)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/ElasticDash/ElasticDash-API.git
   cd elasticdash-api
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables:
   Create a `.env` file at the root of the project and configure the following variables:
   ```env
   PORT=3000
   S3_BUCKET_NAME=[your S3 bucket name]
   DB_CONNECTION_STRING=postgres://[the rest of your DB connection string]
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Access the API at `http://localhost:3000`.

---

## API Endpoints

- **POST /chat/completion**: Orchestrated chat endpoint with planning, approval, and execution.
  - Send `{ messages: [{ role, content }], sessionId?, isApproval?, userId, customerUserId? }`.
  - `userId` (required): Internal user ID from the ElasticDash database.
  - `customerUserId` (optional): External/third-party customer user ID for chatbot integrations (different from your database users).
  - First call returns `needsApproval`, `sessionId`, `conversationId`, and a generated `plan`.
  - All messages, plans, and execution steps are persisted to PostgreSQL database automatically.
  - Reply with the same `sessionId` and `isApproval: true` (or user message like "approve") to execute the plan.
  - Authorization: forward `Authorization: Bearer <token>` header; falls back to `ELASTICDASH_TOKEN`.

### Chat Database Schema
The chat system uses PostgreSQL with the following tables:
- **Conversations** – Groups messages with user_id and optional customer_user_id
- **ChatMessages** – Individual messages (user/assistant) with full conversation history
- **ChatPlans** – Generated execution plans awaiting user approval
- **ChatPlanSteps** – Individual steps within a plan with execution results and timings
- **ChatFeedback** – User feedback (likes/dislikes) on messages
- **ChatFeedbackReasons** – Detailed reasons for negative feedback
- **ChatSessions** – Session management for approval workflow

See `database/chat.sql` for full schema and indexes.

### Chat-Specific Environment
Set these in `.env` for the chat flow:
- `OPENAI_API_KEY` – required for planner/executor/verifier prompts.
- `BACKEND_URL` – base URL for downstream ElasticDash Backend calls (primary default). Falls back to `ELASTICDASH_API_URL` if not set.
- `ELASTICDASH_TOKEN` – fallback token if client does not send Authorization.
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` – PostgreSQL connection details (required for chat persistence).

---

## Development

### Run in Development Mode
```bash
npm run dev
```

### Run Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

---

## Documentation

All project documentation is organized in the `docs/` directory:

### 📁 Documentation Structure

```
docs/
├── architecture/       # System architecture and design
│   ├── AWS_Recommended_Architecture.md
│   ├── ElasticDash通信流程图.md
│   ├── conversation_connection.md
│   └── 项目关系总结文档.md
├── deployment/         # Deployment guides and configuration
│   ├── DATABASE_CONFIG.md
│   ├── EBS_CSI_DRIVER_FIX.md
│   ├── K8S_CLOUD_NATIVE_DESIGN.md
│   ├── K8S_DEPLOY_ONLY.md
│   └── K8S_POSTGRESQL_GUIDE.md
├── k8s/               # Kubernetes documentation
│   ├── README.md
│   ├── BEST-PRACTICES.md
│   ├── EBS_CSI_DRIVER_FIX.md
│   ├── K8S_CLOUD_NATIVE_DESIGN.md
│   ├── K8S_DEPLOY_ONLY.md
│   ├── K8S_POSTGRESQL_GUIDE.md
│   ├── README-DEPLOYMENT.md
│   ├── README-IMAGE-TAG-SOLUTION.md
│   ├── README-ZH.md
│   └── TROUBLESHOOTING.md
└── troubleshooting/   # Troubleshooting guides
    ├── general-troubleshooting.md
    ├── CI-CD-EKS-Authentication-Fix.md
    └── ElasticDash-API登录问题修复文档.md
```

### 🔗 Quick Links

- **[Kubernetes Deployment Guide](./docs/k8s/README.md)** - Complete K8s deployment instructions
- **[Database Configuration](./docs/deployment/DATABASE_CONFIG.md)** - PostgreSQL setup and configuration
- **[Architecture Overview](./docs/architecture/AWS_Recommended_Architecture.md)** - AWS architecture design
- **[Troubleshooting Guide](./docs/troubleshooting/general-troubleshooting.md)** - Common issues and solutions

## Deployment

To deploy the ElasticDash Backend, ensure the environment variables are properly set up and use a process manager like **PM2** for production environments:
```bash
npm install -g pm2
pm2 start npm --name "elasticdash-api" -- start
```

For Kubernetes deployment, see [K8s Deployment Guide](./docs/k8s/README.md)

---

## Troubleshooting

### Local Database Access for Kubernetes Pods

To access the PostgreSQL database running in Kubernetes pods from your local machine, use port-forwarding:

```bash
kubectl port-forward svc/postgres-auto-mode-service 5432:5432 -n dev-elasticdash
```

This command forwards your local port 5432 to the PostgreSQL service in the `dev-elasticdash` namespace, allowing you to connect to the database using local database clients or development tools.

---

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature-name`.
3. Commit your changes: `git commit -m "Add feature"`.
4. Push to the branch: `git push origin feature-name`.
5. Open a pull request.

---

## License

This project is licensed under the MIT License. See the [LICENSE](./LICENSE) file for details.