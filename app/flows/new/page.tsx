'use client'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FlowConfig, RecordingResult } from '@/types/flow'
import { applyParameterization, detectFragileLines } from '@/lib/codegen/parseCodegen'

type Step = 'input' | 'recording' | 'review'
type ParamState = Record<number, { checked: boolean; name: string }>

function sanitizeName(s: string): string {
  return s.replace(/\s+/g, '').replace(/['"`]/g, '').slice(0, 30)
}

export default function NewFlowPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('input')
  const [url, setUrl] = useState('')
  const [name, setName] = useState('')
  const [result, setResult] = useState<RecordingResult | null>(null)
  const [params, setParams] = useState<ParamState>({})
  const [showScript, setShowScript] = useState(false)
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
      if (!res.ok) {
        const text = await res.text()
        let msg = '启动录制失败'
        try { msg = JSON.parse(text).error ?? msg } catch { /* body 非 JSON */ }
        throw new Error(msg)
      }
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
      if (!res.ok) {
        const text = await res.text()
        let msg = '停止录制失败'
        try { msg = JSON.parse(text).error ?? msg } catch { /* body 非 JSON */ }
        throw new Error(msg)
      }
      const rec: RecordingResult = await res.json()
      setResult(rec)
      // 初始化参数勾选：按 suggested 预勾选，变量名默认取标签（去重）
      const init: ParamState = {}
      const used = new Set<string>()
      for (const c of rec.candidates) {
        let base = sanitizeName(c.label) || `字段${c.id}`
        let nm = base, k = 2
        while (used.has(nm)) { nm = `${base}_${k++}` }
        used.add(nm)
        init[c.id] = { checked: c.suggested, name: nm }
      }
      setParams(init)
      setStep('review')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  // 根据勾选实时生成最终配置
  const config: FlowConfig = useMemo(() => {
    if (!result) return { name: name || '新流程', url, fields: [], steps: [] }
    const selected = result.candidates
      .filter((c) => params[c.id]?.checked)
      .map((c) => ({ id: c.id, name: (params[c.id]?.name || '').trim() || `字段${c.id}` }))
    const { script, fields } = applyParameterization(result.actionLines, selected)
    return { name: name || '新流程', url, fields, steps: [], script }
  }, [result, params, name, url])

  async function saveFlow() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/flows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: config.name, url: config.url, config }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      router.push('/flows')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const fragile = useMemo(
    () => (result ? detectFragileLines(result.actionLines) : []),
    [result]
  )

  const toggle = (id: number) =>
    setParams((p) => ({ ...p, [id]: { ...p[id], checked: !p[id]?.checked } }))
  const rename = (id: number, v: string) =>
    setParams((p) => ({ ...p, [id]: { ...p[id], name: v } }))

  const kindLabel: Record<string, string> = { fill: '填写', select: '选择', click: '选择' }

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
              {s === 'input' ? '输入 URL' : s === 'recording' ? '录制操作' : '确认参数'}
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
            需要变量的字段请填入<span className="text-white">示例值</span>，完成后点击下方按钮停止录制。
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

      {step === 'review' && result && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">流程名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="新流程"
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <p className="text-gray-400 text-sm">
            录制完成，共 <span className="text-white font-semibold">{result.actionLines.length}</span> 个动作。
            下面是录到的每个可变值，<span className="text-white">勾选要做成变量的项并起个名</span>；
            未勾选的将保持录制时的固定值。
          </p>

          {fragile.length > 0 && (
            <div className="border border-yellow-700/60 bg-yellow-900/20 rounded-lg p-3 space-y-1">
              <p className="text-yellow-300 text-sm font-medium">
                ⚠️ 有 {fragile.length} 个步骤使用了「动态生成的 ID」，回放时可能选不中
              </p>
              <p className="text-yellow-200/70 text-xs">
                树形/弹窗多选（如项目成本归属）录出来的复选框 ID 每次都会变，不稳定。
                这类字段建议保存后在「编辑流程」里手动把选择器改成按名称定位，或单独处理。
              </p>
              <ul className="text-xs text-yellow-200/60 font-mono mt-1 space-y-0.5">
                {fragile.map((f) => (
                  <li key={f.id} className="truncate">· {f.snippet}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="border border-gray-700 rounded-lg divide-y divide-gray-800">
            {result.candidates.length === 0 && (
              <p className="text-gray-500 text-sm p-4">没有识别到可变值（可能只录了点击操作）。</p>
            )}
            {result.candidates.map((c) => {
              const st = params[c.id] ?? { checked: false, name: '' }
              return (
                <div key={c.id} className="flex items-center gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={st.checked}
                    onChange={() => toggle(c.id)}
                    className="w-4 h-4 accent-blue-500"
                  />
                  <span className={`text-xs px-1.5 py-0.5 rounded ${
                    c.kind === 'fill' ? 'bg-blue-900 text-blue-300' : 'bg-purple-900 text-purple-300'
                  }`}>{kindLabel[c.kind]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-300 truncate">
                      {c.label || '(未命名)'}
                      <span className="text-gray-500"> ＝ </span>
                      <span className="text-gray-400">{c.value}</span>
                    </div>
                  </div>
                  {st.checked && (
                    <input
                      type="text"
                      value={st.name}
                      onChange={(e) => rename(c.id, e.target.value)}
                      placeholder="变量名"
                      className="w-36 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  )}
                </div>
              )
            })}
          </div>

          <p className="text-xs text-gray-500">
            将生成 <span className="text-gray-300">{config.fields.length}</span> 个可填变量。
            <button
              onClick={() => setShowScript((v) => !v)}
              className="ml-2 text-blue-400 hover:underline"
            >
              {showScript ? '隐藏' : '查看'}生成的脚本
            </button>
          </p>
          {showScript && (
            <pre className="bg-gray-900 border border-gray-800 rounded p-3 text-xs text-gray-400 overflow-auto max-h-64 whitespace-pre-wrap">
              {config.script}
            </pre>
          )}

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
