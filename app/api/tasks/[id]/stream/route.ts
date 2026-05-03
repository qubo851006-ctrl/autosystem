import { subscribeToTask } from '@/lib/queue/taskQueue'
import { TaskProgressEvent } from '@/types/flow'

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: TaskProgressEvent) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        if (event.type === 'done' || event.type === 'error') {
          controller.close()
        }
      }
      unsubscribe = subscribeToTask(params.id, send)
    },
    cancel() {
      unsubscribe?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
