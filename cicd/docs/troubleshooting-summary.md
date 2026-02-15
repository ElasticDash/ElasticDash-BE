# CI/CD Pipeline Troubleshooting Summary

## 概述
本文档总结了ElasticDash API CI/CD管道实施过程中遇到的所有问题及解决方案。

## 问题1: EventBridge权限错误
**错误**: CloudFormation部署失败，EventBridge相关权限问题
**原因**: 初始模板包含不必要的EventBridge规则
**解决方案**: 移除EventBridge组件，使用GitHub webhooks触发管道
**文件**: `cicd/cloudformation/pipeline.yaml`

## 问题2: S3存储桶删除失败
**错误**: CloudFormation栈删除时S3存储桶无法删除
**原因**: 存储桶包含版本化对象
**解决方案**: 手动清空存储桶内容后删除栈
**命令**: `aws s3 rb s3://bucket-name --force`

## 问题3: buildspec.yml文件缺失
**错误**: `buildspec.yml could not be found`
**原因**: buildspec.yml文件未推送到代码库
**解决方案**: 推送buildspec.yml到代码库

## 问题4: Docker运行时版本不支持
**错误**: `Unsupported runtime version 'docker: 24'`
**原因**: CodeBuild标准镜像不支持指定docker版本
**解决方案**: 从buildspec.yml中移除`runtime-versions`部分
**修改**: 删除`docker: 24`配置

## 问题5: kubectl版本命令标志错误
**错误**: `unknown flag: --short`
**原因**: 新版kubectl不支持`--short`标志
**解决方案**: 替换为`kubectl version --client --output=yaml`
**文件**: `buildspec.yml:58`

## 问题6: EKS认证失败 (关键问题)
**错误**: `the server has asked for the client to provide credentials`
**根因**: EKS集群使用API认证模式，需要访问条目而不是传统的aws-auth ConfigMap
**解决方案**: 
1. 创建EKS访问条目:
   ```bash
   aws eks create-access-entry --cluster-name beautiful-indie-ant \
     --principal-arn arn:aws:iam::281584859358:role/elasticdash-codebuild-role \
     --region ap-southeast-2 --type STANDARD
   ```

2. 关联管理员策略:
   ```bash
   aws eks associate-access-policy --cluster-name beautiful-indie-ant \
     --principal-arn arn:aws:iam::281584859358:role/elasticdash-codebuild-role \
     --policy-arn arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy \
     --access-scope type=cluster --region ap-southeast-2
   ```

3. 添加增强的STS令牌权限:
   ```json
   {
     "Version": "2012-10-17", 
     "Statement": [
       {
         "Effect": "Allow",
         "Action": [
           "sts:GetServiceBearerToken",
           "sts:AssumeRole", 
           "sts:TagSession"
         ],
         "Resource": "*"
       }
     ]
   }
   ```

## 问题7: Pod不重启问题
**错误**: 构建成功但Pod没有重启使用新镜像
**原因**: 使用固定的`dev-latest`标签，Kubernetes认为镜像没有变化
**解决方案**: 在部署后强制重启deployment
**修改**: buildspec.yml中添加:
```yaml
kubectl rollout restart deployment/elasticdash-api -n dev-elasticdash
kubectl rollout status deployment/elasticdash-api -n dev-elasticdash --timeout=300s
```

## 最终工作流程
1. **源码更新** → GitHub webhooks触发CodePipeline
2. **构建阶段** → CodeBuild执行buildspec.yml
3. **Docker构建** → 构建并推送到ECR (dev-latest标签)
4. **EKS部署** → 通过访问条目认证，应用manifests
5. **强制重启** → 重启deployment确保使用新镜像

## 关键配置文件
- `buildspec.yml` - CodeBuild构建规范
- `cicd/cloudformation/pipeline.yaml` - 基础设施即代码
- `cicd/scripts/deploy-pipeline.sh` - 部署脚本
- `k8s/environments/dev/` - Kubernetes manifests

## 经验教训
1. **EKS API认证模式**需要访问条目，不能依赖传统aws-auth
2. **固定镜像标签**需要强制重启deployment
3. **错误抑制**(`|| true`)会隐藏真实问题
4. **权限问题**需要精确的STS令牌交换权限
5. **调试日志**对定位问题至关重要

## 最终状态
✅ CI/CD管道完全正常工作
✅ 自动构建和部署到EKS
✅ Pod正确重启使用新镜像
✅ 完整的错误处理和日志记录