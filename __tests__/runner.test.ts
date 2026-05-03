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
