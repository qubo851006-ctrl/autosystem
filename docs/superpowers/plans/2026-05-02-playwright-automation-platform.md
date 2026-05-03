# 网页自动化填写平台 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个基于 Next.js + Playwright 的网页表单自动化填写平台，非技术用户可录制流程、上传数据、批量执行，实时查看进度。

**Architecture:** 纯 Next.js App Router（前后端一体），Playwright 在 API Route 中调用执行浏览器操作，Prisma + SQLite 持久化数据，p-queue 管理任务并发，SSE 推送执行进度到前端。

**Tech Stack:** Next.js 14, TypeScript, Playwright, Prisma + SQLite, p-queue, xlsx (SheetJS), Tailwind CSS, Vitest

---

## 文件结构总览

```
autosystem/
├── app/
│   ├── layout.tsx                    # 全局布局（导航栏）
│   ├── page.tsx                      # 首页（重定向到 /flows）
│   ├── flows/
│   │   ├── page.tsx                  # 流程库列表
│   │   ├── new/page.tsx              # 新建流程（录制入口）
│   │   └── [id]/
│   │       ├── page.tsx              # 流程详情 + 执行台
│   │       └── edit/page.tsx         # JSON 配置编辑器
│   ├── tasks/[id]/page.tsx           # 任务执行进度页
│   ├── history/page.tsx              # 历史记录
│   └── api/
│       ├── flows/
│       │   ├── route.ts              # GET 列表, POST 创建
│       │   └── [id]/route.ts         # GET 单个, PUT 更新, DELETE
│       ├── tasks/
│       │   ├── run/route.ts          # POST 启动任务
│       │   └── [id]/
│       │       ├── route.ts          # GET 任务状态
│       │       └── stream/route.ts   # GET SSE 进度流
│       ├── sessions/
│       │   ├── login/route.ts        # POST 打开浏览器登录
│       │   └── check/route.ts        # GET 检查 Session 有效性
│       ├── upload/excel/route.ts     # POST 上传并解析 Excel
│       └── codegen/
│           ├── start/route.ts        # POST 启动录制
│           └── stop/route.ts         # POST 停止录制，返回 JSON
├── lib/
│   ├── playwright/
│   │   ├── runner.ts                 # FlowRunner：按步骤执行
│   │   ├── session.ts                # SessionManager：Cookie 存取
│   │   └── mapper.ts                 # DataMapper：{{变量}} 替换
│   ├── codegen/
│   │   └── capture.ts                # CodegenCapture：录制→JSON
│   ├── queue/
│   │   └── taskQueue.ts              # p-queue 任务队列 + 事件发射
│   ├── excel/
│   │   └── parser.ts                 # Excel → Record<string,string>[]
│   └── prisma.ts                     # Prisma 客户端单例
├── components/
│   ├── FlowCard.tsx                  # 流程卡片组件
│   ├── ManualForm.tsx                # 根据 fields[] 动态生成输入表单
│   ├── TaskProgress.tsx              # SSE 消费 + 步骤进度显示
│   ├── JsonEditor.tsx                # JSON 配置可视化编辑器
│   ├── ExcelUpload.tsx               # 拖拽上传 Excel 组件
│   └── SessionStatus.tsx            # 登录状态指示器
├── types/
│   └── flow.ts                       # 所有 TypeScript 类型定义
├── prisma/
│   └── schema.prisma
├── __tests__/
│   ├── mapper.test.ts
│   ├── parser.test.ts
│   └── runner.test.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── tailwind.config.ts
```

---

## Task 1: 项目初始化

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `vitest.config.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `next.config.ts`

- [ ] **Step 1: 初始化 Next.js 项目**

```bash
cd D:/claude/autosystem
npx create-next-app@14 . --typescript --tailwind --app --no-src-dir --import-alias "@/*" --yes
```

预期输出：`Success! Created autosystem`，生成 `package.json`, `app/`, `tailwind.config.ts` 等。

- [ ] **Step 2: 安装依赖**

```bash
npm install playwright @playwright/browser-chromium prisma @prisma/client xlsx p-queue
npm install -D vitest @vitejs/plugin-react @types/node
```

- [ ] **Step 3: 安装 Playwright 浏览器**

```bash
npx playwright install chromium
```

预期输出：`Downloading Chromium...` 完成后显示路径。

- [ ] **Step 4: 配置 Vitest**

新建 `vitest.config.ts`：

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 5: 在 package.json 中添加测试脚本**

在 `package.json` 的 `scripts` 中添加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 6: 配置 next.config.ts（允许 Playwright 在服务端运行）**

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['playwright'],
  },
}

export default nextConfig
```

- [ ] **Step 7: 更新 app/layout.tsx（添加导航栏）**

```typescript
import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: '自动化填写平台',
  description: '网页表单自动化工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-3 flex gap-6 items-center">
          <span className="font-bold text-blue-400">AutoFill</span>
          <Link href="/flows" className="text-gray-400 hover:text-white text-sm">流程库</Link>
          <Link href="/history" className="text-gray-400 hover:text-white text-sm">历史记录</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}
```

- [ ] **Step 8: app/page.tsx 重定向到流程库**

```typescript
import { redirect } from 'next/navigation'

export default function Home() {
  redirect('/flows')
}
```

- [ ] **Step 9: 验证项目可启动**

```bash
npm run dev
```

预期：浏览器打开 `http://localhost:3000`，自动跳转到 `/flows`（显示 404，正常）。

- [ ] **Step 10: 提交**

```bash
git init
git add .
git commit -m "chore: initialize Next.js 14 project with Playwright and Prisma"
```

---

## Task 2: 类型定义 + 数据库

**Files:**
- Create: `types/flow.ts`
- Create: `prisma/schema.prisma`
- Create: `lib/prisma.ts`

- [ ] **Step 1: 创建类型定义文件**

新建 `types/flow.ts`：

