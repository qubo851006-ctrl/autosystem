'use client'
import { useRef, useState } from 'react'

interface ExcelUploadProps {
  onUpload: (rows: Record<string, string>[]) => void
}

export function ExcelUpload({ onUpload }: ExcelUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function uploadFile(file: File) {
    if (!file.name.match(/\.(xlsx|csv)$/i)) {
      setError('仅支持 .xlsx 或 .csv 文件')
      return
    }
    setError(null)
    setLoading(true)
    setFileName(file.name)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/upload/excel', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '上传失败')
      onUpload(json.rows as Record<string, string>[])
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    uploadFile(files[0])
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragging ? 'border-blue-500 bg-blue-900/10' : 'border-gray-600'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.csv"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {loading ? (
        <p className="text-gray-400 animate-pulse">解析中...</p>
      ) : fileName ? (
        <p className="text-green-400 text-sm">✅ {fileName}</p>
      ) : (
        <>
          <p className="text-gray-400 mb-2">拖拽 Excel / CSV 文件到此处</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            或点击选择文件
          </button>
        </>
      )}
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
