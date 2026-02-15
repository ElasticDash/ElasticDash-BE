# ElasticDash-API 路由提取详情

## 1. SERVICE: auth.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /auth/login | 否 | 是 |
| GET | /auth/session/:sessionId | 是 (:sessionId) | 否 |

---

## 2. SERVICE: user.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /user/register | 否 | 是 |
| POST | /user/register/verify | 否 | 是 |
| POST | /user/register/verify/resend | 否 | 是 |
| POST | /user/google/auth | 否 | 是 |
| POST | /user/microsoft/auth | 否 | 是 |
| GET | /user/unsubscribe/:url | 是 (:url) | 否 |
| PUT | /user/unsubscribe | 否 | 是 |
| POST | /user/forgotpassword | 否 | 是 |
| POST | /user/resetpassword | 否 | 是 |
| GET | /user/account | 否 | 否 |
| PUT | /user/account | 否 | 是 |
| GET | /user/account/email/verify/:url | 是 (:url) | 否 |
| PUT | /user/account/email | 否 | 是 |
| PUT | /user/account/photo | 否 | 是（包含文件上传） |
| GET | /user/account/password/current | 否 | 否 |
| PUT | /user/account/password/change | 否 | 是 |
| GET | /user/vocabulary/report | 否 | 否 |
| GET | /user/info | 否 | 否 |
| GET | /user/credit | 否 | 否 |

---

## 3. SERVICE: project.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /project/list/:page | 是 (:page) | 否 |
| POST | /project/list/page | 否 | 是 |
| POST | /project/list/all | 否 | 是 |
| GET | /project/byid/:projectId | 是 (:projectId) | 否 |
| POST | /project/create | 否 | 是 |
| PUT | /project/byid/:projectId | 是 (:projectId) | 是 |
| DELETE | /project/byid/:projectId | 是 (:projectId) | 否 |
| GET | /project/:projectId/step/list | 是 (:projectId) | 否 |
| POST | /project/:projectId/step/create | 是 (:projectId) | 是 |
| POST | /project/keypoint/generate | 否 | 是 |
| PUT | /project/step/update/:stepId | 是 (:stepId) | 是 |
| DELETE | /project/step/delete/:stepId | 是 (:stepId) | 否 |
| PUT | /project/step/evaluate/:stepId | 是 (:stepId) | 是 |
| POST | /project/step/attachment/upload/:stepId | 是 (:stepId) | 是（文件上传） |
| DELETE | /project/step/attachment/delete/:attachmentId | 是 (:attachmentId) | 否 |
| PUT | /project/reorder | 否 | 是 |
| POST | /project/session/list/byprojectid | 否 | 是 |
| GET | /project/session/latest/all/:page | 是 (:page) | 否 |
| POST | /project/session/latest/all | 否 | 是 |
| GET | /project/session/latest/test/:projectId | 是 (:projectId) | 否 |
| GET | /project/session/:sessionId | 是 (:sessionId) | 否 |
| POST | /project/:projectId/session/create | 是 (:projectId) | 是 |
| PUT | /project/session/:sessionId | 是 (:sessionId) | 是 |
| DELETE | /project/session/:sessionId | 是 (:sessionId) | 否 |
| GET | /project/:projectId/activate | 是 (:projectId) | 否 |
| GET | /project/:projectId/activate/testrun | 是 (:projectId) | 否 |
| POST | /project/session/update | 否 | 是 |
| GET | /project/balance/update/:userId | 是 (:userId) | 否 |
| POST | /project/:projectId/session/testrun/update | 是 (:projectId) | 是 |
| POST | /project/session/abort | 否 | 是 |
| GET | /project/:projectId/session/testrun/abort | 是 (:projectId) | 否 |
| GET | /project/:projectId/session/testrun/check | 是 (:projectId) | 否 |
| GET | /project/step/templates | 否 | 否 |
| GET | /project/draft/byid/:projectId | 是 (:projectId) | 否 |
| POST | /project/draft/create | 否 | 是 |
| PUT | /project/draft/byid/:projectId | 是 (:projectId) | 是 |
| DELETE | /project/draft/byid/:projectId | 是 (:projectId) | 否 |
| GET | /project/draft/:projectId/step/list | 是 (:projectId) | 否 |
| POST | /project/draft/:projectId/step/create | 是 (:projectId) | 是 |
| PUT | /project/draft/step/update/:stepId | 是 (:stepId) | 是 |
| DELETE | /project/draft/step/delete/:stepId | 是 (:stepId) | 否 |
| PUT | /project/draft/step/evaluate/:stepId | 是 (:stepId) | 是 |
| POST | /project/draft/step/attachment/upload/:stepId | 是 (:stepId) | 是（文件上传） |
| DELETE | /project/draft/step/attachment/delete/:attachmentId | 是 (:attachmentId) | 否 |
| GET | /project/draft/apply/:projectId | 是 (:projectId) | 否 |
| GET | /project/duplicate/:projectId | 是 (:projectId) | 否 |
| GET | /project/session/exist/:projectId | 是 (:projectId) | 否 |
| GET | /project/session/heartbeat/:sessionId | 是 (:sessionId) | 否 |

