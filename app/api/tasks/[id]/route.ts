import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const task = await prisma.task.findUnique({ where: { id: params.id } })
  if (!task) return NextResponse.json({ error: '任务不存在' }, { status: 404 })
  return NextResponse.json({
    ...task,
    inputData: JSON.parse(task.inputData),
    logs: JSON.parse(task.logs),
  })
}