```typescript
export type StepAction = 'fill' | 'click' | 'select' | 'waitFor' | 'screenshot' | 'check'

export interface Step {
  action: StepAction
  selector: string
  value?: string          // 支持 {{变量名}} 占位符
  timeout?: number        // 默认 5000ms
  description?: string    // 步骤描述，显示在进度日志中
}

export interface FieldDef {
  name: string            // 变量名，对应 steps 中的 {{name}}
  label: string           // 界面显示名称
  type: 'text' | 'number' | 'select' | 'date' | 'textarea'
  required?: boolean
  options?: string[]      // select 类型的选项列表
}

export interface FlowConfig {
  name: string
  url: string
  fields: FieldDef[]
  steps: Step[]
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed'

export interface StepLog {
  stepIndex: number
  description: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
  timestamp: string
}

export interface TaskProgressEvent {
  type: 'step' | 'done' | 'error'
  stepIndex?: number
  description?: string
  status?: 'success' | 'failed'
  error?: string
  totalSteps?: number
}
```

- [ ] **Step 2: 定义 Prisma Schema**

新建 `prisma/schema.prisma`：

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./data.db"
}

model Flow {
  id        String   @id @default(cuid())
  name      String
  url       String
  config    String   // JSON 序列化的 FlowConfig
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  tasks     Task[]
}

model Task {
  id             String    @id @default(cuid())
  flowId         String
  flow           Flow      @relation(fields: [flowId], references: [id], onDelete: Cascade)
  status         String    @default("pending")
  inputData      String    // JSON 序列化的 Record<string, string>
  logs           String    @default("[]") // JSON 序列化的 StepLog[]
  screenshotPath String?
  errorMessage   String?
  createdAt      DateTime  @default(now())
  completedAt    DateTime?
}

