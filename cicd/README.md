# ElasticDash Backend CI/CD Pipeline

This directory contains the CI/CD pipeline configuration for automatically building and deploying the ElasticDash Backend when the `development_EKS` branch is updated.

## 📁 Directory Structure

```
cicd/
├── cloudformation/       # CloudFormation templates
│   └── pipeline.yaml    # Complete CI/CD pipeline stack
├── scripts/             # Deployment and setup scripts
│   ├── deploy-pipeline.sh         # Deploy via CloudFormation
│   └── setup-codebuild-locally.sh # Direct AWS CLI setup
└── configs/             # Additional configuration files
```

## 🚀 Quick Start

### Option 1: Deploy with CloudFormation (Recommended)

1. **Prerequisites**
   - AWS CLI configured with appropriate credentials
   - GitHub Personal Access Token with `repo` and `admin:repo_hook` permissions
   - Existing EKS cluster named `beautiful-indie-ant`

2. **Deploy the pipeline**
   ```bash
   cd cicd/scripts
   ./deploy-pipeline.sh
   ```

3. **Follow the prompts**
   - Enter your GitHub username/organization
   - Enter your GitHub Personal Access Token
   - Confirm other settings

### Option 2: Manual Setup with AWS CLI

```bash
cd cicd/scripts
./setup-codebuild-locally.sh
```

## 🔧 Pipeline Architecture

### Components

1. **AWS CodeBuild**
   - Builds Docker image from source code
   - Pushes image to ECR with tag `dev-latest`
   - Deploys to EKS cluster using kubectl

2. **AWS CodePipeline** (CloudFormation only)
   - Monitors `development_EKS` branch
   - Triggers build on code changes
   - Manages the complete CI/CD workflow

3. **Amazon ECR**
   - Stores Docker images
   - Repository: `elasticdash-api`

4. **Amazon EKS**
   - Target deployment cluster
   - Namespace: `dev-elasticdash`

### Build Process

1. **Source Stage**: Pull code from GitHub `development_EKS` branch
2. **Build Stage**: 
   - Install dependencies (kubectl, kustomize)
   - Build Docker image
   - Tag with: `dev-latest`, `build-{number}`, `commit-{hash}`
   - Push to ECR
3. **Deploy Stage**: 
   - Update kubeconfig
   - Deploy using `kubectl apply -k`

## 📝 Configuration

### buildspec.yml

Located in the project root, this file defines the build steps:

```yaml
version: 0.2
env:
  variables:
    AWS_DEFAULT_REGION: ap-southeast-2
    AWS_ACCOUNT_ID: 281584859358
    ECR_REPOSITORY: elasticdash-api
    IMAGE_TAG: dev-latest
    ENVIRONMENT: dev
    EKS_CLUSTER_NAME: beautiful-indie-ant
```

### Environment Variables

The pipeline uses these environment variables:
- `AWS_DEFAULT_REGION`: AWS region (ap-southeast-2)
- `AWS_ACCOUNT_ID`: Your AWS account ID
- `ECR_REPOSITORY`: ECR repository name
- `IMAGE_TAG`: Docker image tag (dev-latest)
- `ENVIRONMENT`: Deployment environment (dev)
- `EKS_CLUSTER_NAME`: EKS cluster name

## 🔑 Required AWS Permissions

The CI/CD pipeline requires the following IAM permissions:

### CodeBuild Role
- ECR: Full access for pushing images
- EKS: Describe cluster and access Kubernetes API
- CloudWatch Logs: Create and write logs
- S3: Read/write artifacts

### CodePipeline Role (if using CloudFormation)
- S3: Access to artifact bucket
- CodeBuild: Start builds and get status

## 🛠️ EKS RBAC Setup

**IMPORTANT**: After setting up the pipeline, you must map the CodeBuild IAM role to EKS RBAC:

1. **Get your CodeBuild role ARN**:
   ```bash
   # For CloudFormation deployment:
   aws cloudformation describe-stacks --stack-name elasticdash-cicd-pipeline \
     --query 'Stacks[0].Outputs[?OutputKey==`CodeBuildRole`].OutputValue' --output text
   
   # For manual setup:
   echo "arn:aws:iam::281584859358:role/elasticdash-codebuild-role-dev"
   ```

