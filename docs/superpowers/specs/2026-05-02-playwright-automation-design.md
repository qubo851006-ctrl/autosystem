# 网页自动化填写平台 — 设计文档

**日期**：2026-05-02  
**项目路径**：`D:/claude/autosystem`  
**状态**：设计确认，待实现

---

## 1. 项目概述

为公司内部非技术同事提供一套**网页表单自动化填写平台**。用户通过录制操作生成流程配置，后续无需写代码即可批量执行表单填写任务，并实时查看执行进度。

### 核心价值
- 非技术用户可自助创建、维护自动化流程
- 支持批量数据输入（Excel / 手动 / 外部系统）
- 登录一次保存 Session，后续自动复用
- 执行过程截图存档，结果可追溯

---

## 2. 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| 前端 + API | Next.js 14 (App Router) | 前后端一体，API Routes 处理后端逻辑 |
| 自动化引擎 | Playwright TypeScript | 浏览器操作，录制转配置，执行填表 |
| 数据库 ORM | Prisma + SQLite | 轻量持久化，无需独立数据库服务 |
| 任务队列 | BullMQ + Redis (或 in-memory) | 并发控制、重试、批量任务管理 |
| 实时推送 | Server-Sent Events (SSE) | 执行进度实时推送到前端 |
| Excel 解析 | xlsx (SheetJS) | 解析上传的 Excel 数据文件 |
| 样式 | Tailwind CSS | 与 reactV2 风格一致 |

---

## 3. 系统架构

```
┌─────────────────────────────────────────────┐
│                 前端 (Next.js)               │
│  流程库 │ 任务执行台 │ 流程编辑器 │ 历史记录  │
└─────────────────┬───────────────────────────┘
                  │ HTTP / SSE
┌─────────────────▼───────────────────────────┐
│              API Routes (Next.js)            │
│  /api/flows  /api/tasks  /api/sessions       │
│  /api/upload/excel  /api/codegen             │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│            Playwright 执行引擎               │
│  FlowRunner │ SessionManager │ DataMapper   │
│  CodegenCapture │ TaskQueue (BullMQ)        │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│              数据层 (Prisma + SQLite)        │
│  flows.db  (Flow / Task / Session / User)   │
└─────────────────────────────────────────────┘
```

---

## 4. 目录结构

```
autosystem/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # 全局布局
│   ├── page.tsx                  # 首页（流程库）
│   ├── flows/
│   │   ├── page.tsx              # 流程列表
│   │   ├── new/page.tsx          # 新建流程（录制入口）
│   │   └── [id]/
│   │       ├── page.tsx          # 流程详情 + 执行台
│   │       └── edit/page.tsx     # JSON 配置编辑器
│   ├── tasks/
│   │   └── [id]/page.tsx         # 任务执行进度页
│   ├── history/page.tsx          # 历史记录
│   └── api/
│       ├── flows/route.ts        # 流程 CRUD
│       ├── tasks/
│       │   ├── run/route.ts      # 启动任务
│       │   └── [id]/stream/route.ts  # SSE 进度流
│       ├── sessions/
│       │   ├── login/route.ts    # 触发登录
│       │   └── check/route.ts    # 检查 Session 有效性
│       ├── upload/excel/route.ts # Excel 上传解析
│       └── codegen/
│           ├── start/route.ts    # 启动录制
│           └── stop/route.ts     # 停止录制并返回 JSON
├── lib/
│   ├── playwright/
│   │   ├── runner.ts             # FlowRunner：执行 JSON 步骤
│   │   ├── session.ts            # SessionManager：Cookie 存储/恢复
│   │   ├── mapper.ts             # DataMapper：变量替换
│   │   └── codegen.ts            # CodegenCapture：录制 → JSON 转换
│   ├── queue/
│   │   └── taskQueue.ts          # BullMQ 任务队列
│   ├── excel/
│   │   └── parser.ts             # Excel → 数据行数组
│   └── prisma.ts                 # Prisma 客户端单例
├── prisma/
│   ├── schema.prisma             # 数据库模型
│   └── migrations/               # 迁移文件
├── components/
│   ├── FlowCard.tsx              # 流程卡片
│   ├── TaskProgress.tsx          # 实时进度组件（SSE 消费）
│   ├── JsonEditor.tsx            # JSON 配置编辑器
│   ├── ExcelUpload.tsx           # Excel 上传组件
│   ├── ManualForm.tsx            # 手动输入表单（根据 fields 动态生成）
│   └── SessionStatus.tsx         # 登录状态指示器
├── types/
│   └── flow.ts                   # Flow / Step / Field 类型定义
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── .env.local                    # 环境变量
```

