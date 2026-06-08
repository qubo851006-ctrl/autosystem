import { chromium, Browser, BrowserContext } from 'playwright'
import { FlowConfig, Step } from '@/types/flow'
import { getSessionCookies, saveSession } from '../playwright/session'

type CapturedAction = { action: string; selector: string; value?: string }

// Next.js 会把每个 API 路由编译成独立模块包，普通模块级变量在 start/stop
// 两个路由间不共享。挂到 globalThis 上确保是同一份录制状态。
const g = globalThis as unknown as {
  __recState?: {
    activeBrowser: Browser | null
    activeContext: BrowserContext | null
    capturedActions: CapturedAction[]
  }
}
const state = (g.__recState ??= {
  activeBrowser: null,
  activeContext: null,
  capturedActions: [],
})

export async function startRecording(url: string): Promise<void> {
  if (state.activeBrowser) await state.activeBrowser.close()
  state.capturedActions = []

  state.activeBrowser = await chromium.launch({ headless: false })
  const context = await state.activeBrowser.newContext({ ignoreHTTPSErrors: true })
  state.activeContext = context

  // 注入已保存的登录态（若该站点之前登录过），这样录制时无需重新登录
  const cookies = await getSessionCookies(url)
  if (cookies.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await context.addCookies(cookies as any).catch(() => {})
  }

  // 在 context 层注册，保证对所有页面/导航（含 goto 后的新页面）都生效
  await context.exposeFunction('__captureAction', (action: object) => {
    state.capturedActions.push(action as CapturedAction)
  })

  await context.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const el = e.target as HTMLElement
      const selector = el.id ? `#${el.id}` : el.tagName.toLowerCase()
      ;(window as typeof window & { __captureAction: (a: object) => void }).__captureAction({
        action: 'click', selector, value: undefined,
      })
    }, true)

    document.addEventListener('change', (e) => {
      const el = e.target as HTMLInputElement
      const selector = el.id
        ? `#${el.id}`
        : el.name
        ? `[name="${el.name}"]`
        : el.tagName.toLowerCase()
      ;(window as typeof window & { __captureAction: (a: object) => void }).__captureAction({
        action: el.tagName === 'SELECT' ? 'select' : 'fill',
        selector,
        value: el.value,
      })
    }, true)
  })

  const page = await context.newPage()
  await page.goto(url)
}

export async function stopRecording(flowName: string, url: string): Promise<FlowConfig> {
  // 关闭浏览器前先把当前登录态（cookie）存库，供后续录制/执行复用
  if (state.activeContext) {
    await saveSession(state.activeContext, url).catch(() => {})
    state.activeContext = null
  }
  if (state.activeBrowser) {
    await state.activeBrowser.close()
    state.activeBrowser = null
  }

  const deduped = deduplicateActions(state.capturedActions)

  const steps: Step[] = deduped.map((a, i) => ({
    action: a.action as Step['action'],
    selector: a.selector,
    value: a.value !== undefined ? `{{field_${i}}}` : undefined,
    description: `${a.action} ${a.selector}`,
  }))

  const fields = deduped
    .filter((a) => a.value !== undefined)
    .map((a, i) => ({
      name: `field_${i}`,
      label: a.selector.replace(/[#\[\]="']/g, '').slice(0, 20) || `字段${i + 1}`,
      type: 'text' as const,
    }))

  return { name: flowName, url, fields, steps }
}

function deduplicateActions(actions: CapturedAction[]) {
  const seen = new Map<string, CapturedAction>()
  for (const a of actions) {
    if (a.action === 'fill' || a.action === 'select') {
      seen.set(a.selector, a)
    } else {
      seen.set(`${a.action}:${a.selector}:${Date.now()}`, a)
    }
  }
  return Array.from(seen.values())
}
