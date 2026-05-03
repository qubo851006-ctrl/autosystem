import { describe, it, expect } from 'vitest'
import { parseExcelBuffer } from '../lib/excel/parser'
import * as XLSX from 'xlsx'

function makeExcelBuffer(rows: Record<string, string>[]): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer
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