model Session {
  id        String   @id @default(cuid())
  siteUrl   String   @unique
  cookies   String   // JSON 序列化的 Cookie 数组
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

- [ ] **Step 3: 运行数据库迁移**

```bash
npx prisma migrate dev --name init
npx prisma generate
```

预期输出：`✓ Generated Prisma Client`，生成 `prisma/data.db`。

- [ ] **Step 4: 创建 Prisma 客户端单例**

新建 `lib/prisma.ts`：

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 5: 提交**

```bash
git add .
git commit -m "feat: add TypeScript types and Prisma schema with SQLite"
```

---

## Task 3: DataMapper（变量替换）

**Files:**
- Create: `lib/playwright/mapper.ts`
- Create: `__tests__/mapper.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `__tests__/mapper.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { applyTemplate, mapStepValue } from '../lib/playwright/mapper'

describe('applyTemplate', () => {
  it('replaces single variable', () => {
    expect(applyTemplate('{{name}}', { name: '张三' })).toBe('张三')
  })

  it('replaces multiple variables', () => {
    expect(applyTemplate('{{year}}年{{month}}月', { year: '2026', month: '5' })).toBe('2026年5月')
  })

  it('leaves unknown variables as empty string', () => {
    expect(applyTemplate('{{unknown}}', {})).toBe('')
  })

  it('returns plain string unchanged', () => {
    expect(applyTemplate('无变量', { name: '张三' })).toBe('无变量')
  })
})

describe('mapStepValue', () => {
  it('returns undefined when step has no value', () => {
    expect(mapStepValue(undefined, {})).toBeUndefined()
  })

  it('applies template when value exists', () => {
    expect(mapStepValue('金额：{{amount}}', { amount: '100' })).toBe('金额：100')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- mapper
```

预期：`Cannot find module '../lib/playwright/mapper'`

- [ ] **Step 3: 实现 mapper.ts**

新建 `lib/playwright/mapper.ts`：

```typescript
export function applyTemplate(template: string, data: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? '')
}

export function mapStepValue(
  value: string | undefined,
  data: Record<string, string>
): string | undefined {
  if (value === undefined) return undefined
  return applyTemplate(value, data)
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- mapper
```

预期：`✓ mapper.test.ts (4)` 全部绿色。

- [ ] **Step 5: 提交**

```bash
git add lib/playwright/mapper.ts __tests__/mapper.test.ts
git commit -m "feat: add DataMapper for template variable substitution"
```

---

## Task 4: Excel 解析器

**Files:**
- Create: `lib/excel/parser.ts`
- Create: `__tests__/parser.test.ts`

- [ ] **Step 1: 写失败测试**

新建 `__tests__/parser.test.ts`：

```typescript
import { describe, it, expect } from 'vitest'
import { parseExcelBuffer } from '../lib/excel/parser'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'

function makeExcelBuffer(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}

describe('parseExcelBuffer', () => {
  it('parses rows into array of records', () => {
    const buf = makeExcelBuffer([
      { amount: '100', category: '差旅' },
      { amount: '200', category: '办公' },
    ])
    const result = parseExcelBuffer(buf)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ amount: '100', category: '差旅' })
  })

  it('converts all values to strings', () => {
    const buf = makeExcelBuffer([{ amount: '999' }])
    const result = parseExcelBuffer(buf)
    expect(typeof result[0].amount).toBe('string')
  })

  it('returns empty array for empty sheet', () => {
    const buf = makeExcelBuffer([])
    const result = parseExcelBuffer(buf)
    expect(result).toEqual([])
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npm test -- parser
```

预期：`Cannot find module '../lib/excel/parser'`

- [ ] **Step 3: 实现 parser.ts**

新建 `lib/excel/parser.ts`：

```typescript
import * as XLSX from 'xlsx'

export function parseExcelBuffer(buffer: Buffer): Record<string, string>[] {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []

  const sheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  return rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([k, v]) => [k, String(v ?? '')])
    )
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npm test -- parser
```

预期：`✓ parser.test.ts (3)` 全部绿色。

- [ ] **Step 5: 提交**

```bash
git add lib/excel/parser.ts __tests__/parser.test.ts
git commit -m "feat: add Excel parser using SheetJS"
```

---

## Task 5: FlowRunner（执行引擎）

**Files:**
- Create: `lib/playwright/runner.ts`
- Create: `lib/playwright/session.ts`
- Create: `__tests__/runner.test.ts`

- [ ] **Step 1: 实现 SessionManager**

新建 `lib/playwright/session.ts`：

```typescript
import { BrowserContext, chromium } from 'playwright'
import { prisma } from '../prisma'

export async function loadSession(url: string): Promise<BrowserContext> {
  const origin = new URL(url).origin
  const saved = await prisma.session.findUnique({ where: { siteUrl: origin } })

  const browser = await chromium.launch({ headless: false })

  if (saved) {
    const cookies = JSON.parse(saved.cookies)
    const context = await browser.newContext()
    await context.addCookies(cookies)
    return context
  }

  return browser.newContext()
}

export async function saveSession(context: BrowserContext, url: string): Promise<void> {
  const origin = new URL(url).origin
  const cookies = await context.cookies()

  await prisma.session.upsert({
    where: { siteUrl: origin },
    update: { cookies: JSON.stringify(cookies) },
    create: { siteUrl: origin, cookies: JSON.stringify(cookies) },
  })
}

export async function isSessionValid(url: string): Promise<boolean> {
  const origin = new URL(url).origin
  const saved = await prisma.session.findUnique({ where: { siteUrl: origin } })
  return !!saved && saved.cookies !== '[]'
}
```

- [ ] **Step 2: 实现 FlowRunner**

新建 `lib/playwright/runner.ts`：

```typescript
import { Page } from 'playwright'
import { FlowConfig, StepLog, TaskProgressEvent } from '@/types/flow'
import { mapStepValue } from './mapper'
import { loadSession, saveSession } from './session'

export type ProgressEmitter = (event: TaskProgressEvent) => void

export async function runFlow(
  config: FlowConfig,
  data: Record<string, string>,
  onProgress: ProgressEmitter
): Promise<{ logs: StepLog[]; screenshotPath?: string }> {
  const context = await loadSession(config.url)
  const page = await context.newPage()
  const logs: StepLog[] = []
  let screenshotPath: string | undefined

  try {
    await page.goto(config.url, { waitUntil: 'networkidle' })

    for (let i = 0; i < config.steps.length; i++) {
      const step = config.steps[i]
      const value = mapStepValue(step.value, data)
      const timeout = step.timeout ?? 5000
      const desc = step.description ?? `${step.action} ${step.selector}`

      onProgress({ type: 'step', stepIndex: i, description: desc, status: 'success' })

      try {
        switch (step.action) {
          case 'fill':
            await page.fill(step.selector, value ?? '', { timeout })
            break
          case 'click':
            await page.click(step.selector, { timeout })
            break
          case 'select':
            await page.selectOption(step.selector, value ?? '', { timeout })
            break
          case 'waitFor':
            await page.waitForSelector(step.selector, { timeout })
            break
          case 'check':
            await page.check(step.selector, { timeout })
            break
          case 'screenshot': {
            const path = `data/screenshots/${Date.now()}.png`
            await page.screenshot({ path, fullPage: false })
            screenshotPath = path
            break
          }
        }

        logs.push({ stepIndex: i, description: desc, status: 'success', timestamp: new Date().toISOString() })
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err)
        logs.push({ stepIndex: i, description: desc, status: 'failed', error, timestamp: new Date().toISOString() })
        onProgress({ type: 'error', stepIndex: i, description: desc, error })
        throw err
      }
    }

    await saveSession(context, config.url)
    onProgress({ type: 'done', totalSteps: config.steps.length })
  } finally {
    await context.browser()?.close()
  }

  return { logs, screenshotPath }
}
```

- [ ] **Step 3: 写 runner 单元测试（mock Playwright）**

新建 `__tests__/runner.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Playwright 和 session
vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn().mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          fill: vi.fn().mockResolvedValue(undefined),
          click: vi.fn().mockResolvedValue(undefined),
          screenshot: vi.fn().mockResolvedValue(undefined),
          waitForSelector: vi.fn().mockResolvedValue(undefined),
          selectOption: vi.fn().mockResolvedValue(undefined),
          check: vi.fn().mockResolvedValue(undefined),
        }),
        addCookies: vi.fn(),
        cookies: vi.fn().mockResolvedValue([]),
        browser: vi.fn().mockReturnValue({ close: vi.fn() }),
      }),
      close: vi.fn(),
    }),
  },
}))

vi.mock('../lib/playwright/session', () => ({
  loadSession: vi.fn().mockResolvedValue({
    newPage: vi.fn().mockResolvedValue({
      goto: vi.fn(),
      fill: vi.fn(),
      click: vi.fn(),
      screenshot: vi.fn(),
      waitForSelector: vi.fn(),
      selectOption: vi.fn(),
      check: vi.fn(),
    }),
    cookies: vi.fn().mockResolvedValue([]),
    browser: vi.fn().mockReturnValue({ close: vi.fn() }),
  }),
  saveSession: vi.fn().mockResolvedValue(undefined),
}))

import { runFlow } from '../lib/playwright/runner'
import type { FlowConfig } from '../types/flow'

const mockConfig: FlowConfig = {
  name: 'Test Flow',
  url: 'http://test.local',
  fields: [{ name: 'amount', label: '金额', type: 'number' }],
  steps: [
    { action: 'fill', selector: '#amount', value: '{{amount}}', description: '填写金额' },
    { action: 'click', selector: '#submit', description: '点击提交' },
  ],
}

