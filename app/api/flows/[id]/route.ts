import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const flow = await prisma.flow.findUnique({ where: { id: params.id } })
  if (!flow) return NextResponse.json({ error: '流程不存在' }, { status: 404 })
  return NextResponse.json({ ...flow, config: JSON.parse(flow.config) as FlowConfig })
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body: { name?: string; config?: FlowConfig } = await req.json()
  const flow = await prisma.flow.update({
    where: { id: params.id },
    data: {
      ...(body.name && { name: body.name }),
      ...(body.config && { config: JSON.stringify(body.config) }),
    },
  })
  return NextResponse.json(flow)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  await prisma.flow.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
