import { BrowserContext, Page } from 'playwright'
import { FlowConfig, StepLog, TaskProgressEvent } from '@/types/flow'
import { mapStepValue } from './mapper'
import { normalizeScriptText, stripLoginLines } from '../codegen/parseCodegen'
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
    // 优先走 Playwright codegen 录制的脚本回放（能处理新标签页、Element UI 等）
    if (config.script && config.script.trim()) {
      await runScript(config, data, page, context, onProgress, logs)
    } else {
      await runSteps(config, data, page, onProgress, logs, (p) => (screenshotPath = p))
    }

    await saveSession(context, config.url)
    onProgress({ type: 'done', totalSteps: logs.length })
  } finally {
    await context.browser()?.close()
  }

  return { logs, screenshotPath }
}

/** 回放 codegen 录制脚本：替换 {{字段}} 为实际数据后，按动作逐条执行 */
async function runScript(
  config: FlowConfig,
  data: Record<string, string>,
  page: Page,
  context: BrowserContext,
  onProgress: ProgressEmitter,
  logs: StepLog[]
): Promise<void> {
  await page.goto(config.url, { waitUntil: 'networkidle' }).catch(() => {})
  assertNotLoginPage(page)

  // 0) 归一化动态 ID 定位器 + 剔除登录步骤（让旧流程回放也稳定）
  let script = normalizeScriptText(
    stripLoginLines((config.script as string).split('\n')).join('\n')
  )
  // 1) 用数据替换占位符
  for (const [k, v] of Object.entries(data)) {
    script = script.replaceAll(`{{${k}}}`, escapeForJsString(v ?? ''))
  }

  // 2) 拆成语句，给每个「动作」语句加上进度上报
  const rawLines = script.split('\n').map((l) => l.trim()).filter(Boolean)
  const body: string[] = []
  let idx = 0
  const descs: string[] = []
  for (const line of rawLines) {
    if (/^await\s+page\d*\./.test(line)) {
      const desc = describeLine(line)
      descs.push(desc)
      body.push(`await __step(${idx});`)
      idx++
    }
    body.push(line)
  }

  // 3) 进度回调：记录每个动作的成功/失败
  let current = -1
  const __step = (i: number) => {
    // 上一条若没抛错即视为成功
    if (current >= 0) {
      logs.push({
        stepIndex: current,
        description: descs[current],
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    }
    current = i
    onProgress({ type: 'step', stepIndex: i, description: descs[i], status: 'success' })
  }

  const fnBody = `return (async () => {\n${body.join('\n')}\n})()`
  try {
    // page / context / __step 注入脚本作用域；page1 等由脚本内部声明
    const runner = new Function('page', 'context', '__step', fnBody)
    await runner(page, context, __step)
    // 最后一条动作收尾
    if (current >= 0) {
      logs.push({
        stepIndex: current,
        description: descs[current],
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    const failedIdx = current >= 0 ? current : 0
    logs.push({
      stepIndex: failedIdx,
      description: descs[failedIdx] ?? '执行录制脚本',
      status: 'failed',
      error,
      timestamp: new Date().toISOString(),
    })
    onProgress({ type: 'error', stepIndex: failedIdx, description: descs[failedIdx], error })
    throw err
  }
}

/** 旧版/手写流程：按 steps 数组逐步执行 */
async function runSteps(
  config: FlowConfig,
  data: Record<string, string>,
  page: Page,
  onProgress: ProgressEmitter,
  logs: StepLog[],
  setScreenshot: (p: string) => void
): Promise<void> {
  await page.goto(config.url, { waitUntil: 'networkidle' })
  assertNotLoginPage(page)

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
          setScreenshot(path)
          break
        }
      }

      logs.push({
        stepIndex: i,
        description: desc,
        status: 'success',
        timestamp: new Date().toISOString(),
      })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      logs.push({
        stepIndex: i,
        description: desc,
        status: 'failed',
        error,
        timestamp: new Date().toISOString(),
      })
      onProgress({ type: 'error', stepIndex: i, description: desc, error })
      throw err
    }
  }
}

/** 打开目标页后若被重定向到登录页，说明登录态过期，立即给出清晰错误 */
function assertNotLoginPage(page: Page): void {
  if (/\/login|\/signin|\/sso\/|\/cas\/|\/oauth2?\/authorize/i.test(page.url())) {
    throw new Error('登录态已过期：打开页面被重定向到登录页。请到流程页点「重新登录」刷新后再执行。')
  }
}

function escapeForJsString(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
}

function describeLine(line: string): string {
  // 提取动作类型 + 关键标签，给进度日志一个可读描述
  const action = line.match(/\.(click|fill|selectOption|check|uncheck|press|goto)\(/)?.[1] ?? '操作'
  const name = line.match(/name:\s*(['"`])([\s\S]*?)\1/)?.[2]
  const text = line.match(/getByText\(\s*(['"`])([\s\S]*?)\1/)?.[2]
  const label = (name ?? text ?? '').replace(/^[*\s]+/, '').slice(0, 24)
  const cn: Record<string, string> = {
    click: '点击',
    fill: '填写',
    selectOption: '选择',
    check: '勾选',
    uncheck: '取消勾选',
    press: '按键',
    goto: '打开',
  }
  return label ? `${cn[action] ?? action} ${label}` : `${cn[action] ?? action}`
}