describe('runFlow', () => {
  it('returns logs for each step on success', async () => {
    const events: string[] = []
    const { logs } = await runFlow(mockConfig, { amount: '100' }, (e) => events.push(e.type))
    expect(logs).toHaveLength(2)
    expect(logs[0].status).toBe('success')
    expect(logs[1].status).toBe('success')
  })

  it('emits progress events for each step', async () => {
    const events: string[] = []
    await runFlow(mockConfig, { amount: '100' }, (e) => events.push(e.type))
    expect(events).toContain('step')
    expect(events).toContain('done')
  })
})
```

- [ ] **Step 4: 运行测试**

```bash
npm test -- runner
```

预期：`✓ runner.test.ts (2)` 通过。

- [ ] **Step 5: 创建截图存储目录**

```bash
mkdir -p data/screenshots
echo "*.png" > data/screenshots/.gitignore
```

- [ ] **Step 6: 提交**

```bash
git add lib/playwright/ __tests__/runner.test.ts data/
git commit -m "feat: add FlowRunner, SessionManager with Playwright"
```

---

## Task 6: Flows API（增删改查）

**Files:**
- Create: `app/api/flows/route.ts`
- Create: `app/api/flows/[id]/route.ts`

- [ ] **Step 1: 实现 GET 列表 + POST 创建**

新建 `app/api/flows/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'

export async function GET() {
  const flows = await prisma.flow.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, url: true, createdAt: true },
  })
  return NextResponse.json(flows)
}

export async function POST(req: Request) {
  const body: { name: string; url: string; config: FlowConfig } = await req.json()

  if (!body.name || !body.url || !body.config) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const flow = await prisma.flow.create({
    data: {
      name: body.name,
      url: body.url,
      config: JSON.stringify(body.config),
    },
  })

  return NextResponse.json(flow, { status: 201 })
}
```

- [ ] **Step 2: 实现单个 Flow 的 GET / PUT / DELETE**

新建 `app/api/flows/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const flow = await prisma.flow.findUnique({ where: { id: params.id } })
  if (!flow) return NextResponse.json({ error: '流程不存在' }, { status: 404 })

  return NextResponse.json({ ...flow, config: JSON.parse(flow.config) as FlowConfig })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body: { name?: string; config?: FlowConfig } = await req.json()

  const flow = await prisma.flow.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.config && { config: JSON.stringify(body.config) }),
    },
  })

  return NextResponse.json(flow)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.flow.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 用 curl 验证 API 可用**

```bash
# 启动开发服务器（另开终端）
npm run dev

# 创建测试流程
curl -X POST http://localhost:3000/api/flows \
  -H "Content-Type: application/json" \
  -d '{"name":"测试流程","url":"http://test.com","config":{"name":"测试","url":"http://test.com","fields":[],"steps":[]}}'
```

预期：返回含 `id` 的 JSON 对象，状态码 201。

```bash
# 查询列表
curl http://localhost:3000/api/flows
```

预期：返回包含刚才创建记录的数组。

- [ ] **Step 4: 提交**

```bash
git add app/api/flows/
git commit -m "feat: add Flows CRUD API routes"
```

---

## Task 7: Tasks API + 任务队列 + SSE

**Files:**
- Create: `lib/queue/taskQueue.ts`
- Create: `app/api/tasks/run/route.ts`
- Create: `app/api/tasks/[id]/route.ts`
- Create: `app/api/tasks/[id]/stream/route.ts`

- [ ] **Step 1: 实现任务队列（p-queue + 事件发射）**

新建 `lib/queue/taskQueue.ts`：

```typescript
import PQueue from 'p-queue'
import { EventEmitter } from 'events'
import { TaskProgressEvent } from '@/types/flow'

const queue = new PQueue({ concurrency: 1 })
const emitter = new EventEmitter()

// 防止 Node.js 最大监听器警告
emitter.setMaxListeners(50)

export function subscribeToTask(taskId: string, cb: (event: TaskProgressEvent) => void) {
  emitter.on(`task:${taskId}`, cb)
  return () => emitter.off(`task:${taskId}`, cb)
}

export function emitTaskEvent(taskId: string, event: TaskProgressEvent) {
  emitter.emit(`task:${taskId}`, event)
}

export function enqueueTask(fn: () => Promise<void>) {
  return queue.add(fn)
}

export function getQueueSize() {
  return queue.size
}
```

- [ ] **Step 2: 实现启动任务 API**

新建 `app/api/tasks/run/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'
import { runFlow } from '@/lib/playwright/runner'
import { enqueueTask, emitTaskEvent } from '@/lib/queue/taskQueue'

export async function POST(req: Request) {
  const body: { flowId: string; inputData: Record<string, string> } = await req.json()

  const flow = await prisma.flow.findUnique({ where: { id: body.flowId } })
  if (!flow) return NextResponse.json({ error: '流程不存在' }, { status: 404 })

  const task = await prisma.task.create({
    data: {
      flowId: flow.id,
      status: 'pending',
      inputData: JSON.stringify(body.inputData),
    },
  })

  const config = JSON.parse(flow.config) as FlowConfig

  enqueueTask(async () => {
    await prisma.task.update({ where: { id: task.id }, data: { status: 'running' } })

    try {
      const { logs, screenshotPath } = await runFlow(config, body.inputData, (event) => {
        emitTaskEvent(task.id, event)
      })

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'success',
          logs: JSON.stringify(logs),
          screenshotPath,
          completedAt: new Date(),
        },
      })
    } catch (err) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      })
    }
  })

  return NextResponse.json({ taskId: task.id }, { status: 202 })
}
```

- [ ] **Step 3: 实现任务状态查询 API**

新建 `app/api/tasks/[id]/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 })

  return NextResponse.json({
    ...task,
    inputData: JSON.parse(task.inputData),
    logs: JSON.parse(task.logs),
  })
}
```

- [ ] **Step 4: 实现 SSE 进度流**

新建 `app/api/tasks/[id]/stream/route.ts`：

