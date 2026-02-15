#!/bin/bash

# ElasticDash CI/CD Pipeline Deployment Script
# This script deploys the AWS CodePipeline using CloudFormation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
STACK_NAME="elasticdash-cicd-pipeline"
TEMPLATE_FILE="../cloudformation/pipeline.yaml"
REGION="${AWS_REGION:-ap-southeast-2}"
GITHUB_OWNER="ElasticDash"
GITHUB_REPO="ElasticDash-API"
GITHUB_BRANCH="development_EKS"
GITHUB_TOKEN=""
EKS_CLUSTER_NAME="beautiful-indie-ant"

echo -e "${BLUE}ElasticDash CI/CD Pipeline Deployment${NC}"
echo "======================================"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}Error: AWS CLI is not installed${NC}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Prerequisites check passed${NC}"
}

# Function to get parameters
get_parameters() {
    echo -e "${YELLOW}Using default deployment parameters:${NC}"
    echo "GitHub Owner/Organization: $GITHUB_OWNER"
    echo "GitHub Repository: $GITHUB_REPO"
    echo "GitHub Branch: $GITHUB_BRANCH" 
    echo "EKS Cluster Name: $EKS_CLUSTER_NAME"
    echo
    
    read -s -p "GitHub Personal Access Token: " GITHUB_TOKEN
    echo
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${RED}Error: GitHub token is required${NC}"
        echo -e "${YELLOW}Create a token at: https://github.com/settings/tokens${NC}"
        echo -e "${YELLOW}Required scopes: repo, admin:repo_hook${NC}"
        exit 1
    fi
}

# Function to validate stack
validate_stack() {
    echo -e "${YELLOW}Validating CloudFormation template...${NC}"
    
    aws cloudformation validate-template \
        --template-body file://$TEMPLATE_FILE \
        --region $REGION > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Template validation successful${NC}"
    else
        echo -e "${RED}Template validation failed${NC}"
        exit 1
    fi
}

# Function to deploy stack
deploy_stack() {
    echo -e "${YELLOW}Deploying CloudFormation stack...${NC}"
    
    aws cloudformation deploy \
        --template-file $TEMPLATE_FILE \
        --stack-name $STACK_NAME \
        --parameter-overrides \
            GitHubOwner=$GITHUB_OWNER \
            GitHubRepo=$GITHUB_REPO \
            GitHubBranch=$GITHUB_BRANCH \
            GitHubToken=$GITHUB_TOKEN \
            EKSClusterName=$EKS_CLUSTER_NAME \
        --capabilities CAPABILITY_NAMED_IAM \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Stack deployment successful${NC}"
    else
        echo -e "${RED}Stack deployment failed${NC}"
        exit 1
    fi
}

# Function to get stack outputs
get_outputs() {
    echo -e "${YELLOW}Getting stack outputs...${NC}"
    
    PIPELINE_URL=$(aws cloudformation describe-stacks \
        --stack-name $STACK_NAME \
        --query "Stacks[0].Outputs[?OutputKey=='PipelineURL'].OutputValue" \
        --output text \
        --region $REGION)
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
    echo "======================================"
    echo -e "Pipeline URL: ${BLUE}$PIPELINE_URL${NC}"
    echo -e "${YELLOW}The pipeline will automatically trigger when code is pushed to $GITHUB_BRANCH${NC}"
}

# Main execution
main() {
    check_prerequisites
    get_parameters
    validate_stack
    deploy_stack
    get_outputs
}

# Run main function
main