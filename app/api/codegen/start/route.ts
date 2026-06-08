import { NextResponse } from 'next/server'
import { startRecording } from '@/lib/codegen/capture'

export async function POST(req: Request) {
  const { url } = await req.json()
  if (!url) return NextResponse.json({ error: '缺少 url' }, { status: 400 })
  try {
    await startRecording(url)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
