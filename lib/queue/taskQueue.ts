import PQueue from 'p-queue'
import { EventEmitter } from 'events'
import { TaskProgressEvent } from '@/types/flow'

const queue = new PQueue({ concurrency: 1 })
const emitter = new EventEmitter()
emitter.setMaxListeners(50)

export function subscribeToTask(taskId: string, cb: (event: TaskProgressEvent) => void) {
  emitter.on(`task:${taskId}`, cb)
  return () => emitter.off(`task:${taskId}`, cb)
}

export function emitTaskEvent(taskId: string, event: TaskProgressEvent) {
  emitter.emit(`task:${taskId}`, event)
}

export function enqueueTask(fn: () => Promise<void>) {
  return queue.add(fn)
}

export function getQueueSize() {
  return queue.size
}
