import { ref, type Ref } from 'vue'
import { toErrorMessage } from './useAsyncState'
import type {
  ComfyImageFile,
  PromptHistory,
  TDynamicInputItem,
  WorkflowConfig,
  WorkflowDeleteTarget,
  WorkflowInputBinding,
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

/**
 * 画像生成の実行・キャンセル・完了監視とプレビュー管理を提供する。
 * @param deps 生成処理が参照する依存状態。
 * @returns 画像生成の状態と操作関数。
 */
export function useImageGeneration(deps: ImageGenerationDeps) {
  const isGenerating = ref(false)
  const generationMessage = ref('')
  const errorMessage = ref('')
  const queueCount = ref(0)
  const previewImages = ref<string[]>([])
  // 現在監視中の prompt_id リスト（キャンセル時に参照する）
  const activePromptIds = ref<string[]>([])

  /**
   * 画像生成を実行し、投入した全プロンプトの完了を監視する。
   * @param batchCountOverride 生成枚数の上書き値。
   * @returns 生成処理完了時に解決されるPromise。
   */
  async function generateImages(batchCountOverride?: number): Promise<void> {
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
      const effectiveBatchCount =
        typeof batchCountOverride === 'number'
          ? Math.max(1, Math.floor(batchCountOverride))
          : Math.max(1, Math.floor(deps.batchCount.value))

      for (let index = 0; index < effectiveBatchCount; index += 1) {
        const resolvedOptionalValueMap = await buildOptionalValueMap()
        const promptWorkflow = buildPromptWorkflow(resolvedOptionalValueMap)
        // console.log("promptWorkflow", promptWorkflow)
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

  /**
   * 保留中キューを削除して生成をキャンセルする。実行中ジョブは完了待機に切り替える。
   * @returns キャンセル処理完了時に解決されるPromise。
   */
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

  /**
   * optional値を反映した送信用ワークフローを構築する。
   * @param optionalValueMap optional項目IDと値のマップ。
   * @returns 送信用に複製・更新されたワークフローデータ。
   */
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

    applySwitchTargets(promptWorkflow)

    return promptWorkflow
  }

  /**
   * UI上のoptional入力から送信用の値マップを生成する。
   * seed型は毎回ランダム値に置き換え、空文字は除外する。
   * @returns optional項目IDと値のマップ。
   */
  async function buildOptionalValueMap(): Promise<Record<string, string | number>> {
    const valueMap: Record<string, string | number> = {}

    for (const item of deps.optionalItems.value) {
      if (item.type === 'seed') {
        valueMap[item.id] = Math.floor(Math.random() * 1_000_000_000)
        continue
      }

      if (item.type === 'switch') {
        continue
      }

      if (typeof item.value === 'boolean') {
        continue
      }

      if (item.value === '') {
        continue
      }
      valueMap[item.id] = item.value
    }

    return valueMap
  }

  /**
   * ワークフローデータをディープコピーする。
   * @param source コピー元ワークフロー。
   * @returns 複製されたワークフロー。
   */
  function cloneWorkflow(source: WorkflowData): WorkflowData {
    return JSON.parse(JSON.stringify(source)) as WorkflowData
  }

  /**
   * 設定定義に従って対象ノード入力へ値を設定する。
   * @param workflow 更新対象ワークフロー。
   * @param category requiredまたはoptional。
   * @param itemId 設定項目ID。
   * @param value 設定する値。
   * @returns なし。
   */
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
    if (!configItem || !hasWorkflowBinding(configItem)) {
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

  /**
   * switch型入力の値に応じて、無効化対象ノードや経路をワークフローから削除する。
   * @param workflow 更新対象ワークフロー。
   * @returns なし。
   */
  function applySwitchTargets(workflow: WorkflowData): void {
    const optionals = deps.workflowConfig.value?.optional ?? []

    for (const item of deps.optionalItems.value) {
      if (item.type !== 'switch' || item.value !== false) {
        continue
      }

      const config = optionals.find((optional) => optional.id === item.id)
      const targets = config?.switch?.workflow?.targets
      if (!Array.isArray(targets)) {
        continue
      }

      for (const target of targets) {
        removeWorkflowTarget(workflow, target)
      }
    }
  }

  /**
   * 指定ターゲット定義に従ってノードまたは経路を削除する。
   * @param workflow 更新対象ワークフロー。
   * @param target 削除対象定義。
   * @returns なし。
   */
  function removeWorkflowTarget(workflow: WorkflowData, target: WorkflowDeleteTarget): void {
    if (typeof target === 'string') {
      delete workflow[target]
      return
    }

    if (!Array.isArray(target) || target.length === 0) {
      return
    }

    removeByPath(workflow as unknown, target)
  }

  /**
   * パス定義で指定された値をオブジェクトから削除する。
   * @param source 削除対象オブジェクト。
   * @param path キーまたはインデックスの配列。
   * @returns なし。
   */
  function removeByPath(source: unknown, path: Array<string | number>): void {
    let current: unknown = source

    for (let index = 0; index < path.length - 1; index += 1) {
      if (current == null || typeof current !== 'object') {
        return
      }
      current = (current as Record<string, unknown>)[String(path[index])]
    }

    if (current == null || typeof current !== 'object') {
      return
    }

    const leaf = path[path.length - 1]

    if (Array.isArray(current)) {
      const numericIndex = Number(leaf)
      if (Number.isInteger(numericIndex) && numericIndex >= 0 && numericIndex < current.length) {
        current.splice(numericIndex, 1)
      }
      return
    }

    delete (current as Record<string, unknown>)[String(leaf)]
  }

  /**
   * 設定カテゴリと項目IDから対応する設定項目を取得する。
   * @param category requiredまたはoptional。
   * @param itemId 取得対象の項目ID。
   * @returns 該当設定項目。見つからない場合はnull。
   */
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

  /**
   * 設定項目が入力反映用のworkflowバインディングを持つか判定する。
   * @param item 判定対象の設定項目。
   * @returns search_type/search_value/input_name を持つ場合true。
   */
  function hasWorkflowBinding(
    item: WorkflowConfigRequiredItem | WorkflowConfigOptionalItem
  ): item is (WorkflowConfigRequiredItem | WorkflowConfigOptionalItem) & {
    workflow: WorkflowInputBinding
  } {
    const workflow = item.workflow as Partial<WorkflowInputBinding> | undefined
    return Boolean(
      workflow &&
        workflow.search_type != null &&
        workflow.search_value != null &&
        workflow.input_name != null
    )
  }

  /**
   * 検索条件でワークフローノードを探索する。
   * @param workflow 探索対象ワークフロー。
   * @param searchType 探索種別。
   * @param searchValue 探索値。
   * @returns 見つかったノード。見つからない場合はnull。
   */
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

  /**
   * 監視対象の全prompt_idについて順番に完了を待機し、画像プレビューを追加する。
   * @returns 監視完了時に解決されるPromise。
   */
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

  /**
   * 単一prompt_idの履歴をポーリングし、完了状態になるまで待機する。
   * @param promptId 監視対象のprompt_id。
   * @returns 完了ならtrue。キャンセルまたはタイムアウト時はfalse。
   */
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

  /**
   * 履歴データに出力ノード結果が存在するかを判定する。
   * @param history ComfyUIの履歴データ。
   * @param promptId 判定対象のprompt_id。
   * @returns 出力が存在すればtrue。
   */
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

  /**
   * 履歴データから出力画像URLを生成してプレビュー先頭へ追加する。
   * @param history ComfyUIの履歴データ。
   * @param promptId 対象prompt_id。
   * @returns なし。
   */
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

  /**
   * 生成プレビュー画像を全てクリアする。
   * @returns なし。
   */
  function clearPreview(): void {
    previewImages.value = []
  }

  /**
   * 指定ミリ秒だけ待機する。
   * @param ms 待機時間（ミリ秒）。
   * @returns 待機後に解決されるPromise。
   */
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
