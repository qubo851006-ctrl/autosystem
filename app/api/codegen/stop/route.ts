import { NextResponse } from 'next/server'
import { stopRecording } from '@/lib/codegen/capture'

export async function POST(req: Request) {
  const { name, url } = await req.json()
  const config = await stopRecording(name ?? '新流程', url)
  return NextResponse.json(config)
}
