import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const tasks = await prisma.task.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { flow: { select: { name: true } } },
  })
  return NextResponse.json(tasks)
}