---

## 5. 数据模型

```prisma
model Flow {
  id        String   @id @default(cuid())
  name      String
  url       String
  config    Json     // FlowConfig 结构（见第6节）
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tasks     Task[]
}

model Task {
  id             String   @id @default(cuid())
  flowId         String
  flow           Flow     @relation(fields: [flowId], references: [id])
  status         String   // pending | running | success | failed
  inputData      Json     // 本次执行的数据
  logs           Json     // 每步执行日志数组
  screenshotPath String?  // 完成截图路径
  errorMessage   String?
  createdAt      DateTime @default(now())
  completedAt    DateTime?
}

model Session {
  id        String   @id @default(cuid())
  siteUrl   String   // 目标网站的域名
  cookies   Json     // Playwright 序列化的 Cookie 数组
  expiresAt DateTime?
  createdAt DateTime @default(now())
}

model User {
  id        String   @id @default(cuid())
  name      String   @unique
  role      String   @default("user") // admin | user
  createdAt DateTime @default(now())
}
```

---

## 6. JSON 流程配置格式

```typescript
interface FlowConfig {
  name: string
  url: string
  fields: FieldDef[]    // 可变字段定义（用于生成输入表单）
  steps: Step[]         // 执行步骤列表
}

interface FieldDef {
  name: string          // 变量名，对应 steps 中的 {{name}}
  label: string         // 界面显示名称
  type: 'text' | 'number' | 'select' | 'date' | 'textarea'
  required?: boolean
  options?: string[]    // select 类型的选项
}

interface Step {
  action: 'fill' | 'click' | 'select' | 'waitFor' | 'screenshot' | 'check'
  selector: string      // CSS 选择器
  value?: string        // 支持 {{变量名}} 占位符
  timeout?: number      // 等待超时（ms），默认 5000
  description?: string  // 步骤描述（显示在进度日志中）
}
```

### 示例配置

```json
{
  "name": "OA报销申请",
  "url": "https://oa.company.com/reimbursement/new",
  "fields": [
    { "name": "amount",   "label": "报销金额", "type": "number",   "required": true },
    { "name": "category", "label": "费用类别", "type": "select",   "options": ["差旅", "办公", "餐饮"] },
    { "name": "remark",   "label": "备注说明", "type": "textarea", "required": false }
  ],
  "steps": [
    { "action": "fill",       "selector": "#amount",      "value": "{{amount}}",   "description": "填写报销金额" },
    { "action": "select",     "selector": "#category",    "value": "{{category}}", "description": "选择费用类别" },
    { "action": "fill",       "selector": "#remark",      "value": "{{remark}}",   "description": "填写备注" },
    { "action": "click",      "selector": "#submit-btn",                           "description": "点击提交" },
    { "action": "waitFor",    "selector": ".success-toast",                        "description": "等待成功提示" },
    { "action": "screenshot", "selector": "body",                                  "description": "截图存档" }
  ]
}
```

---

## 7. 关键模块设计

### 7.1 FlowRunner（执行引擎）

```typescript
// lib/playwright/runner.ts
async function runFlow(flow: FlowConfig, data: Record<string, string>, taskId: string) {
  const browser = await chromium.launch({ headless: false }) // 初始有头，方便调试
  const context = await loadSession(browser, flow.url)      // 恢复 Cookie
  const page = await context.newPage()

  await page.goto(flow.url)

  for (const step of flow.steps) {
    const value = step.value ? applyTemplate(step.value, data) : undefined
    await executeStep(page, step, value)
    await emitProgress(taskId, step.description, 'success')  // SSE 推送
  }

  await saveSession(context, flow.url)                        // 更新 Cookie
  await browser.close()
}
```

### 7.2 SessionManager（登录管理）