2. **Map the role to EKS**:
   ```bash
   # Option A: Using eksctl (recommended)
   eksctl create iamidentitymapping \
     --cluster beautiful-indie-ant \
     --arn arn:aws:iam::281584859358:role/elasticdash-codebuild-role \
     --group system:masters \
     --username codebuild

   # Option B: Manual edit
   kubectl edit configmap aws-auth -n kube-system
   ```

3. **If editing manually, add this to mapRoles**:
   ```yaml
   - rolearn: arn:aws:iam::281584859358:role/elasticdash-codebuild-role
     username: codebuild
     groups:
       - system:masters
   ```

## 🛠️ Troubleshooting

### Common Issues and Solutions

#### 1. Docker Build Issues

**Problem**: `unknown instruction: TABLE_NAME=test_table`
- **Cause**: Using `cat > .env << EOF` syntax in Dockerfile - Docker parser treats content as instructions
- **Solution**: Create .env file in buildspec.yml pre_build phase, then COPY it in Dockerfile

**Problem**: `.env file not found` during Docker build
- **Cause**: .env file not in build context for CI/CD environment
- **Solution**: Create .env file programmatically in buildspec.yml before Docker build

#### 2. EKS Authentication Issues

**Problem**: `server has asked for the client to provide credentials`
- **Cause**: EKS cluster using API authentication mode, not traditional aws-auth ConfigMap
- **Solution**: Create EKS access entries instead:
  ```bash
  aws eks create-access-entry --cluster-name beautiful-indie-ant \
    --principal-arn arn:aws:iam::281584859358:role/elasticdash-codebuild-role

  aws eks associate-access-policy --cluster-name beautiful-indie-ant \
    --principal-arn arn:aws:iam::281584859358:role/elasticdash-codebuild-role \
    --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
    --access-scope type=cluster
  ```

**Problem**: kubectl commands fail silently
- **Cause**: `|| true` hiding real errors
- **Solution**: Remove error suppression and add proper error handling

#### 3. Build Configuration Issues

**Problem**: `docker: 24` runtime version error
- **Cause**: Unsupported runtime version in buildspec.yml
- **Solution**: Remove `runtime-versions: docker: 24` from buildspec.yml

**Problem**: `kubectl version --short` flag error
- **Cause**: Flag deprecated in newer kubectl versions
- **Solution**: Use `kubectl version --client --output=yaml`

#### 4. Environment Variable Issues

**Problem**: Application can't read environment variables in Kubernetes
- **Cause**: Deployment configured to use ConfigMap instead of .env file
- **Solution**: Remove env configuration from deployment.yaml and use .env file directly

**Problem**: babel-node missing dependency error
- **Cause**: `npm install --only=production` excludes devDependencies needed for babel-node
- **Solution**: Remove `--only=production` flag to include all dependencies

#### 5. Deployment Restart Issues

**Problem**: Pods not restarting with new images using same tag (`dev-latest`)
- **Cause**: Kubernetes caches images with same tag
- **Solution**: Add `kubectl rollout restart deployment` command after applying manifests

### Build Failures

1. **Check CodeBuild logs**
   ```bash
   aws codebuild batch-get-builds --ids <build-id> --region ap-southeast-2
   aws logs get-log-events --log-group-name /aws/codebuild/elasticdash-api-build \
     --log-stream-name <build-id> --query 'events[*].message' --output text
   ```

2. **Common issues**
   - ECR login failed: Check IAM permissions
   - EKS deployment failed: Verify cluster name and access entries
   - Docker build failed: Check Dockerfile syntax and build context

### Authentication Errors

1. **"server has asked for the client to provide credentials"**
   - Usually means missing EKS access entries (not aws-auth ConfigMap)
   - Check that CodeBuild role has EKS access entries configured

2. **"Forbidden" (403) errors**
   - CodeBuild role needs proper EKS access policies associated

### Pipeline Not Triggering

1. **Verify webhook configuration**
   ```bash
   aws codebuild batch-get-projects --names elasticdash-api-build-dev
   ```

2. **Check GitHub token permissions**
   - Must have `repo` and `admin:repo_hook` scopes