```typescript
import { subscribeToTask } from '@/lib/queue/taskQueue'
import { TaskProgressEvent } from '@/types/flow'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: TaskProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        if (event.type === 'done' || event.type === 'error') {
          controller.close()
        }
      }

      unsubscribe = subscribeToTask(params.id, send)
    },
    cancel() {
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 5: 提交**

```bash
git add lib/queue/ app/api/tasks/
git commit -m "feat: add task queue with p-queue and SSE progress streaming"
```

---

## Task 8: 前端 UI — 流程库

**Files:**
- Create: `components/FlowCard.tsx`
- Create: `app/flows/page.tsx`

- [ ] **Step 1: 实现 FlowCard 组件**

新建 `components/FlowCard.tsx`：

```typescript
import Link from 'next/link'

interface FlowCardProps {
  id: string
  name: string
  url: string
  createdAt: string
  onDelete: (id: string) => void
}

export function FlowCard({ id, name, url, createdAt, onDelete }: FlowCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white">{name}</h3>
        <button
          onClick={() => onDelete(id)}
          className="text-gray-500 hover:text-red-400 text-sm"
        >
          删除
        </button>
      </div>
      <p className="text-gray-400 text-sm mb-3 truncate">{url}</p>
      <p className="text-gray-600 text-xs mb-3">
        创建于 {new Date(createdAt).toLocaleDateString('zh-CN')}
      </p>
      <div className="flex gap-2">
        <Link
          href={`/flows/${id}`}
          className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded"
        >
          执行
        </Link>
        <Link
          href={`/flows/${id}/edit`}
          className="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 rounded"
        >
          编辑
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 实现流程库列表页**

新建 `app/flows/page.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlowCard } from '@/components/FlowCard'

interface FlowSummary {
  id: string
  name: string
  url: string
  createdAt: string
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flows')
      .then(r => r.json())
      .then(data => { setFlows(data); setLoading(false) })
  }, [])

  async function handleDelete(id: string) {
    if (!confirm('确认删除该流程？')) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    setFlows(prev => prev.filter(f => f.id !== id))
  }

  if (loading) return <div className="text-gray-400">加载中...</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">流程库</h1>
        <Link
          href="/flows/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + 新建流程
        </Link>
      </div>

      {flows.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">暂无流程</p>
          <p className="text-sm">点击「新建流程」录制第一个自动化流程</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(flow => (
            <FlowCard key={flow.id} {...flow} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 在浏览器中验证**

访问 `http://localhost:3000/flows`，确认：
- 显示「暂无流程」空状态
- 「新建流程」按钮存在
- 页面无 console 报错

- [ ] **Step 4: 提交**

```bash
git add components/FlowCard.tsx app/flows/page.tsx
git commit -m "feat: add flow library page with FlowCard component"
```

---

## Task 9: 前端 UI — 手动执行任务

**Files:**
- Create: `components/ManualForm.tsx`
- Create: `components/TaskProgress.tsx`
- Create: `components/SessionStatus.tsx`
- Create: `app/flows/[id]/page.tsx`
- Create: `app/tasks/[id]/page.tsx`

- [ ] **Step 1: 实现 ManualForm（动态字段表单）**

新建 `components/ManualForm.tsx`：

```typescript
'use client'
import { useState } from 'react'
import { FieldDef } from '@/types/flow'

interface ManualFormProps {
  fields: FieldDef[]
  onSubmit: (data: Record<string, string>) => void
  loading?: boolean
}

export function ManualForm({ fields, onSubmit, loading }: ManualFormProps) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.name, '']))
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {fields.map(field => (
        <div key={field.name}>
          <label className="block text-sm text-gray-400 mb-1">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {field.type === 'select' ? (
            <select
              value={values[field.name]}
              onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
              required={field.required}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">请选择</option>
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : field.type === 'textarea' ? (
            <textarea
              value={values[field.name]}
              onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
              required={field.required}
              rows={3}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
            />
          ) : (
            <input
              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
              value={values[field.name]}
              onChange={e => setValues(v => ({ ...v, [field.name]: e.target.value }))}
              required={field.required}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          )}
        </div>
      ))}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
      >
        {loading ? '执行中...' : '开始执行'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: 实现 TaskProgress（SSE 消费组件）**

新建 `components/TaskProgress.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'
import { TaskProgressEvent } from '@/types/flow'

interface TaskProgressProps {
  taskId: string
}

export function TaskProgress({ taskId }: TaskProgressProps) {
  const [events, setEvents] = useState<TaskProgressEvent[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const es = new EventSource(`/api/tasks/${taskId}/stream`)

    es.onmessage = (e) => {
      const event: TaskProgressEvent = JSON.parse(e.data)
      setEvents(prev => [...prev, event])
      if (event.type === 'done' || event.type === 'error') {
        setDone(true)
        es.close()
      }
    }

    es.onerror = () => { setDone(true); es.close() }

    return () => es.close()
  }, [taskId])

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
            event.type === 'error' ? 'bg-red-900/30 text-red-300' :
            event.type === 'done' ? 'bg-green-900/30 text-green-300' :
            event.status === 'failed' ? 'bg-red-900/20 text-red-400' :
            'bg-gray-800 text-gray-300'
          }`}
        >
          <span>{event.type === 'done' ? '✅' : event.type === 'error' ? '❌' : '▸'}</span>
          <span>{event.description ?? event.type}</span>
          {event.error && <span className="text-red-400 text-xs ml-auto">{event.error}</span>}
        </div>
      ))}
      {!done && events.length > 0 && (
        <div className="text-gray-500 text-sm animate-pulse">执行中...</div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: 实现流程详情 + 执行页**

新建 `app/flows/[id]/page.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowConfig } from '@/types/flow'
import { ManualForm } from '@/components/ManualForm'
import { TaskProgress } from '@/components/TaskProgress'

