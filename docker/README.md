# ElasticDash-API Docker Configuration

This directory contains Docker configuration files for AWS deployment of the ElasticDash-API service.

## Files

- `Dockerfile.amd64` - Optimized Dockerfile for AMD64 architecture (AWS ECS/EKS)
- `build-and-push.sh` - Complete build and push pipeline script
- `*.bak` - Backup files of old scripts

## Quick Start

### Build and Push Pipeline
The unified script handles both building and pushing in one command:

```bash
# Development environment
./build-and-push.sh dev-latest

# Production environment (with confirmation)
./build-and-push.sh latest

# Production environment (skip confirmation)
./build-and-push.sh latest --force
```

## Environment Detection

The script automatically detects the target environment based on the image tag:

- `latest` or tags containing `prod` → **Production**
- Tags containing `staging` → **Staging** 
- All other tags → **Development**

## Usage Examples

```bash
# Development workflow
./build-and-push.sh dev-latest
cd ../k8s && make deploy ENV=dev

# Production workflow  
./build-and-push.sh latest
cd ../k8s && make deploy ENV=prod

# Staging workflow
./build-and-push.sh staging-latest
cd ../k8s && make deploy ENV=staging
```