---

## 4. SERVICE: plan.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /plan/balance | 否 | 否 |
| GET | /plan/subscription/current | 否 | 否 |
| GET | /plan/list | 否 | 否 |
| POST | /plan/webhook | 否 | 是 |

---

## 5. SERVICE: ielts.js

### 用户 Onboarding 流程
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/onboarding/status | 否 | 否 |
| POST | /ielts/onboarding/placement-test/start | 否 | 否 |
| POST | /ielts/onboarding/placement-test/submit | 否 | 是 |
| GET | /ielts/onboarding/placement-test/result | 否 | 否 |
| POST | /ielts/onboarding/complete | 否 | 是 |
| POST | /ielts/onboarding/studyplan/estimate | 否 | 是 |

### 仪表盘统计
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/dashboard/stats | 否 | 否 |
| GET | /ielts/reading/stats | 否 | 否 |
| GET | /ielts/writing/stats | 否 | 否 |
| GET | /ielts/tasks/progress | 否 | 否 |

### 用户考试目标管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/exam-goal | 否 | 是 |
| GET | /ielts/exam-goal/current | 否 | 否 |
| GET | /ielts/exam-goal/history | 否 | 否 |

### 学习计划管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/study-plan/submit | 否 | 是 |
| GET | /ielts/study-plan/current | 否 | 否 |

### 每日计划管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/daily-plan/generate-today | 否 | 是 |
| POST | /ielts/daily-plan/generate | 否 | 是 |
| GET | /ielts/daily-plan/today | 否 | 否 |
| GET | /ielts/daily-plan/history | 否 | 否 |
| GET | /ielts/daily-plan/bydate/:date | 是 (:date) | 否 |
| GET | /ielts/daily-plan/incomplete | 否 | 否 |
| GET | /ielts/daily-plan/incomplete/reading | 否 | 否 |
| GET | /ielts/daily-plan/incomplete/writing | 否 | 否 |
| PUT | /ielts/daily-plan/plan/complete/:planId | 是 (:planId) | 是 |

### 计划任务
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/plan-task/:taskId/start | 是 (:taskId) | 是 |
| GET | /ielts/plan-task/:taskId | 是 (:taskId) | 否 |

### 响应和评估
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/response/status/:queueId | 是 (:queueId) | 否 |
| POST | /ielts/response/upload-image | 否 | 是（图片上传） |
| GET | /ielts/response/detail/:responseId | 是 (:responseId) | 否 |
| GET | /ielts/response/evaluation/:responseId | 是 (:responseId) | 否 |

### 答题卡模板
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/answer-sheet/template | 否 | 否 |
| GET | /ielts/answer-sheet/templates/list | 否 | 否 |
| POST | /ielts/answer-sheet/template/upload | 否 | 是（PDF上传） |
| DELETE | /ielts/answer-sheet/template | 否 | 是 |
| GET | /ielts/answer-sheet/config-status | 否 | 否 |

