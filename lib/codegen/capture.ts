import { spawn, ChildProcess } from 'child_process'
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { RecordingResult } from '@/types/flow'
import { getSessionCookies, saveStorageStateCookies } from '../playwright/session'
import { cleanActionLines, extractCandidates } from './parseCodegen'

// Next.js 把每个 API 路由编译成独立模块包，普通模块级变量在 start/stop 间不共享。
// 挂到 globalThis 上确保两个路由读到同一份录制状态。
const g = globalThis as unknown as {
  __codegenState?: {
    proc: ChildProcess | null
    outFile: string
    storageFile: string
    url: string
  }
}

export async function startRecording(url: string): Promise<void> {
  // 结束上一个仍在运行的录制
  if (g.__codegenState?.proc && !g.__codegenState.proc.killed) {
    g.__codegenState.proc.kill('SIGINT')
  }

  const dir = mkdtempSync(join(tmpdir(), 'autosys-codegen-'))
  const outFile = join(dir, 'recording.js')
  const storageFile = join(dir, 'storage.json')

  // 用已保存的登录态生成 storageState 文件，让录制窗口免登录打开
  const cookies = await getSessionCookies(url)
  writeFileSync(storageFile, JSON.stringify({ cookies, origins: [] }))

  // 启动 Playwright 官方 codegen：加载登录态、录制结束保存登录态、导出 JS 脚本
  const proc = spawn(
    'npx',
    [
      'playwright',
      'codegen',
      '--load-storage',
      storageFile,
      '--save-storage',
      storageFile,
      '-o',
      outFile,
      '--target',
      'javascript',
      url,
    ],
    { cwd: process.cwd(), stdio: 'ignore', detached: false }
  )

  g.__codegenState = { proc, outFile, storageFile, url }

  // 等待进程真正起来（npx 解析 + 浏览器启动）
  await new Promise<void>((resolve, reject) => {
    let settled = false
    proc.on('error', (e) => {
      if (!settled) {
        settled = true
        reject(e)
      }
    })
    // 给 npx/浏览器一点启动时间；若没立刻报错就认为启动成功
    setTimeout(() => {
      if (!settled) {
        settled = true
        if (proc.exitCode !== null && proc.exitCode !== 0) {
          reject(new Error('录制器启动失败，请确认已安装 Playwright 浏览器'))
        } else {
          resolve()
        }
      }
    }, 1500)
  })
}

export async function stopRecording(flowName: string, url: string): Promise<RecordingResult> {
  const state = g.__codegenState
  if (!state) {
    throw new Error('没有进行中的录制')
  }

  // SIGINT 让 codegen 正常退出并 flush 输出文件 + 保存登录态
  if (state.proc && !state.proc.killed) {
    state.proc.kill('SIGINT')
  }

  // 等待进程退出并写完文件（最多等 8 秒）
  await waitForExit(state.proc, 8000)
  await waitForFile(state.outFile, 3000)

  let code = ''
  try {
    code = readFileSync(state.outFile, 'utf-8')
  } catch {
    throw new Error('未读取到录制结果，可能没有录制任何操作')
  }

  const actionLines = cleanActionLines(code)
  const candidates = extractCandidates(actionLines)

  // 把录制期间（含可能的重新登录）产生的最新登录态保存回库
  try {
    if (existsSync(state.storageFile)) {
      const storage = JSON.parse(readFileSync(state.storageFile, 'utf-8'))
      await saveStorageStateCookies(url, storage.cookies ?? [])
    }
  } catch {
    /* 保存登录态失败不影响录制结果 */
  }

  g.__codegenState = undefined

  return { name: flowName, url, actionLines, candidates }
}

function waitForExit(proc: ChildProcess | null, timeoutMs: number): Promise<void> {
  if (!proc || proc.exitCode !== null || proc.killed) return Promise.resolve()
  return new Promise((resolve) => {
    const t = setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
      resolve()
    }, timeoutMs)
    proc.on('exit', () => {
      clearTimeout(t)
      resolve()
    })
  })
}

function waitForFile(path: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = Date.now()
    const tick = () => {
      if (existsSync(path) || Date.now() - start > timeoutMs) return resolve()
      setTimeout(tick, 200)
    }
    tick()
  })
}