export default function FlowDetailPage({ params }: { params: { id: string } }) {
  const [flow, setFlow] = useState<{ id: string; name: string; config: FlowConfig } | null>(null)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/flows/${params.id}`)
      .then(r => r.json())
      .then(setFlow)
  }, [params.id])

  async function handleRun(data: Record<string, string>) {
    setRunning(true)
    const res = await fetch('/api/tasks/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowId: params.id, inputData: data }),
    })
    const { taskId } = await res.json()
    setTaskId(taskId)
  }

  if (!flow) return <div className="text-gray-400">加载中...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-2xl font-bold">{flow.name}</h1>
      </div>

      <p className="text-gray-500 text-sm mb-6">{flow.config.url}</p>

      {!taskId ? (
        <div>
          <h2 className="text-lg font-semibold mb-4">输入数据</h2>
          {flow.config.fields.length === 0 ? (
            <button
              onClick={() => handleRun({})}
              disabled={running}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-6 py-2 rounded-lg"
            >
              {running ? '启动中...' : '开始执行'}
            </button>
          ) : (
            <ManualForm fields={flow.config.fields} onSubmit={handleRun} loading={running} />
          )}
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-semibold mb-4">执行进度</h2>
          <TaskProgress taskId={taskId} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 实现任务历史页面**

新建 `app/history/page.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'

interface TaskRecord {
  id: string
  status: string
  createdAt: string
  completedAt?: string
  flow: { name: string }
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([])

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(setTasks)
  }, [])

  const statusColor: Record<string, string> = {
    success: 'text-green-400',
    failed: 'text-red-400',
    running: 'text-yellow-400',
    pending: 'text-gray-400',
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">历史记录</h1>
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className="bg-gray-800 rounded-lg px-4 py-3 flex items-center gap-4">
            <span className={`font-medium text-sm ${statusColor[task.status] ?? 'text-gray-400'}`}>
              {task.status}
            </span>
            <span className="text-white">{task.flow?.name ?? '已删除流程'}</span>
            <span className="text-gray-500 text-sm ml-auto">
              {new Date(task.createdAt).toLocaleString('zh-CN')}
            </span>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="text-gray-500 text-center py-10">暂无执行记录</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 添加 GET /api/tasks 列表接口**

新建 `app/api/tasks/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { flow: { select: { name: true } } },
  })
  return NextResponse.json(tasks)
}
```

- [ ] **Step 6: 在浏览器中完整验证**

1. 访问 `http://localhost:3000/flows`
2. 点击「新建流程」（显示 404，正常，下一个 Task 实现）
3. 手动用 curl 创建一个带 fields 的测试流程：

```bash
curl -X POST http://localhost:3000/api/flows \
  -H "Content-Type: application/json" \
  -d '{"name":"测试表单","url":"https://example.com","config":{"name":"测试","url":"https://example.com","fields":[{"name":"name","label":"姓名","type":"text","required":true}],"steps":[{"action":"fill","selector":"#name","value":"{{name}}","description":"填写姓名"}]}}'
```

4. 刷新流程库，确认流程卡片显示
5. 点击「执行」，确认表单渲染正确

- [ ] **Step 7: 提交**

```bash
git add components/ app/flows/ app/tasks/ app/history/ app/api/tasks/
git commit -m "feat: add flow execution UI with ManualForm and SSE TaskProgress"
```

---

## Task 10: 录制流程 + 新建 UI

**Files:**
- Create: `lib/codegen/capture.ts`
- Create: `app/api/codegen/start/route.ts`
- Create: `app/api/codegen/stop/route.ts`
- Create: `components/JsonEditor.tsx`
- Create: `app/flows/new/page.tsx`
- Create: `app/flows/[id]/edit/page.tsx`

- [ ] **Step 1: 实现 CodegenCapture**

新建 `lib/codegen/capture.ts`：

```typescript
import { chromium, Browser } from 'playwright'
import { FlowConfig, Step } from '@/types/flow'

let activeBrowser: Browser | null = null
let capturedActions: Array<{ action: string; selector: string; value?: string }> = []

export async function startRecording(url: string): Promise<void> {
  if (activeBrowser) await activeBrowser.close()
  capturedActions = []

  // 使用 Playwright 的 codegen 收集用户操作
  // 通过 page 事件监听器实现录制
  activeBrowser = await chromium.launch({ headless: false })
  const context = await activeBrowser.newContext()
  const page = await context.newPage()

  // 注入录制脚本：监听 input、click、change 事件
  await page.goto(url)
  await page.exposeFunction('__captureAction', (action: object) => {
    capturedActions.push(action as typeof capturedActions[0])
  })

  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const el = e.target as HTMLElement
      const selector = el.id ? `#${el.id}` : el.tagName.toLowerCase()
      ;(window as typeof window & { __captureAction: Function }).__captureAction({
        action: 'click', selector, value: undefined
      })
    }, true)

    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement
      const selector = el.id ? `#${el.id}` : el.name ? `[name="${el.name}"]` : el.tagName.toLowerCase()
      ;(window as typeof window & { __captureAction: Function }).__captureAction({
        action: el.tagName === 'SELECT' ? 'select' : 'fill',
        selector,
        value: el.value
      })
    }, true)
  })
}

export async function stopRecording(flowName: string, url: string): Promise<FlowConfig> {
  if (activeBrowser) {
    await activeBrowser.close()
    activeBrowser = null
  }

  // 对捕获的动作去重（相同 selector 的 fill 保留最后一次）
  const deduped = deduplicateActions(capturedActions)

  const steps: Step[] = deduped.map((a, i) => ({
    action: a.action as Step['action'],
    selector: a.selector,
    value: a.value ? `{{field_${i}}}` : undefined,
    description: `${a.action} ${a.selector}`,
  }))

  // 从有 value 的步骤中提取字段定义
  const fields = deduped
    .filter(a => a.value !== undefined)
    .map((a, i) => ({
      name: `field_${i}`,
      label: a.selector.replace(/[#\[\]="']/g, '').slice(0, 20) || `字段${i + 1}`,
      type: 'text' as const,
    }))

  return { name: flowName, url, fields, steps }
}

function deduplicateActions(actions: typeof capturedActions) {
  const seen = new Map<string, typeof capturedActions[0]>()
  for (const a of actions) {
    if (a.action === 'fill' || a.action === 'select') {
      seen.set(a.selector, a) // 同一 selector 只保留最后一次 fill
    } else {
      seen.set(`${a.action}:${a.selector}:${Date.now()}`, a)
    }
  }
  return Array.from(seen.values())
}
```

- [ ] **Step 2: 实现录制 API**

新建 `app/api/codegen/start/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { startRecording } from '@/lib/codegen/capture'

export async function POST(req: Request) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: '缺少 url' }, { status: 400 })

  await startRecording(url)
  return NextResponse.json({ ok: true })
}
```

新建 `app/api/codegen/stop/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { stopRecording } from '@/lib/codegen/capture'

