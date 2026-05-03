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
