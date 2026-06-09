import { FieldDef, ParamCandidate } from '@/types/flow'

// 按钮/确认类文字，默认不作为变量
const BUTTON_WORDS = [
  '确定', '确认', '取消', '保存', '提交', '关闭', '新增', '添加', '删除',
  '编辑', '返回', '上一步', '下一步', '重置', '查询', '搜索', '是', '否',
]

// 私有区图标字符（Element UI 用 - 区域放图标），清洗标签时去掉
const ICON_CHARS = /[\ue000-\uf8ff]/g

// \u767b\u5f55\u9875\u7279\u5f81\uff1a\u8fd9\u4e9b\u52a8\u4f5c\u4e0d\u5e94\u662f\u4e1a\u52a1\u6d41\u7a0b\u7684\u4e00\u90e8\u5206\uff08\u767b\u5f55\u6001\u7531 cookie \u5355\u72ec\u5904\u7406\uff09
const LOGIN_HINTS = /\u8bf7\u8f93\u5165\u8d26\u53f7|\u8bf7\u8f93\u5165\u5bc6\u7801|\u8bf7\u8f93\u5165\u7528\u6237\u540d|\u8bf7\u8f93\u5165\u9a8c\u8bc1\u7801|\u8d26\u53f7\u767b\u5f55|\u626b\u7801\u767b\u5f55|\u8bb0\u4f4f\u5bc6\u7801|\u5fd8\u8bb0\u5bc6\u7801|\u767b\s*\u5f55|sign\s*in|log\s*in|password|username/i

/** \u5254\u9664\u767b\u5f55\u76f8\u5173\u52a8\u4f5c\u884c\uff08\u8d26\u53f7/\u5bc6\u7801/\u9a8c\u8bc1\u7801/\u767b\u5f55\u6309\u94ae\uff09\uff0c\u907f\u514d\u88ab\u5f55\u8fdb\u4e1a\u52a1\u6d41\u7a0b\u5bfc\u81f4\u56de\u653e\u5931\u8d25 */
export function stripLoginLines(lines: string[]): string[] {
  return lines.filter((l) => !LOGIN_HINTS.test(l))
}

/**
 * 归一化一行里的「动态 ID」定位器，提升回放稳定性：
 * - 弹窗 iframe `#iframe_popup_openWin_<n>`（n 每开一次弹窗递增）
 *   → 前缀匹配并取最后一个（当前活动弹窗）
 */