export async function POST(req: Request) {
  const { name, url } = await req.json()
  const config = await stopRecording(name ?? '新流程', url)
  return NextResponse.json(config)
}
```

- [ ] **Step 3: 实现 JsonEditor 组件**

新建 `components/JsonEditor.tsx`：

```typescript
'use client'
import { useState } from 'react'
import { FlowConfig } from '@/types/flow'

interface JsonEditorProps {
  value: FlowConfig
  onChange: (config: FlowConfig) => void
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const [text, setText] = useState(JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  function handleChange(raw: string) {
    setText(raw)
    try {
      const parsed = JSON.parse(raw) as FlowConfig
      setError(null)
      onChange(parsed)
    } catch {
      setError('JSON 格式错误')
    }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={e => handleChange(e.target.value)}
        className="w-full h-96 bg-gray-900 border border-gray-700 rounded p-4 font-mono text-sm text-green-300 focus:outline-none focus:border-blue-500 resize-y"
        spellCheck={false}
      />
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 4: 实现新建流程页**

新建 `app/flows/new/page.tsx`：

```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowConfig } from '@/types/flow'
import { JsonEditor } from '@/components/JsonEditor'

type Step = 'input' | 'recording' | 'review'

export default function NewFlowPage() {
  const [step, setStep] = useState<Step>('input')
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  async function handleStartRecording() {
    await fetch('/api/codegen/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    setStep('recording')
  }

  async function handleStopRecording() {
    const res = await fetch('/api/codegen/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url }),
    })
    const cfg = await res.json() as FlowConfig
    setConfig(cfg)
    setStep('review')
  }

  async function handleSave() {
    if (!config) return
    setSaving(true)
    await fetch('/api/flows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, url, config }),
    })
    router.push('/flows')
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">新建流程</h1>

      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">流程名称</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="如：OA报销申请"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">目标网址</label>
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://oa.company.com/..."
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={handleStartRecording}
            disabled={!name || !url}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
          >
            开始录制
          </button>
        </div>
      )}

      {step === 'recording' && (
        <div className="text-center py-10">
          <div className="inline-flex items-center gap-2 bg-red-900/30 text-red-300 px-4 py-2 rounded-full mb-4">
            <span className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
            录制中
          </div>
          <p className="text-gray-400 mb-6">浏览器已打开，请操作表单。完成后点击下方按钮。</p>
          <button
            onClick={handleStopRecording}
            className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg"
          >
            停止录制
          </button>
        </div>
      )}

      {step === 'review' && config && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">录制完成，确认或调整以下配置后保存：</p>
          <JsonEditor value={config} onChange={setConfig} />
          <div className="flex gap-3">
            <button
              onClick={() => setStep('input')}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg"
            >
              重新录制
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
            >
              {saving ? '保存中...' : '保存流程'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: 实现 JSON 编辑器页面**

新建 `app/flows/[id]/edit/page.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowConfig } from '@/types/flow'
import { JsonEditor } from '@/components/JsonEditor'

export default function EditFlowPage({ params }: { params: { id: string } }) {
  const [flow, setFlow] = useState<{ name: string; config: FlowConfig } | null>(null)
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/flows/${params.id}`)
      .then(r => r.json())
      .then(data => { setFlow(data); setConfig(data.config) })
  }, [params.id])

  async function handleSave() {
    if (!config) return
    setSaving(true)
    await fetch(`/api/flows/${params.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    })
    router.push('/flows')
  }

