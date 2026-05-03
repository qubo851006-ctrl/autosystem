'use client'
import Link from 'next/link'

interface FlowCardProps {
  id: string
  name: string
  url: string
  createdAt: string
  onDelete: (id: string) => void
}

export function FlowCard({ id, name, url, createdAt, onDelete }: FlowCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 hover:border-blue-500 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-white">{name}</h3>
        <button
          onClick={() => onDelete(id)}
          className="text-gray-500 hover:text-red-400 text-sm"
        >
          删除
        </button>
      </div>
      <p className="text-gray-400 text-sm mb-3 truncate">{url}</p>
      <p className="text-gray-600 text-xs mb-3">
        创建于 {new Date(createdAt).toLocaleDateString('zh-CN')}
      </p>
      <div className="flex gap-2">
        <Link
          href={`/flows/${id}`}
          className="flex-1 text-center bg-blue-600 hover:bg-blue-700 text-white text-sm py-1.5 rounded"
        >
          执行
        </Link>
        <Link
          href={`/flows/${id}/edit`}
          className="flex-1 text-center bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 rounded"
        >
          编辑
        </Link>
      </div>
    </div>
  )
}
