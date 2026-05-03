'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowConfig } from '@/types/flow'
import { JsonEditor } from '@/components/JsonEditor'

type Step = 'input' | 'recording' | 'review'

const EMPTY_CONFIG: FlowConfig = {
  name: '',
  url: '',
  fields: [],
  steps: [],
}

export default function NewFlowPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [config, setConfig] = useState<FlowConfig>(EMPTY_CONFIG)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startRecording() {
    if (!url) { setError('请输入目标 URL'); return }
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/codegen/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setStep('recording')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function stopRecording() {
    setLoading(true)
    try {
      const res = await fetch('/api/codegen/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || '新流程', url }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const cfg: FlowConfig = await res.json()
      setConfig(cfg)
      setName(cfg.name)
      setStep('review')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function saveFlow() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: config.name || name || '新流程', url: config.url || url, config }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.push('/flows')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">录制新流程</h1>

      <div className="flex gap-2 mb-8">
        {(['input', 'recording', 'review'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
              step === s ? 'bg-blue-600 text-white' :
              ['input', 'recording', 'review'].indexOf(step) > i ? 'bg-green-700 text-white' :
              'bg-gray-700 text-gray-400'
            }`}>{i + 1}</div>
            <span className={`text-sm ${step === s ? 'text-white' : 'text-gray-500'}`}>
              {s === 'input' ? '输入 URL' : s === 'recording' ? '录制操作' : '确认保存'}
            </span>
            {i < 2 && <span className="text-gray-600 mx-1">→</span>}
          </div>
        ))}
      </div>

      {step === 'input' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">流程名称（可选）</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="留空则自动命名"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">目标 URL <span className="text-red-400">*</span></label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/login"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={startRecording}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
          >
            {loading ? '启动中...' : '开始录制'}
          </button>
        </div>
      )}

      {step === 'recording' && (
        <div className="text-center py-12 space-y-6">
          <div className="w-16 h-16 bg-red-900/30 border-2 border-red-500 rounded-full flex items-center justify-center mx-auto animate-pulse">
            <span className="text-red-400 text-2xl">●</span>
          </div>
          <p className="text-white text-lg">正在录制...</p>
          <p className="text-gray-400 text-sm">
            浏览器已打开，请在其中完成操作。<br />
            完成后点击下方按钮停止录制。
          </p>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={stopRecording}
            disabled={loading}
            className="bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white px-6 py-2 rounded-lg"
          >
            {loading ? '处理中...' : '停止录制'}
          </button>
        </div>
      )}

      {step === 'review' && (
        <div className="space-y-4">
          <p className="text-gray-400 text-sm">
            录制完成，共捕获 <span className="text-white font-semibold">{config.steps.length}</span> 个步骤，
            识别 <span className="text-white font-semibold">{config.fields.length}</span> 个字段。
            你可以在下方编辑 JSON 后再保存。
          </p>
          <JsonEditor value={config} onChange={setConfig} />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-3">
            <button
              onClick={() => setStep('input')}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg"
            >
              重新录制
            </button>
            <button
              onClick={saveFlow}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
            >
              {loading ? '保存中...' : '保存流程'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
