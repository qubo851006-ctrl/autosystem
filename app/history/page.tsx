'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface TaskRecord {
  id: string
  flowId: string
  flow: { name: string }
  status: 'pending' | 'running' | 'success' | 'failed'
  createdAt: string
  completedAt: string | null
  errorMessage: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending: '等待中',
  running: '执行中',
  success: '成功',
  failed: '失败',
}

const STATUS_COLOR: Record<string, string> = {
  pending: 'text-gray-400',
  running: 'text-blue-400 animate-pulse',
  success: 'text-green-400',
  failed: 'text-red-400',
}

export default function HistoryPage() {
  const [tasks, setTasks] = useState<TaskRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then(setTasks)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">历史记录</h1>

      {loading ? (
        <p className="text-gray-400">加载中...</p>
      ) : tasks.length === 0 ? (
        <p className="text-gray-500">暂无执行记录</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2 pr-4">流程</th>
                <th className="text-left py-2 pr-4">状态</th>
                <th className="text-left py-2 pr-4">创建时间</th>
                <th className="text-left py-2 pr-4">完成时间</th>
                <th className="text-left py-2">错误</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-gray-800 hover:bg-gray-800/30">
                  <td className="py-3 pr-4">
                    <Link
                      href={`/flows/${task.flowId}`}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      {task.flow.name}
                    </Link>
                  </td>
                  <td className={`py-3 pr-4 font-medium ${STATUS_COLOR[task.status]}`}>
                    {STATUS_LABEL[task.status]}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">
                    {new Date(task.createdAt).toLocaleString('zh-CN')}
                  </td>
                  <td className="py-3 pr-4 text-gray-400">
                    {task.completedAt
                      ? new Date(task.completedAt).toLocaleString('zh-CN')
                      : '—'}
                  </td>
                  <td className="py-3 text-red-400 text-xs max-w-xs truncate">
                    {task.errorMessage ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
