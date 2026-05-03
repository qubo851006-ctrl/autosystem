import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'

export async function GET() {
  const flows = await prisma.flow.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, url: true, createdAt: true },
  })
  return NextResponse.json(flows)
}

export async function POST(req: Request) {
  const body: { name: string; url: string; config: FlowConfig } = await req.json()

  if (!body.name || !body.url || !body.config) {
    return NextResponse.json({ error: '缺少必填字段' }, { status: 400 })
  }

  const flow = await prisma.flow.create({
    data: {
      name: body.name,
      url: body.url,
      config: JSON.stringify(body.config),
    },
  })

  return NextResponse.json(flow, { status: 201 })
}