  if (!flow || !config) return <div className="text-gray-400">加载中...</div>

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">{flow.name}</h1>
      <p className="text-gray-500 text-sm mb-6">编辑 JSON 配置</p>
      <JsonEditor value={config} onChange={setConfig} />
      <div className="flex gap-3 mt-4">
        <button onClick={() => router.back()} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">
          取消
        </button>
        <button onClick={handleSave} disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: 提交**

```bash
git add lib/codegen/ app/api/codegen/ components/JsonEditor.tsx app/flows/new/ app/flows/[id]/edit/
git commit -m "feat: add codegen recording flow and JSON editor UI"
```

---

## Task 11: Excel 批量上传

**Files:**
- Create: `app/api/upload/excel/route.ts`
- Create: `components/ExcelUpload.tsx`

- [ ] **Step 1: 实现 Excel 上传 API**

新建 `app/api/upload/excel/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { parseExcelBuffer } from '@/lib/excel/parser'

export async function POST(req: Request) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: '未上传文件' }, { status: 400 })
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.csv')) {
    return NextResponse.json({ error: '仅支持 .xlsx 和 .csv 文件' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const rows = parseExcelBuffer(buffer)

  return NextResponse.json({ rows, total: rows.length })
}
```

- [ ] **Step 2: 实现 ExcelUpload 组件**

新建 `components/ExcelUpload.tsx`：

```typescript
'use client'
import { useState, useRef } from 'react'

interface ExcelUploadProps {
  onData: (rows: Record<string, string>[]) => void
}

export function ExcelUpload({ onData }: ExcelUploadProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setLoading(true)
    setError(null)
    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/upload/excel', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
    } else {
      setFileName(`${file.name}（${data.total} 行）`)
      onData(data.rows)
    }
    setLoading(false)
  }

  return (
    <div
      className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
      onClick={() => inputRef.current?.click()}
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />
      {loading ? (
        <p className="text-gray-400 animate-pulse">解析中...</p>
      ) : fileName ? (
        <p className="text-green-400">✓ {fileName}</p>
      ) : (
        <div>
          <p className="text-gray-400 mb-1">拖拽或点击上传 Excel</p>
          <p className="text-gray-600 text-sm">支持 .xlsx / .csv，列名需与流程字段名一致</p>
        </div>
      )}
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 3: 在流程执行页中集成 ExcelUpload**

修改 `app/flows/[id]/page.tsx`，在 ManualForm 上方添加上传选项：

在 `{!taskId ? (` 块中，将数据输入区域替换为：

```typescript
// 在 useState 中添加：
const [batchRows, setBatchRows] = useState<Record<string, string>[] | null>(null)
const [inputMode, setInputMode] = useState<'manual' | 'excel'>('manual')

// 在 JSX 中：
<div className="flex gap-2 mb-4 border-b border-gray-700 pb-3">
  <button
    onClick={() => setInputMode('manual')}
    className={`text-sm px-3 py-1 rounded ${inputMode === 'manual' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
  >
    手动输入
  </button>
  <button
    onClick={() => setInputMode('excel')}
    className={`text-sm px-3 py-1 rounded ${inputMode === 'excel' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
  >
    Excel 批量
  </button>
</div>

{inputMode === 'manual' ? (
  <ManualForm fields={flow.config.fields} onSubmit={handleRun} loading={running} />
) : (
  <div>
    <ExcelUpload onData={rows => setBatchRows(rows)} />
    {batchRows && (
      <button
        onClick={() => batchRows.forEach(row => handleRun(row))}
        className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg"
      >
        批量执行 {batchRows.length} 条
      </button>
    )}
  </div>
)}
```

- [ ] **Step 4: 提交**

```bash
git add app/api/upload/ components/ExcelUpload.tsx app/flows/
git commit -m "feat: add Excel upload and batch task execution"
```

---

## Task 12: 登录 Session 管理 UI

**Files:**
- Create: `components/SessionStatus.tsx`
- Create: `app/api/sessions/check/route.ts`
- Create: `app/api/sessions/login/route.ts`

- [ ] **Step 1: 实现 Session 检查 API**

新建 `app/api/sessions/check/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { isSessionValid } from '@/lib/playwright/session'

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ valid: false })

  const valid = await isSessionValid(url)
  return NextResponse.json({ valid })
}
```

- [ ] **Step 2: 实现触发登录 API**

新建 `app/api/sessions/login/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { url } = await req.json()
  const origin = new URL(url).origin

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(url)

  // 等待用户完成登录（检测 URL 不再是登录页）
  await page.waitForURL(u => !u.includes('login') && !u.includes('signin'), {
    timeout: 5 * 60 * 1000, // 5分钟超时
  }).catch(() => {})

  const cookies = await context.cookies()
  await browser.close()

  await prisma.session.upsert({
    where: { siteUrl: origin },
    update: { cookies: JSON.stringify(cookies) },
    create: { siteUrl: origin, cookies: JSON.stringify(cookies) },
  })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: 实现 SessionStatus 组件**

新建 `components/SessionStatus.tsx`：

```typescript
'use client'
import { useEffect, useState } from 'react'

interface SessionStatusProps {
  url: string
}

export function SessionStatus({ url }: SessionStatusProps) {
  const [valid, setValid] = useState<boolean | null>(null)
  const [logging, setLogging] = useState(false)

  async function checkStatus() {
    const res = await fetch(`/api/sessions/check?url=${encodeURIComponent(url)}`)
    const { valid } = await res.json()
    setValid(valid)
  }

  async function handleLogin() {
    setLogging(true)
    await fetch('/api/sessions/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    await checkStatus()
    setLogging(false)
  }

  useEffect(() => { checkStatus() }, [url])

  if (valid === null) return null

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm mb-4 ${valid ? 'bg-green-900/20 text-green-400' : 'bg-yellow-900/20 text-yellow-400'}`}>
      <span className={`w-2 h-2 rounded-full ${valid ? 'bg-green-400' : 'bg-yellow-400'}`} />
      <span>{valid ? '已登录' : '未登录 / Session 已过期'}</span>
      {!valid && (
        <button
          onClick={handleLogin}
          disabled={logging}
          className="ml-auto bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-3 py-1 rounded text-xs"
        >
          {logging ? '等待登录...' : '点击登录'}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: 在流程执行页添加 SessionStatus**

修改 `app/flows/[id]/page.tsx`，在表单上方添加：

```typescript
import { SessionStatus } from '@/components/SessionStatus'

// 在 ManualForm/ExcelUpload 上方添加：
{flow && <SessionStatus url={flow.config.url} />}
```

- [ ] **Step 5: 提交**

```bash
git add components/SessionStatus.tsx app/api/sessions/
git commit -m "feat: add session management UI with login trigger"
```

---

## 自检结果

**Spec 覆盖：**
- ✅ 项目初始化（Task 1）
- ✅ 数据库 + 类型定义（Task 2）
- ✅ DataMapper 变量替换（Task 3）
- ✅ Excel 解析（Task 4）
- ✅ FlowRunner + SessionManager（Task 5）
- ✅ Flows CRUD API（Task 6）
- ✅ 任务队列 + SSE（Task 7）
- ✅ 流程库 UI（Task 8）
- ✅ 手动执行 + 历史（Task 9）
- ✅ Codegen 录制 + JSON 编辑器（Task 10）
- ✅ Excel 批量上传（Task 11）
- ✅ Session 管理 UI（Task 12）

**待确认事项（设计文档中）：**
- BullMQ → 已改用 p-queue（无需 Redis，适合本地部署）
- 录制示例值自动识别 → 已实现为：所有有 value 的 fill/select 动作均提示为字段
- 用户登录本身 → 初期不做，本地局域网部署直接访问
