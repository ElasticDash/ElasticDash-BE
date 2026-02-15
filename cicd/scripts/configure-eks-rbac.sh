#!/bin/bash

# Configure EKS RBAC for CodeBuild
# This script grants CodeBuild service role access to EKS cluster

set -e

# Configuration
EKS_CLUSTER_NAME="beautiful-indie-ant"
CODEBUILD_ROLE_ARN="arn:aws:iam::281584859358:role/elasticdash-codebuild-role"
NAMESPACE="dev-elasticdash"
REGION="ap-southeast-2"

echo "Configuring EKS RBAC for CodeBuild..."

# Update kubeconfig
aws eks update-kubeconfig --name $EKS_CLUSTER_NAME --region $REGION

# Create ConfigMap for aws-auth if it doesn't exist
kubectl get configmap aws-auth -n kube-system || \
kubectl create configmap aws-auth -n kube-system

# Add CodeBuild role to aws-auth ConfigMap
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: $CODEBUILD_ROLE_ARN
      username: codebuild
      groups:
        - system:masters
EOF

# Create namespace if it doesn't exist
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

# Create service account for CodeBuild
cat <<EOF | kubectl apply -f -
apiVersion: v1
kind: ServiceAccount
metadata:
  name: codebuild-sa
  namespace: $NAMESPACE
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: codebuild-admin
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: cluster-admin
subjects:
- kind: ServiceAccount
  name: codebuild-sa
  namespace: $NAMESPACE
EOF

echo "✅ EKS RBAC configuration completed!"
echo ""
echo "Next steps:"
echo "1. Push the updated buildspec.yml to trigger a new build"
echo "2. CodeBuild should now have access to deploy to EKS"