### Deployment Issues

1. **Verify EKS cluster access**
   ```bash
   aws eks update-kubeconfig --name beautiful-indie-ant --region ap-southeast-2
   kubectl get nodes
   ```

2. **Check namespace exists**
   ```bash
   kubectl get namespace dev-elasticdash
   ```

## 🎯 Lessons Learned & Best Practices

### Security Best Practices

1. **Never hardcode credentials in Dockerfiles**
   - ❌ BAD: Embedding API keys directly in Dockerfile with `RUN echo "API_KEY=secret" > .env`
   - ✅ GOOD: Create .env file in buildspec.yml pre_build phase from secure sources (AWS Secrets Manager)

2. **Use proper secret management**
   - For production: Use AWS Secrets Manager or Parameter Store
   - For development: Create minimal .env in CI/CD process with non-sensitive defaults

### CI/CD Architecture Decisions

1. **Environment Variable Management**
   - **Issue**: Application reading from both ConfigMap and .env file caused conflicts
   - **Solution**: Standardized on .env file approach for consistency between local and K8s environments

2. **Docker Build Context**
   - **Issue**: .env file not available in Docker build context during CI/CD
   - **Solution**: Create .env file in buildspec.yml before docker build, ensuring it's in the build context

3. **EKS Authentication**
   - **Issue**: Modern EKS clusters use API authentication mode, not aws-auth ConfigMap
   - **Solution**: Use EKS access entries for CodeBuild role authentication

### Error Handling Improvements

1. **Don't suppress errors in CI/CD**
   - **Issue**: `|| true` was hiding real kubectl authentication failures
   - **Solution**: Remove error suppression and implement proper error handling with timeouts

2. **Add debug logging**
   - Include debug steps to verify file existence, permissions, and configurations
   - Print relevant information before critical operations

### Performance Optimizations

1. **Pin tool versions in buildspec.yml**
   - Ensures consistent build environment
   - Prevents unexpected failures from tool updates

2. **Optimize Docker builds**
   - Use multi-stage builds for smaller production images
   - Proper layer caching with package.json copying

3. **Handle same-tag deployments**
   - Use `kubectl rollout restart` to ensure pods restart with new images using same tag
   - Add rollout status checking with timeouts

### Monitoring & Troubleshooting

1. **Comprehensive logging**
   - Log all critical steps and their results
   - Include AWS identity information for authentication debugging

2. **Build status tracking**
   - Use build numbers and commit hashes for image tagging
   - Enable proper build history and rollback capabilities

## 📊 Monitoring

### View Pipeline Status

**CloudFormation deployment:**
```bash
https://console.aws.amazon.com/codesuite/codepipeline/pipelines/elasticdash-api-pipeline/view
```

**Direct CodeBuild:**
```bash
aws codebuild list-builds-for-project --project-name elasticdash-api-build-dev
```

### View Build Logs

```bash
aws logs tail /aws/codebuild/elasticdash-api-build --follow
```

## 🔄 Manual Trigger

To manually trigger a build:

```bash
aws codebuild start-build \
  --project-name elasticdash-api-build-dev \
  --source-version development_EKS
```

## 🧹 Cleanup

To remove all CI/CD resources:

### CloudFormation Stack
```bash
aws cloudformation delete-stack --stack-name elasticdash-cicd-pipeline
```

### Manual Resources
```bash
# Delete CodeBuild project
aws codebuild delete-project --name elasticdash-api-build-dev

# Delete IAM role
aws iam delete-role --role-name elasticdash-codebuild-role-dev
```

## 📚 Additional Resources

- [AWS CodeBuild Documentation](https://docs.aws.amazon.com/codebuild/)
- [AWS CodePipeline Documentation](https://docs.aws.amazon.com/codepipeline/)
- [Amazon EKS Documentation](https://docs.aws.amazon.com/eks/)
- [EKS RBAC Documentation](https://docs.aws.amazon.com/eks/latest/userguide/add-user-role.html)

## 🤝 Support

For issues or questions:
1. Check the troubleshooting section above
2. Review CloudWatch logs for detailed error messages
3. Verify EKS RBAC mapping is correct
4. Contact the DevOps team