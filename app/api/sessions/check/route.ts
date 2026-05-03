import { NextResponse } from 'next/server'
import { isSessionValid } from '@/lib/playwright/session'

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url')
  if (!url) return NextResponse.json({ valid: false })
  const valid = await isSessionValid(url)
  return NextResponse.json({ valid })
}
