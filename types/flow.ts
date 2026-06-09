export type StepAction = 'fill' | 'click' | 'select' | 'waitFor' | 'screenshot' | 'check'

export interface Step {
  action: StepAction
  selector: string
  value?: string          // 支持 {{变量名}} 占位符
  timeout?: number        // 默认 5000ms
  description?: string    // 步骤描述，显示在进度日志中
}

export interface FieldDef {
  name: string            // 变量名，对应 steps 中的 {{name}}
  label: string           // 界面显示名称
  type: 'text' | 'number' | 'select' | 'date' | 'textarea'
  required?: boolean
  options?: string[]      // select 类型的选项列表
}

export interface FlowConfig {
  name: string
  url: string
  fields: FieldDef[]
  steps: Step[]
  // 由 Playwright codegen 录制生成的回放脚本（动作序列，值已参数化为 {{字段}}）。
  // 存在时优先用脚本回放，能处理新标签页、Element UI 等复杂场景；
  // steps 仅作为旧版/手写流程的兼容路径。
  script?: string
}

// 录制后供用户参数化的候选值（一个填写值或一个选择值）
export interface ParamCandidate {
  id: number                       // 对应 actionLines 的行号
  value: string                    // 录制时的字面值（示例值/选项文本）
  kind: 'fill' | 'select' | 'click' // 动作性质
  label: string                    // 推断出的字段标签
  suggested: boolean               // 是否默认勾选为变量
}

// /api/codegen/stop 的返回：未参数化的动作行 + 候选值列表
export interface RecordingResult {
  name: string
  url: string
  actionLines: string[]
  candidates: ParamCandidate[]
}

export type TaskStatus = 'pending' | 'running' | 'success' | 'failed'

export interface StepLog {
  stepIndex: number
  description: string
  status: 'success' | 'failed' | 'skipped'
  error?: string
  timestamp: string
}

export interface TaskProgressEvent {
  type: 'step' | 'done' | 'error'
  stepIndex?: number
  description?: string
  status?: 'success' | 'failed'
  error?: string
  totalSteps?: number
}
