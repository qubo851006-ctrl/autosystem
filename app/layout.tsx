import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: '自动化填写平台',
  description: '网页表单自动化工具',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="bg-gray-950 text-gray-100 min-h-screen">
        <nav className="border-b border-gray-800 px-6 py-3 flex gap-6 items-center">
          <span className="font-bold text-blue-400">AutoFill</span>
          <Link href="/flows" className="text-gray-400 hover:text-white text-sm">流程库</Link>
          <Link href="/history" className="text-gray-400 hover:text-white text-sm">历史记录</Link>
        </nav>
        <main className="p-6">{children}</main>
      </body>
    </html>
  )
}
