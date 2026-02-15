#!/bin/bash

# ElasticDash-API Build and Push Script
# Builds and pushes Docker image to AWS ECR
# Usage: ./build-and-push.sh [IMAGE_TAG] [--force]
# Examples:
#   ./build-and-push.sh latest        # build and push latest (with prod confirmation)
#   ./build-and-push.sh dev-latest    # build and push dev image
#   ./build-and-push.sh latest --force # build and push to prod without confirmation

set -e

# Parse arguments
IMAGE_TAG="${1:-dev-latest}"
FORCE_PUSH=false

for arg in "$@"; do
    case $arg in
        --force)
            FORCE_PUSH=true
            shift
            ;;
    esac
done

# Configuration
ECR_REPOSITORY="elasticdash-api"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"

# Set AWS profile if not already set
if [ -z "$AWS_PROFILE" ] && [ -f ~/.aws/credentials ]; then
    export AWS_PROFILE=default
    echo "🔧 Setting AWS_PROFILE to default"
fi

ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo 'unknown')}"
ECR_URI="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPOSITORY"
DOCKERFILE="Dockerfile.amd64"

# Determine environment from tag
if [[ "$IMAGE_TAG" == *"prod"* ]] || [[ "$IMAGE_TAG" == "latest" ]]; then
    ENVIRONMENT="production"
    BUILD_ENV="prod"
elif [[ "$IMAGE_TAG" == *"staging"* ]]; then
    ENVIRONMENT="staging"
    BUILD_ENV="staging"
else
    ENVIRONMENT="development" 
    BUILD_ENV="dev"
fi

echo "🚀 ElasticDash-API Build & Push Pipeline"
echo "🏷️  Environment: $ENVIRONMENT"
echo "📦 Target image: $ECR_URI:$IMAGE_TAG"

# Production safety check
if [[ "$BUILD_ENV" == "prod" ]] && [[ "$FORCE_PUSH" != true ]]; then
    echo ""
    echo "⚠️  WARNING: Building and pushing to PRODUCTION!"
    echo "   This will affect the production environment."
    read -p "   Continue? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Operation cancelled"
        exit 1
    fi
fi

# Check dependencies
echo ""
echo "🔍 Checking dependencies..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed"
    exit 1
fi

# Check AWS credentials
if ! aws sts get-caller-identity --query Account --output text &> /dev/null; then
    echo "❌ AWS credentials not configured"
    echo "💡 Run: aws configure"
    exit 1
fi
echo "✅ Dependencies verified"

# Build Docker image
echo ""
echo "🐳 Building Docker image..."
docker build \
    --platform linux/amd64 \
    -f "${DOCKERFILE}" \
    --build-arg NODE_ENV=$BUILD_ENV \
    --build-arg BUILD_ENV=$BUILD_ENV \
    -t "$ECR_URI:$IMAGE_TAG" \
    ..

echo "✅ Build completed"

# Push to ECR
echo ""
echo "📤 Pushing to AWS ECR..."

# Login to ECR
echo "🔐 Logging in to ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URI

# Ensure repository exists
echo "📦 Ensuring ECR repository exists..."
aws ecr describe-repositories --repository-names $ECR_REPOSITORY --region $AWS_REGION >/dev/null 2>&1 || \
    aws ecr create-repository --repository-name $ECR_REPOSITORY --region $AWS_REGION >/dev/null 2>&1

# Push images
echo "📤 Pushing $IMAGE_TAG..."
docker push $ECR_URI:$IMAGE_TAG

# Verify push
echo ""
echo "🔍 Verifying push..."
aws ecr describe-images --repository-name $ECR_REPOSITORY --region $AWS_REGION \
    --query "imageDetails[?imageTags[?contains(@, '$IMAGE_TAG')]][0].{ImageTags:imageTags,Size:imageSizeInBytes,Pushed:imagePushedAt}" \
    --output table

echo ""
echo "🎉 Build and push completed successfully!"
echo "📦 Image: $ECR_URI:$IMAGE_TAG"
echo "🏷️  Environment: $ENVIRONMENT"
echo ""
echo "🚀 Next step:"
if [[ "$BUILD_ENV" == "prod" ]]; then
    echo "   cd ../k8s && make deploy ENV=prod"
else
    echo "   cd ../k8s && make deploy ENV=dev"  
fi