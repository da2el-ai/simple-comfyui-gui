export type WorkflowName = string

export type WorkflowsResponse = WorkflowName[]

export type ComfyUIEndpointResponse = {
  endpoint: string
}

export type DynamicInputType = 'list' | 'text' | 'number' | 'textarea'

export type WorkflowSearchType = 'class_type' | 'id' | 'title'

export type WorkflowConfigRequiredItem = {
  id: string
  workflow: {
    search_type: WorkflowSearchType
    search_value: string | number
    input_name: string
  }
}

export type WorkflowConfigOptionalItem = WorkflowConfigRequiredItem & {
  input: {
    title: string
    type: DynamicInputType
    value?: Array<string | number>
    default?: string | number
  }
}

export type WorkflowConfig = {
  output_node_id: number
  required: WorkflowConfigRequiredItem[]
  optional: WorkflowConfigOptionalItem[]
}

export type ComfyObjectInfo = Record<string, unknown>

export type WorkflowNode = {
  class_type?: string
  _meta?: {
    title?: string
  }
  inputs: Record<string, unknown>
}

export type WorkflowData = Record<string, WorkflowNode>

export type PromptResponse = {
  prompt_id: string
}

export type PromptHistory = Record<string, unknown>

/** ComfyUI /queue レスポンス */
export type ComfyQueue = {
  queue_running: Array<[number, string, ...unknown[]]>
  queue_pending: Array<[number, string, ...unknown[]]>
}
