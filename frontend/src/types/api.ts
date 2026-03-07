export type WorkflowName = string

export type WorkflowsResponse = WorkflowName[]

export type ComfyUIEndpointResponse = {
  endpoint: string
}

export type DynamicInputType = 'list' | 'text' | 'number' | 'textarea' | 'image' | 'seed'

export type TDynamicInputItem = {
  id: string
  title: string
  type: DynamicInputType
  options: string[]
  value: string | number
}

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

export type ComfyImageFile = {
  filename: string
  subfolder: string
  type: string
}

export type ComfyUploadImageResponse = {
  name: string
  subfolder: string
  type: string
}

export type ComfyOriginalRef = {
  filename: string
  subfolder: string
  type: string
}

export type PromptHistory = Record<string, unknown>

/** ComfyUI /queue レスポンス */
export type ComfyQueue = {
  queue_running: Array<[number, string, ...unknown[]]>
  queue_pending: Array<[number, string, ...unknown[]]>
}

// ─── PromptSelector ───────────────────────────────────────────────────────────

export type SelectorItem = {
  name: string
  prompt: string
}

export type SelectorSubcategory = {
  subcategory: string
  items: SelectorItem[]
}

/** カテゴリ名 → サブカテゴリ一覧 */
export type SelectorAllData = Record<string, SelectorSubcategory[]>

export type SelectorDeleteType = 'item' | 'subcategory' | 'category'

export type SelectorAddRequest = {
  category: string
  new_category?: string
  subcategory: string
  new_subcategory?: string
  name: string
  prompt: string
}

export type SelectorEditRequest = {
  new_name?: string
  new_prompt?: string
}

export type SelectorDeleteRequest = {
  type: SelectorDeleteType
  category: string
  subcategory?: string
  name?: string
}
