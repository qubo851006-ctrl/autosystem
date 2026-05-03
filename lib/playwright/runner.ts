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

    await saveSession(context, config.url)
    onProgress({ type: 'done', totalSteps: config.steps.length })
  } finally {
    await context.browser()?.close()
  }

  return { logs, screenshotPath }
}
