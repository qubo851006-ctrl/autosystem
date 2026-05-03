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