export function normalizeLine(line: string): string {
  let out = line.replace(
    /\.locator\(\s*(['"`])#iframe_popup_openWin_\d+\1\s*\)/g,
    `.locator('iframe[id^="iframe_popup_openWin_"]:visible').last()`
  )
  // Element UI 下拉选项的文字常出现多次（触发框 + 弹出面板），codegen 用 nth(N) 定位
  // 在表单状态变化后易碎。下拉面板挂在 DOM 末尾，改用 last() 命中真正的选项。
  if (/getByText\(/.test(out) && /\.nth\(\s*\d+\s*\)/.test(out)) {
    out = out.replace(/\.nth\(\s*\d+\s*\)/g, '.last()')
  }
  return out
}

/** 对整段脚本逐行归一化（供回放已存流程时使用） */
export function normalizeScriptText(script: string): string {
  return script
    .split('\n')
    .map((l) => normalizeLine(l))
    .join('\n')
}

/** 从 codegen JS 输出抽出动作行（去掉 require/launch/goto/收尾） */
export function cleanActionLines(code: string): string[] {
  const lines = code.split('\n').map((l) => l.trim())
  const start = lines.findIndex((l) => /await\s+page\.goto\(/.test(l))
  let end = lines.findIndex((l) => l.startsWith('// ---') || /await\s+context\.close\(/.test(l))
  if (end === -1) end = lines.length

  const out: string[] = []
  for (let i = start === -1 ? 0 : start + 1; i < end; i++) {
    const l = lines[i]
    if (!l) continue
    if (/await\s+page\.goto\(/.test(l)) continue
    out.push(normalizeLine(l))
  }
  // 去掉登录相关动作（登录由 cookie 复用处理，不应进业务流程）
  return stripLoginLines(out)
}

/** 判断某行是否「打开下拉/弹窗」（其后的选择动作多半是要变的值） */
function opensSelector(line: string): boolean {
  return (
    /getByPlaceholder\(/.test(line) ||
    /el-select/.test(line) ||
    /el-input__inner/.test(line) ||
    /el-input__icon/.test(line) ||
    /hc-look-popup/.test(line) ||
    /mp-icon-add/.test(line) ||
    /请选择/.test(line)
  )
}

function cleanLabel(s: string): string {
  return s.replace(ICON_CHARS, '').replace(/^[*\s]+/, '').replace(/\s+$/, '').trim()
}

/** 从一行里猜字段标签：优先 row 的 name，其次 placeholder/label/text */
function guessLabel(line: string): string {
  const row = line.match(/getByRole\(\s*['"`]row['"`]\s*,\s*\{\s*name:\s*(['"`])([\s\S]*?)\1/)
  if (row) {
    // 去掉行里可能带的金额等噪声，取前段中文
    const lbl = cleanLabel(row[2]).split(/\s/)[0]
    if (lbl) return lbl.slice(0, 20)
  }
  const named = line.match(/name:\s*(['"`])([\s\S]*?)\1/)
  if (named) {
    const lbl = cleanLabel(named[2])
    if (lbl) return lbl.slice(0, 20)
  }
  const ph = line.match(/getBy(?:Placeholder|Label|Text)\(\s*(['"`])([\s\S]*?)\1/)
  if (ph) {
    const lbl = cleanLabel(ph[2])
    if (lbl) return lbl.slice(0, 20)
  }
  return ''
}

/** 取一行里「填写值」的字面量（fill/type/selectOption） */
function fillLiteral(line: string): { value: string; kind: 'fill' | 'select' } | null {
  const m = line.match(/\.(fill|type|selectOption)\(\s*(['"`])([\s\S]*?)\2\s*\)/)
  if (!m || m[3] === '') return null
  return { value: m[3], kind: m[1] === 'selectOption' ? 'select' : 'fill' }
}

/** 取一行里「选择点击」的目标文本（getByText / cell name），且该行是 .click() */
function clickLiteral(line: string): string | null {
  if (!/\.click\(\s*\)\s*;?\s*$/.test(line)) return null
  const t = line.match(/getByText\(\s*(['"`])([\s\S]*?)\1/)
  if (t) return t[2]
  const c = line.match(/getByRole\(\s*['"`]cell['"`]\s*,\s*\{\s*name:\s*(['"`])([\s\S]*?)\1/)
  if (c) return c[2]
  return null
}

/** 抽取所有可参数化候选值，并给出智能预勾选建议 */
export function extractCandidates(lines: string[]): ParamCandidate[] {
  const out: ParamCandidate[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 1) 填写类
    const f = fillLiteral(line)
    if (f) {
      const label = guessLabel(line) || f.value.slice(0, 20)
      out.push({ id: i, value: f.value, kind: f.kind, label, suggested: true })
      continue
    }

    // 2) 选择点击类
    const c = clickLiteral(line)
    if (c) {
      const cleaned = cleanLabel(c)
      const isButton = BUTTON_WORDS.includes(cleaned)
      const inPopup = /contentFrame\(/.test(line)
      const prevOpens = i > 0 && opensSelector(lines[i - 1])
      const suggested = !isButton && (inPopup || prevOpens)
      // 选择项的标签优先用「打开下拉那行」的 row 名
      const label =
        (prevOpens ? guessLabel(lines[i - 1]) : '') || guessLabel(line) || cleaned
      out.push({ id: i, value: c, kind: 'click', label, suggested })
    }
  }
  return out
}

/**
 * 检测「脆弱步骤」：用了动态生成 ID 的定位器（如 mini-12$checkbox$3），
 * 这类 ID 每次加载都会变，回放时很可能定位失败。返回有问题的行号+片段。
 */
export function detectFragileLines(lines: string[]): Array<{ id: number; snippet: string }> {
  const out: Array<{ id: number; snippet: string }> = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    // 动态 ID 特征：包含 $（如 mini-12$checkbox$3）、或 mini-数字、或 ext-gen / gwt-uid 这类自动 id
    if (
      /\[id=["'][^"']*\$[^"']*["']\]/.test(line) ||
      /#mini-\d+/.test(line) ||
      /ext-gen\d+|gwt-uid-\d+|:r[0-9a-z]+:/.test(line)
    ) {
      // 优先展示那个动态 ID 片段，让用户一眼看出问题在哪
      const idMatch = line.match(/\[id=["']([^"']*\$[^"']*)["']\]/) || line.match(/#(mini-\d+[^\s'"`)]*)/)
      const snippet = idMatch
        ? idMatch[1] ?? idMatch[0]
        : (line.match(/locator\(\s*(['"`])([\s\S]*?)\1/)?.[2] ?? line.slice(0, 60))
      out.push({ id: i, snippet })
    }
  }
  return out
}

/** 把选中的候选项替换成 {{name}} 占位符，未选中的保持字面量；返回最终脚本+字段 */
export function applyParameterization(
  lines: string[],
  selected: Array<{ id: number; name: string }>
): { script: string; fields: FieldDef[] } {
  const byId = new Map(selected.map((s) => [s.id, s.name]))
  const fields: FieldDef[] = []
  const seen = new Set<string>()

  const out = lines.map((line, i) => {
    const name = byId.get(i)
    if (!name) return line

    // 填写类：替换 fill/type/selectOption 的值
    const f = fillLiteral(line)
    if (f) {
      const replaced = line.replace(
        /\.(fill|type|selectOption)\(\s*(['"`])([\s\S]*?)\2\s*\)/,
        `.$1($2{{${name}}}$2)`
      )
      if (!seen.has(name)) {
        fields.push({ name, label: name, type: f.kind === 'select' ? 'select' : 'text' })
        seen.add(name)
      }
      return replaced
    }

    // 选择点击类：替换 getByText / cell name 里的文本
    const c = clickLiteral(line)
    if (c) {
      let replaced = line.replace(
        /getByText\(\s*(['"`])([\s\S]*?)\1/,
        `getByText($1{{${name}}}$1`
      )
      if (replaced === line) {
        replaced = line.replace(
          /(getByRole\(\s*['"`]cell['"`]\s*,\s*\{\s*name:\s*)(['"`])([\s\S]*?)\2/,
          `$1$2{{${name}}}$2`
        )
      }
      if (!seen.has(name)) {
        fields.push({ name, label: name, type: 'text' })
        seen.add(name)
      }
      return replaced
    }
    return line
  })

  return { script: out.join('\n'), fields }
}