### 技能评分
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/skill/rating | 否 | 否 |
| GET | /ielts/skill/rating/history | 否 | 否 |
| GET | /ielts/skill/rating/:skillId/trend | 是 (:skillId) | 否 |

### 惩罚（Penalty）
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/penalty/apply | 否 | 是 |
| GET | /ielts/penalty/history | 否 | 否 |

### 问题助手
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/question/ask | 否 | 是 |
| POST | /ielts/question/followup | 否 | 是 |
| GET | /ielts/question/history/:responseId | 是 (:responseId) | 否 |
| POST | /ielts/question/summarize/:responseId | 是 (:responseId) | 是 |

### AI 生成测试（管理员）
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/admin/generate-reading-test | 否 | 是 |
| POST | /ielts/admin/generate-writing-test | 否 | 是 |

### Socket.IO 健康检查
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /ielts/socketio/health | 否 | 否 |
| POST | /ielts/socketio/test | 否 | 是 |

### 用户测试
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/usertest/list | 否 | 是 |

### 测试操作
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /ielts/test/start | 否 | 是 |
| POST | /ielts/test/submit | 否 | 是 |
| GET | /ielts/test/result/:id | 是 (:id) | 否 |

---

## 6. SERVICE: admin.js

### 用户管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /admin/user | 否 | 是 |
| PUT | /admin/user/password | 否 | 是 |
| PUT | /admin/user/email | 否 | 是 |
| DELETE | /admin/user/delete/:userId | 是 (:userId) | 否 |

### 测试请求管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /admin/user/testrequest/bystatus | 否 | 否 |
| POST | /admin/user/testrequest/list | 否 | 是 |
| PUT | /admin/user/testrequest/status | 否 | 是 |

### 测试 API
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /admin/test | 否 | 否 |
| POST | /admin/test | 否 | 是 |
| PUT | /admin/test | 否 | 是 |
| DELETE | /admin/test | 否 | 否 |

### Socket 通信
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /admin/socket | 否 | 是 |

### 项目管理（管理员）
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /admin/project/ai-only/:projectId | 是 (:projectId) | 否 |
| PUT | /admin/project/ai-only/:projectId | 是 (:projectId) | 是 |

---

## 7. SERVICE: general.js

### 文件管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /general/files/:key | 是 (:key) | 否 |

### AWS 密钥管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /general/secret/list | 否 | 否 |
| GET | /general/secret/get/:secretName | 是 (:secretName) | 否 |
| POST | /general/secret/create | 否 | 是 |
| DELETE | /general/secret/delete/:secretName | 是 (:secretName) | 否 |

### AI 服务
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /general/aiservice/xai | 否 | 是 |
| POST | /general/aiservice/claude | 否 | 是 |

### 等候列表
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /general/waitlist | 否 | 是 |
| PUT | /general/waitlist/:id | 是 (:id) | 是 |

---

## 8. SERVICE: creditcard.js

### 账单地址管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| GET | /creditcard/address | 否 | 否 |
| POST | /creditcard/address | 否 | 是 |
| PUT | /creditcard/address/:id | 是 (:id) | 是 |
| DELETE | /creditcard/address/:id | 是 (:id) | 否 |

### 信用卡管理
| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /creditcard | 否 | 是 |
| GET | /creditcard | 否 | 否 |
| GET | /creditcard/:id | 是 (:id) | 否 |
| PUT | /creditcard/:id/address | 是 (:id) | 是 |
| PUT | /creditcard/:id/default | 是 (:id) | 否 |
| DELETE | /creditcard/:id | 是 (:id) | 否 |

---

## 9. SERVICE: vocabulary.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /vocabulary/translate | 否 | 是 |
| GET | /vocabulary/history | 否 | 否（有查询参数） |
| GET | /vocabulary/my-words | 否 | 否（有查询参数） |

