'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TaskProgress } from '@/components/TaskProgress'

interface TaskDetail {
  id: string
  status: string
  flow: { name: string; url: string }
  createdAt: string
  completedAt?: string
  errorMessage?: string
}

export default function TaskPage({ params }: { params: { id: string } }) {
  const [task, setTask] = useState<TaskDetail | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetch(`/api/tasks/${params.id}`)
      .then(r => r.json())
      .then(setTask)
  }, [params.id])

  if (!task) return <div className="text-gray-400">加载中...</div>

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="text-gray-400 hover:text-white">←</button>
        <h1 className="text-2xl font-bold">任务执行进度</h1>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 mb-6 text-sm text-gray-400 space-y-1">
        <p>流程：<span className="text-white">{task.flow?.name ?? '—'}</span></p>
        <p>状态：<span className={
          task.status === 'success' ? 'text-green-400' :
          task.status === 'failed'  ? 'text-red-400' :
          task.status === 'running' ? 'text-yellow-400' : 'text-gray-400'
        }>{task.status}</span></p>
        <p>开始时间：{new Date(task.createdAt).toLocaleString('zh-CN')}</p>
        {task.completedAt && (
          <p>完成时间：{new Date(task.completedAt).toLocaleString('zh-CN')}</p>
        )}
      </div>

      {task.errorMessage && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 text-red-300 text-sm">
          {task.errorMessage}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">步骤日志</h2>
      <TaskProgress taskId={params.id} />
    </div>
  )
}
