'use client'
import { useEffect, useState } from 'react'

interface SessionStatusProps {
  url: string
}

type Status = 'checking' | 'valid' | 'expired' | 'error'

export function SessionStatus({ url }: SessionStatusProps) {
  const [status, setStatus] = useState<Status>('checking')
  const [logging, setLogging] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    checkSession()
  }, [url])

  async function checkSession() {
    setStatus('checking')
    try {
      const res = await fetch(`/api/sessions/check?url=${encodeURIComponent(url)}`)
      const json = await res.json()
      setStatus(json.valid ? 'valid' : 'expired')
    } catch {
      setStatus('error')
    }
  }

  async function triggerLogin() {
    setLogging(true)
    setMessage('请在弹出的浏览器窗口中完成登录，完成后系统自动保存 Cookie')
    try {
      const res = await fetch('/api/sessions/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await res.json()
      if (json.ok) {
        setStatus('valid')
        setMessage('登录成功，Cookie 已保存')
      } else {
        setMessage(json.error ?? '登录失败')
      }
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setLogging(false)
    }
  }

  const badge =
    status === 'checking' ? '🔄 检测中...' :
    status === 'valid' ? '✅ 会话有效' :
    status === 'expired' ? '⚠️ 会话已过期' :
    '❌ 检测失败'

  const badgeColor =
    status === 'valid' ? 'text-green-400' :
    status === 'expired' ? 'text-yellow-400' :
    'text-gray-400'

  return (
    <div className="flex items-center gap-3">
      <span className={`text-sm ${badgeColor}`}>{badge}</span>
      {/* 始终提供登录入口：会话「有效」只代表存过 cookie，不保证未过期，
          所以即使显示有效也允许随时重新登录刷新 */}
      <button
        onClick={triggerLogin}
        disabled={logging}
        className={`text-xs disabled:opacity-50 text-white px-3 py-1 rounded ${
          status === 'valid' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-yellow-700 hover:bg-yellow-600'
        }`}
      >
        {logging ? '等待登录...' : status === 'valid' ? '刷新登录' : '重新登录'}
      </button>
      {message && <span className="text-xs text-gray-400">{message}</span>}
    </div>
  )
}
