import { BrowserContext, chromium } from 'playwright'
import { prisma } from '../prisma'

export async function loadSession(url: string): Promise<BrowserContext> {
  const origin = new URL(url).origin
  const saved = await prisma.session.findUnique({ where: { siteUrl: origin } })

  const browser = await chromium.launch({ headless: false })

  if (saved) {
    const cookies = JSON.parse(saved.cookies)
    const context = await browser.newContext()
    await context.addCookies(cookies)
    return context
  }

  return browser.newContext()
}

export async function saveSession(context: BrowserContext, url: string): Promise<void> {
  const origin = new URL(url).origin
  const cookies = await context.cookies()

  await prisma.session.upsert({
    where: { siteUrl: origin },
    update: { cookies: JSON.stringify(cookies) },
    create: { siteUrl: origin, cookies: JSON.stringify(cookies) },
  })
}

export async function isSessionValid(url: string): Promise<boolean> {
  const origin = new URL(url).origin
  const saved = await prisma.session.findUnique({ where: { siteUrl: origin } })
  return !!saved && saved.cookies !== '[]'
}
