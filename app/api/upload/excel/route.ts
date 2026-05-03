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
