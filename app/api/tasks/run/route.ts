import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { FlowConfig } from '@/types/flow'
import { runFlow } from '@/lib/playwright/runner'
import { enqueueTask, emitTaskEvent } from '@/lib/queue/taskQueue'

export async function POST(req: Request) {
  const body: { flowId: string; inputData: Record<string, string> } = await req.json()

  const flow = await prisma.flow.findUnique({ where: { id: body.flowId } })
  if (!flow) return NextResponse.json({ error: '流程不存在' }, { status: 404 })

  const task = await prisma.task.create({
    data: {
      flowId: flow.id,
      status: 'pending',
      inputData: JSON.stringify(body.inputData),
    },
  })

  const config = JSON.parse(flow.config) as FlowConfig

  enqueueTask(async () => {
    await prisma.task.update({ where: { id: task.id }, data: { status: 'running' } })

    try {
      const { logs, screenshotPath } = await runFlow(config, body.inputData, (event) => {
        emitTaskEvent(task.id, event)
      })

      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'success',
          logs: JSON.stringify(logs),
          screenshotPath,
          completedAt: new Date(),
        },
      })
    } catch (err) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          status: 'failed',
          errorMessage: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        },
      })
    }
  })

  return NextResponse.json({ taskId: task.id }, { status: 202 })
}
