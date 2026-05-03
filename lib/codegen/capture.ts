import { chromium, Browser } from 'playwright'
import { FlowConfig, Step } from '@/types/flow'

let activeBrowser: Browser | null = null
let capturedActions: Array<{ action: string; selector: string; value?: string }> = []

export async function startRecording(url: string): Promise<void> {
  if (activeBrowser) await activeBrowser.close()
  capturedActions = []

  activeBrowser = await chromium.launch({ headless: false })
  const context = await activeBrowser.newContext()
  const page = await context.newPage()

  await page.goto(url)

  await page.exposeFunction('__captureAction', (action: object) => {
    capturedActions.push(action as typeof capturedActions[0])
  })

  await page.addInitScript(() => {
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
}

export async function stopRecording(flowName: string, url: string): Promise<FlowConfig> {
  if (activeBrowser) {
    await activeBrowser.close()
    activeBrowser = null
  }

  const deduped = deduplicateActions(capturedActions)

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

function deduplicateActions(actions: typeof capturedActions) {
  const seen = new Map<string, (typeof capturedActions)[0]>()
  for (const a of actions) {
    if (a.action === 'fill' || a.action === 'select') {
      seen.set(a.selector, a)
    } else {
      seen.set(`${a.action}:${a.selector}:${Date.now()}`, a)
    }
  }
  return Array.from(seen.values())
}