- 首次访问目标网站：开启有头浏览器，用户手动登录 + 输入短信验证码
- 登录完成后：`context.storageState()` 序列化 Cookie 存入数据库
- 后续执行：`browser.newContext({ storageState: cookies })` 恢复登录态
- Session 过期检测：执行前访问目标页，若跳转到登录页则触发重新登录弹窗

### 7.3 CodegenCapture（录制转配置）

1. 启动 Playwright `--codegen` 模式，打开目标网址
2. 用户操作表单（填写示例数据）
3. 捕获 Playwright 生成的操作序列
4. 解析操作序列：提取 `selector` 和 `value`
5. 将 `value` 中的示例值替换为 `{{字段名}}` 占位符
6. 返回结构化的 `FlowConfig` JSON

### 7.4 DataMapper（数据映射）

```typescript
// lib/playwright/mapper.ts
function applyTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '')
}
```

### 7.5 实时进度（SSE）

```typescript
// app/api/tasks/[id]/stream/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const stream = new ReadableStream({
    start(controller) {
      subscribeToTask(params.id, (event) => {
        controller.enqueue(`data: ${JSON.stringify(event)}\n\n`)
      })
    }
  })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
  })
}
```

---

## 8. 用户操作流程

### 8.1 新建自动化流程

1. 点击「新建流程」→ 输入流程名称和目标网址
2. 点击「开始录制」→ 系统打开有头浏览器并导航到目标网址
3. 用户在浏览器中操作表单（填写示例数据）
4. 点击「停止录制」→ 系统生成 JSON 配置草稿
5. 在编辑器中确认/修改字段名称和步骤描述
6. 保存 → 流程上线，出现在流程库中

### 8.2 执行一次任务

1. 从流程库选择流程 → 点击「执行」
2. 选择数据来源：上传 Excel / 手动填写 / 从上次导入
3. 系统检查登录 Session：有效则直接执行，失效则弹出登录引导
4. （如需）用户在弹出的浏览器窗口中登录并输入短信验证码
5. Playwright 自动执行所有步骤，前端实时显示每步状态
6. 执行完成 → 显示结果摘要 + 截图，写入历史记录

### 8.3 批量执行（Excel 导入）

1. 上传 Excel 文件（每行一条记录，列名对应 `fields[].name`）
2. 系统解析 → 生成 N 个任务加入队列
3. BullMQ 按并发限制（默认 1，可配置）逐个执行
4. 前端显示队列进度（已完成 X / 共 N 条）

---

## 9. 错误处理策略

| 场景 | 处理方式 |
|------|---------|
| 选择器找不到元素 | 超时后截图记录，任务标记为 failed，显示具体步骤 |
| Session 过期 | 暂停任务，推送登录引导通知，用户重新登录后恢复 |
| 短信验证码超时 | 等待用户操作，超过 5 分钟则任务失败并提示 |
| 批量任务中单条失败 | 跳过该条，继续执行，最终报告失败列表 |
| 页面加载超时 | 重试最多 2 次，仍失败则标记 failed |

---

## 10. 安全考虑

- Session Cookie 存储在本地 SQLite，不传出服务器
- 用户账号密码不存储，只存储登录后的 Cookie
- 文件上传限制：仅允许 `.xlsx` / `.csv`，最大 10MB
- API 路由添加简单的 Token 校验（本地部署，轻量即可）
- 截图文件存储在服务器本地 `data/screenshots/`

---

## 11. 开发阶段规划

| 阶段 | 内容 | 产出 |
|------|------|------|
| Phase 1 | 项目初始化 + 数据库 + 基础 UI | 可运行的空壳 + 流程库页面 |
| Phase 2 | FlowRunner + SessionManager + 手动数据执行 | 能跑通单条任务 |
| Phase 3 | CodegenCapture + 录制转 JSON 流程 | 用户可自助创建流程 |
| Phase 4 | Excel 批量导入 + BullMQ 队列 | 支持批量执行 |
| Phase 5 | 历史记录 + 截图存档 + SSE 进度推送 | 完整体验闭环 |

---

## 12. 待确认事项

- [ ] BullMQ 是否需要 Redis？若环境无 Redis 可改用 `p-queue` 内存队列（简化部署）
- [ ] 录制时的示例值如何自动识别为变量？（规则：长度 > 1 的纯文本 input 值均提示为可变字段）
- [ ] 是否需要用户登录系统本身？（初期可不做，本地局域网部署）
