'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FlowCard } from '@/components/FlowCard'

interface FlowSummary {
  id: string
  name: string
  url: string
  createdAt: string
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<FlowSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFlows()
  }, [])

  async function fetchFlows() {
    try {
      const res = await fetch('/api/flows')
      const data = await res.json()
      setFlows(data)
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确认删除此流程？')) return
    await fetch(`/api/flows/${id}`, { method: 'DELETE' })
    setFlows((prev) => prev.filter((f) => f.id !== id))
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-white">流程库</h1>
        <Link
          href="/flows/new"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          + 录制新流程
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400">加载中...</p>
      ) : flows.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="mb-4">暂无流程</p>
          <Link
            href="/flows/new"
            className="text-blue-400 hover:text-blue-300"
          >
            点击录制第一个流程 →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map((flow) => (
            <FlowCard
              key={flow.id}
              id={flow.id}
              name={flow.name}
              url={flow.url}
              createdAt={flow.createdAt}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
