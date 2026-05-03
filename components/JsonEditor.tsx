'use client'
import { useState } from 'react'
import { FlowConfig } from '@/types/flow'

interface JsonEditorProps {
  value: FlowConfig
  onChange: (config: FlowConfig) => void
}

export function JsonEditor({ value, onChange }: JsonEditorProps) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [error, setError] = useState<string | null>(null)

  function handleChange(raw: string) {
    setText(raw)
    try {
      const parsed = JSON.parse(raw) as FlowConfig
      setError(null)
      onChange(parsed)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(text)
      setText(JSON.stringify(parsed, null, 2))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-400">流程配置 JSON</span>
        <button
          onClick={handleFormat}
          className="text-xs text-blue-400 hover:text-blue-300"
        >
          格式化
        </button>
      </div>
      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        rows={20}
        spellCheck={false}
        className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-green-300 font-mono text-xs focus:outline-none focus:border-blue-500 resize-y"
      />
      {error && (
        <p className="text-red-400 text-xs">JSON 解析错误: {error}</p>
      )}
    </div>
  )
}
