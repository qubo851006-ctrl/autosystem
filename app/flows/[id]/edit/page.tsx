'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { FlowConfig } from '@/types/flow'
import { JsonEditor } from '@/components/JsonEditor'

export default function EditFlowPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [name, setName] = useState('')
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setName(data.name)
        setConfig(JSON.parse(data.config) as FlowConfig)
      })
      .catch(() => setError('加载流程失败'))
  }, [id])

  async function handleSave() {
    if (!config) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/flows/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.push('/flows')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  if (!config) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-gray-400">
      {error ?? '加载中...'}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
      <h1 className="text-2xl font-bold text-white">编辑流程</h1>

      <div>
        <label className="block text-sm text-gray-400 mb-1">流程名称</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
        />
      </div>

      <JsonEditor value={config} onChange={setConfig} />

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={() => router.back()}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
        >
          {loading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
