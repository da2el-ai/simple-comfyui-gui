import { ref, type Ref } from 'vue'
import type { TDynamicInputItem } from '../types'
import type {
  PromptHistory,
  WorkflowConfig,
  WorkflowConfigOptionalItem,
  WorkflowConfigRequiredItem,
  WorkflowData,
  WorkflowNode,
  WorkflowSearchType
} from '../types/api'
import { fetchPromptHistory, submitPrompt } from '../services/backendApi'

export interface ImageGenerationDeps {
  endpoint: Ref<string>
  workflowConfig: Ref<WorkflowConfig | null>
  workflowData: Ref<WorkflowData | null>
  currentCheckpoint: Ref<string>
  optionalItems: Ref<TDynamicInputItem[]>
  positive: Ref<string>
  negative: Ref<string>
  batchCount: Ref<number>
}

const HISTORY_POLL_BASE_MS = 3000
const HISTORY_POLL_MAX_MS = 10000
const HISTORY_MONITOR_TIMEOUT_MS = 15 * 60 * 1000

export function useImageGeneration(deps: ImageGenerationDeps) {
  const isGenerating = ref(false)
  const generationMessage = ref('')
  const errorMessage = ref('')
  const queueCount = ref(0)

  /** 画像生成を実行する */
  async function generateImages(): Promise<void> {
    const { endpoint, workflowConfig, workflowData } = deps

    if (!workflowConfig.value || !workflowData.value || !endpoint.value || isGenerating.value) {
      return
    }

    isGenerating.value = true
    errorMessage.value = ''
    generationMessage.value = 'キューへ投入しています...'
    queueCount.value = 0

    try {
      const promptIds: string[] = []

      for (let index = 0; index < deps.batchCount.value; index += 1) {
        const promptWorkflow = buildPromptWorkflow()
        const response = await submitPrompt(endpoint.value, promptWorkflow)
        promptIds.push(response.prompt_id)
        queueCount.value = promptIds.length
      }

      generationMessage.value = '生成完了を確認中です...'
      await monitorPromptCompletion(promptIds)
      generationMessage.value = '生成が完了しました'
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '画像生成に失敗しました'
      generationMessage.value = ''
    } finally {
      isGenerating.value = false
    }
  }

  // --- 内部: プロンプトワークフロー構築 ---

  function buildPromptWorkflow(): WorkflowData {
    const { workflowData } = deps
    if (!workflowData.value) {
      throw new Error('workflowデータが未初期化です')
    }

    const promptWorkflow = cloneWorkflow(workflowData.value)
    const optionalValueMap = buildOptionalValueMap()

    setNodeValueByConfig(promptWorkflow, 'required', 'positive', deps.positive.value)
    setNodeValueByConfig(promptWorkflow, 'required', 'negative', deps.negative.value)

    if (deps.currentCheckpoint.value !== '') {
      setNodeValueByConfig(promptWorkflow, 'required', 'checkpoint', deps.currentCheckpoint.value)
    }

    const randomSeed = Math.floor(Math.random() * 1_000_000_000)
    setNodeValueByConfig(promptWorkflow, 'required', 'seed', randomSeed)

    for (const [itemId, itemValue] of Object.entries(optionalValueMap)) {
      setNodeValueByConfig(promptWorkflow, 'optional', itemId, itemValue)
    }

    return promptWorkflow
  }

  function buildOptionalValueMap(): Record<string, string | number> {
    const valueMap: Record<string, string | number> = {}

    for (const item of deps.optionalItems.value) {
      if (item.value === '') {
        continue
      }
      valueMap[item.id] = item.value
    }

    return valueMap
  }

  function cloneWorkflow(source: WorkflowData): WorkflowData {
    return JSON.parse(JSON.stringify(source)) as WorkflowData
  }

  function setNodeValueByConfig(
    workflow: WorkflowData,
    category: 'required' | 'optional',
    itemId: string,
    value: string | number
  ): void {
    if (typeof value === 'string' && value === '') {
      return
    }

    const configItem = findConfigItem(category, itemId)
    if (!configItem) {
      return
    }

    const targetNode = findNode(
      workflow,
      configItem.workflow.search_type,
      configItem.workflow.search_value
    )
    if (!targetNode) {
      return
    }

    targetNode.inputs[configItem.workflow.input_name] = value
  }

  function findConfigItem(
    category: 'required' | 'optional',
    itemId: string
  ): WorkflowConfigRequiredItem | WorkflowConfigOptionalItem | null {
    const targetItems = deps.workflowConfig.value?.[category]
    if (!targetItems) {
      return null
    }
    return targetItems.find((item) => item.id === itemId) ?? null
  }

  function findNode(
    workflow: WorkflowData,
    searchType: WorkflowSearchType,
    searchValue: string | number
  ): WorkflowNode | null {
    for (const [nodeId, node] of Object.entries(workflow)) {
      if (searchType === 'id' && nodeId === String(searchValue)) {
        return node
      }
      if (searchType === 'class_type' && node.class_type === searchValue) {
        return node
      }
      if (searchType === 'title' && node._meta?.title === searchValue) {
        return node
      }
    }
    return null
  }

  // --- 内部: 生成完了監視 ---

  async function monitorPromptCompletion(promptIds: string[]): Promise<void> {
    while (promptIds.length > 0) {
      const promptId = promptIds[0]
      const completed = await waitForPromptCompletion(promptId)

      if (!completed) {
        throw new Error(`生成完了の確認に失敗しました: ${promptId}`)
      }

      promptIds.shift()
      queueCount.value = promptIds.length
    }
  }

  async function waitForPromptCompletion(promptId: string): Promise<boolean> {
    const startedAt = Date.now()
    let nextInterval = HISTORY_POLL_BASE_MS

    while (Date.now() - startedAt < HISTORY_MONITOR_TIMEOUT_MS) {
      try {
        const history = await fetchPromptHistory(deps.endpoint.value, promptId)
        if (isPromptCompleted(history, promptId)) {
          return true
        }
      } catch {
        // ポーリング中のエラーは無視して継続
      }

      await sleep(nextInterval)
      nextInterval = Math.min(Math.floor(nextInterval * 1.2), HISTORY_POLL_MAX_MS)
    }

    return false
  }

  function isPromptCompleted(history: PromptHistory, promptId: string): boolean {
    const promptHistory = history[promptId]
    if (!promptHistory || typeof promptHistory !== 'object') {
      return false
    }

    const outputs = (promptHistory as Record<string, unknown>).outputs
    if (!outputs || typeof outputs !== 'object') {
      return false
    }

    return Object.keys(outputs as Record<string, unknown>).length > 0
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  return {
    isGenerating,
    generationMessage,
    errorMessage,
    queueCount,
    generateImages
  }
}
