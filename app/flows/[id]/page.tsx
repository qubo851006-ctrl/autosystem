'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import * as XLSX from 'xlsx'
import { FlowConfig } from '@/types/flow'
import { ManualForm } from '@/components/ManualForm'
import { ExcelUpload } from '@/components/ExcelUpload'
import { TaskProgress } from '@/components/TaskProgress'
import { SessionStatus } from '@/components/SessionStatus'

type InputMode = 'manual' | 'excel'

export default function FlowDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [config, setConfig] = useState<FlowConfig | null>(null)
  const [mode, setMode] = useState<InputMode>('manual')
  const [taskId, setTaskId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [excelRows, setExcelRows] = useState<Record<string, string>[]>([])
  const [currentRow, setCurrentRow] = useState(0)
  const [taskIds, setTaskIds] = useState<string[]>([])

  useEffect(() => {
    fetch(`/api/flows/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.error) throw new Error(data.error)
        setConfig(data.config as FlowConfig)
      })
      .catch(() => setError('加载流程失败'))
  }, [id])

  async function runManual(data: Record<string, string>) {
    setError(null)
    setLoading(true)
    setTaskId(null)
    try {
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId: id, inputData: data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setTaskId(json.taskId)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function runExcelBatch() {
    if (excelRows.length === 0) { setError('请先上传 Excel 文件'); return }
    setError(null)
    setTaskIds([])
    setCurrentRow(0)
    setLoading(true)

    const ids: string[] = []
    for (let i = 0; i < excelRows.length; i++) {
      setCurrentRow(i + 1)
      const res = await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flowId: id, inputData: excelRows[i] }),
      })
      const json = await res.json()
      if (res.ok) ids.push(json.taskId)
    }
    setTaskIds(ids)
    setLoading(false)
  }

  function downloadTemplate() {
    if (!config) return
    // 表头必须是变量名（导入时按表头匹配 {{变量}}）。只放表头，每行数据由用户自己填。
    const headers = config.fields.map((f) => f.name)
    const ws = XLSX.utils.aoa_to_sheet([headers])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '数据')
    XLSX.writeFile(wb, `${config.name || '流程'}_导入模板.xlsx`)
  }

  if (!config) return (
    <div className="max-w-2xl mx-auto px-4 py-8 text-gray-400">
      {error ?? '加载中...'}
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">{config.name}</h1>
        <p className="text-gray-500 text-sm mt-1">{config.url}</p>
      </div>

      <SessionStatus url={config.url} />

      <div className="flex gap-2">
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 py-2 rounded text-sm ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          手动填写
        </button>
        <button
          onClick={() => setMode('excel')}
          className={`flex-1 py-2 rounded text-sm ${mode === 'excel' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          批量导入
        </button>
      </div>

      {mode === 'manual' ? (
        <ManualForm fields={config.fields} onSubmit={runManual} loading={loading} />
      ) : (
        <div className="space-y-4">
          {config.fields.length > 0 ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-300">
                  导入模板共 {config.fields.length} 列（列名须与变量名一致）
                </span>
                <button
                  onClick={downloadTemplate}
                  className="shrink-0 text-xs bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded"
                >
                  ⬇ 下载导入模板
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {config.fields.map((f) => (
                  <span key={f.name} className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
                    {f.name}
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-yellow-400/80 text-sm">
              该流程没有可填变量，批量导入无意义（每行都会执行完全相同的操作）。
            </p>
          )}
          <ExcelUpload onUpload={setExcelRows} />
          {excelRows.length > 0 && (
            <p className="text-gray-400 text-sm">已载入 {excelRows.length} 行数据</p>
          )}
          {loading && (
            <p className="text-blue-400 text-sm animate-pulse">
              执行第 {currentRow} / {excelRows.length} 行...
            </p>
          )}
          <button
            onClick={runExcelBatch}
            disabled={loading || excelRows.length === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded-lg"
          >
            {loading ? '执行中...' : `批量执行 (${excelRows.length} 行)`}
          </button>
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {taskId && (
        <div>
          <h2 className="text-white font-semibold mb-2">执行进度</h2>
          <TaskProgress taskId={taskId} />
        </div>
      )}

      {taskIds.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-white font-semibold">批量任务</h2>
          {taskIds.map((tid, i) => (
            <div key={tid}>
              <p className="text-gray-400 text-xs mb-1">第 {i + 1} 行</p>
              <TaskProgress taskId={tid} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