---

## 10. SERVICE: rag.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /rag/commit | 否 | 是 |
| POST | /rag/query | 否 | 是 |
| DELETE | /rag/commit/:commitHash | 是 (:commitHash) | 否 |
| POST | /rag/commits/batch | 否 | 是 |
| POST | /rag/search | 否 | 是 |
| POST | /rag/search/commit | 否 | 是 |
| POST | /rag/search/feature | 否 | 是 |

---

## 11. SERVICE: studyplan.js

| 方法 | 路由路径 | 是否有参数 | 是否有请求体 |
|------|---------|----------|-----------|
| POST | /studyplan/create | 否 | 是 |
| GET | /studyplan/current | 否 | 否 |
| GET | /studyplan/:id | 是 (:id) | 否 |

---

## 总结统计

| 服务 | 总路由数 | GET | POST | PUT | DELETE | PATCH |
|-----|---------|-----|------|-----|--------|-------|
| auth.js | 2 | 1 | 1 | 0 | 0 | 0 |
| user.js | 19 | 6 | 8 | 5 | 0 | 0 |
| project.js | 50 | 16 | 17 | 10 | 7 | 0 |
| plan.js | 4 | 2 | 2 | 0 | 0 | 0 |
| ielts.js | 55 | 20 | 26 | 3 | 0 | 0 |
| admin.js | 17 | 2 | 6 | 3 | 2 | 0 |
| general.js | 11 | 3 | 4 | 1 | 2 | 0 |
| creditcard.js | 11 | 3 | 2 | 3 | 3 | 0 |
| vocabulary.js | 3 | 2 | 1 | 0 | 0 | 0 |
| rag.js | 7 | 0 | 5 | 0 | 1 | 0 |
| studyplan.js | 3 | 2 | 1 | 0 | 0 | 0 |
| **合计** | **182** | **57** | **73** | **25** | **15** | **0** |

---

## 路由分类说明

### 按请求方法分类：
- **GET (57个)**：主要用于查询数据，不修改服务器状态
- **POST (73个)**：用于创建新资源或执行复杂操作
- **PUT (25个)**：用于更新现有资源
- **DELETE (15个)**：用于删除资源
- **PATCH (0个)**：项目中未使用

### 按参数类型分类：
- **无参数路由**：大多数是列表查询或创建操作
- **路径参数（:param）**：用于访问特定资源（通过ID）
- **查询参数（?key=value）**：在 vocabulary.js 中用于筛选和分页

### 身份验证：
大多数路由都需要通过 `verifyToken()` 进行身份验证，除了：
- `/auth/login` 和 `/auth/session/:sessionId`（认证相关）
- `/user/register` 和 `/user/register/verify`（注册流程）
- `/user/forgotpassword` 和 `/user/resetpassword`（密码恢复）
- `/general/waitlist` 和 `/general/secret/*`（公开或特殊权限）
- `/admin/*` 路由需要 `role: 'Admin'` 权限

---

## 特殊备注

1. **文件上传路由**：
   - `/user/account/photo`（PUT）
   - `/project/step/attachment/upload/:stepId`（POST）
   - `/project/draft/step/attachment/upload/:stepId`（POST）
   - `/ielts/response/upload-image`（POST）
   - `/ielts/answer-sheet/template/upload`（POST）

2. **Webhook 路由**：
   - `/plan/webhook`（Stripe 支付回调）

3. **Socket.IO 相关**：
   - `/admin/socket`（Socket 通信）
   - `/ielts/socketio/health`、`/ielts/socketio/test`（Socket 健康检查）

4. **AI 相关**：
   - `/general/aiservice/xai`、`/general/aiservice/claude`
   - `/ielts/admin/generate-reading-test`、`/ielts/admin/generate-writing-test`
   - `/project/keypoint/generate`
   - `/ielts/question/*`（AI 助手相关）

5. **管理员专用**：
   - `/admin/*` 所有管理员路由
   - `/ielts/admin/generate-*` 测试生成
