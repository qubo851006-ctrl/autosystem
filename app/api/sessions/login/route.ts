import { NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { url } = await req.json()
  const origin = new URL(url).origin

  const browser = await chromium.launch({ headless: false })
  const context = await browser.newContext()
  const page = await context.newPage()

  await page.goto(url)

  // 等待用户完成登录（URL 不再包含 login/signin）
  await page.waitForURL(
    (u) => !u.href.includes('login') && !u.href.includes('signin'),
    { timeout: 5 * 60 * 1000 }
  ).catch(() => {})

  const cookies = await context.cookies()
  await browser.close()

  await prisma.session.upsert({
    where: { siteUrl: origin },
    update: { cookies: JSON.stringify(cookies) },
    create: { siteUrl: origin, cookies: JSON.stringify(cookies) },
  })

  return NextResponse.json({ ok: true })
}
