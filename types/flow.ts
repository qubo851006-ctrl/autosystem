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
