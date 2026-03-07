import { ref, type Ref } from 'vue'
import { toErrorMessage } from './useAsyncState'
import type { TDynamicInputItem } from '../types'
import type {
  ComfyImageFile,
  PromptHistory,
  WorkflowConfig,
  WorkflowConfigOptionalItem,
  WorkflowConfigRequiredItem,
  WorkflowData,
  WorkflowNode,
  WorkflowSearchType
} from '../types/api'
import { fetchPromptHistory, fetchQueue, deleteQueueItems, submitPrompt } from '../services/backendApi'

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

const HISTORY_POLL_BASE_MS = 1000
const HISTORY_POLL_MAX_MS = 10000
const HISTORY_MONITOR_TIMEOUT_MS = 15 * 60 * 1000

export function useImageGeneration(deps: ImageGenerationDeps) {
  const isGenerating = ref(false)
  const generationMessage = ref('')
  const errorMessage = ref('')
  const queueCount = ref(0)
  const previewImages = ref<string[]>([])
  // 現在監視中の prompt_id リスト（キャンセル時に参照する）
  const activePromptIds = ref<string[]>([])

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
        const resolvedOptionalValueMap = await buildOptionalValueMap()
        const promptWorkflow = buildPromptWorkflow(resolvedOptionalValueMap)
        const response = await submitPrompt(endpoint.value, promptWorkflow)
        promptIds.push(response.prompt_id)
        queueCount.value = promptIds.length
      }

      activePromptIds.value = [...promptIds]
      generationMessage.value = '生成完了を確認中です...'
      await monitorPromptCompletion()
      if (activePromptIds.value.length === 0) {
        generationMessage.value = '生成が完了しました'
      }
    } catch (error) {
      errorMessage.value = toErrorMessage(error, '画像生成に失敗しました')
      generationMessage.value = ''
    } finally {
      isGenerating.value = false
      activePromptIds.value = []
      queueCount.value = 0
    }
  }

  /** 保留中キューを削除し生成をキャンセルする。実行中のジョブは完了を待機する。 */
  async function cancelGeneration(): Promise<void> {
    if (!isGenerating.value || !deps.endpoint.value) return

    try {
      const queue = await fetchQueue(deps.endpoint.value)

      // 実行中 ID（先頭要素のみ）
      const runningId =
        Array.isArray(queue.queue_running) && queue.queue_running.length > 0
          ? queue.queue_running[0][1]
          : null

      // 保留中 ID を全て削除
      const pendingIds = (queue.queue_pending ?? []).map((item) => item[1])
      await deleteQueueItems(deps.endpoint.value, pendingIds)

      // activePromptIds を実行中のもののみに絞り込む
      activePromptIds.value = runningId ? [runningId] : []
      queueCount.value = activePromptIds.value.length
      generationMessage.value = 'キャンセルしました'
      // isGenerating は generateImages の finally ブロックで管理する
    } catch (error) {
      errorMessage.value = toErrorMessage(error, 'キャンセルに失敗しました')
    }
  }

  // --- 内部: プロンプトワークフロー構築 ---

  function buildPromptWorkflow(optionalValueMap: Record<string, string | number>): WorkflowData {
    const { workflowData } = deps
    if (!workflowData.value) {
      throw new Error('workflowデータが未初期化です')
    }

    const promptWorkflow = cloneWorkflow(workflowData.value)

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

  async function buildOptionalValueMap(): Promise<Record<string, string | number>> {
    const valueMap: Record<string, string | number> = {}

    for (const item of deps.optionalItems.value) {
      if (item.type === 'seed') {
        valueMap[item.id] = Math.floor(Math.random() * 1_000_000_000)
        continue
      }

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

  async function monitorPromptCompletion(): Promise<void> {
    // activePromptIds のスナップショットを取りつつ、順番に完了を待つ
    const idsToMonitor = [...activePromptIds.value]

    for (const promptId of idsToMonitor) {
      // キャンセルで activePromptIds から除外済みならスキップ
      if (!activePromptIds.value.includes(promptId)) {
        continue
      }

      const completed = await waitForPromptCompletion(promptId)

      // 待機中にキャンセルされた場合もスキップ
      if (!activePromptIds.value.includes(promptId)) {
        continue
      }

      if (!completed) {
        throw new Error(`生成完了の確認に失敗しました: ${promptId}`)
      }

      // 完了した履歴から画像 URL を取得して追加する
      try {
        const history = await fetchPromptHistory(deps.endpoint.value, promptId)
        appendImagesFromHistory(history, promptId)
      } catch {
        // 画像取得失敗時はスキップ
      }

      activePromptIds.value = activePromptIds.value.filter((id) => id !== promptId)
      queueCount.value = activePromptIds.value.length
    }
  }

  async function waitForPromptCompletion(promptId: string): Promise<boolean> {
    const startedAt = Date.now()
    let nextInterval = HISTORY_POLL_BASE_MS

    while (Date.now() - startedAt < HISTORY_MONITOR_TIMEOUT_MS) {
      // activePromptIds から除去されていたらキャンセル扱いで即終了
      if (!activePromptIds.value.includes(promptId)) {
        return false
      }

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

  function appendImagesFromHistory(history: PromptHistory, promptId: string): void {
    const promptHistory = history[promptId] as Record<string, unknown> | undefined
    if (!promptHistory) return

    const outputs = promptHistory.outputs as Record<string, unknown> | undefined
    if (!outputs) return

    const outputNodeId = deps.workflowConfig.value?.output_node_id
    if (outputNodeId == null) return

    const nodeOutput = outputs[String(outputNodeId)] as Record<string, unknown> | undefined
    if (!nodeOutput) return

    const images = nodeOutput.images as ComfyImageFile[] | undefined
    if (!Array.isArray(images)) return

    for (const image of images) {
      const typeParam = image.type === 'temp' ? '&type=temp' : ''
      const url = `${deps.endpoint.value}/view?filename=${encodeURIComponent(image.filename)}${typeParam}`
      previewImages.value.unshift(url)
    }
  }

  function clearPreview(): void {
    previewImages.value = []
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
    previewImages,
    generateImages,
    cancelGeneration,
    clearPreview
  }
}
