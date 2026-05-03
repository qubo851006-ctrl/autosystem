'use client'
import { useEffect, useState } from 'react'
import { TaskProgressEvent } from '@/types/flow'

interface TaskProgressProps {
  taskId: string
}

export function TaskProgress({ taskId }: TaskProgressProps) {
  const [events, setEvents] = useState<TaskProgressEvent[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const es = new EventSource(`/api/tasks/${taskId}/stream`)

    es.onmessage = (e) => {
      const event: TaskProgressEvent = JSON.parse(e.data)
      setEvents((prev) => [...prev, event])
      if (event.type === 'done' || event.type === 'error') {
        setDone(true)
        es.close()
      }
    }

    es.onerror = () => {
      setDone(true)
      es.close()
    }

    return () => es.close()
  }, [taskId])

  return (
    <div className="space-y-2">
      {events.map((event, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${
            event.type === 'error'
              ? 'bg-red-900/30 text-red-300'
              : event.type === 'done'
              ? 'bg-green-900/30 text-green-300'
              : event.status === 'failed'
              ? 'bg-red-900/20 text-red-400'
              : 'bg-gray-800 text-gray-300'
          }`}
        >
          <span>
            {event.type === 'done' ? '✅' : event.type === 'error' ? '❌' : '▸'}
          </span>
          <span>{event.description ?? event.type}</span>
          {event.error && (
            <span className="text-red-400 text-xs ml-auto">{event.error}</span>
          )}
        </div>
      ))}
      {!done && events.length > 0 && (
        <div className="text-gray-500 text-sm animate-pulse">执行中...</div>
      )}
    </div>
  )
}
