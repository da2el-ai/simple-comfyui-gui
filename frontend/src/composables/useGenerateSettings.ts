import { ref } from 'vue'
import yaml from 'js-yaml'
import type {
  ComfyObjectInfo,
  DynamicInputType,
  DynamicInputValue,
  TDynamicInputItem,
  WorkflowConfig,
  WorkflowConfigOptionalItem,
  WorkflowData,
  WorkflowNode
} from '../types/api'
import {
  fetchComfyObjectInfo,
  fetchComfyUIEndpoint,
  fetchWorkflowConfigText,
  fetchWorkflowJson,
  fetchWorkflows
} from '../services/backendApi'
import { useAsyncState } from './useAsyncState'
import { loadSettings } from './useLocalSettings'
import type { PersistedSettings } from './useLocalSettings'

/**
 * 画像生成画面で利用する設定状態と操作関数を提供する。
 * @returns 生成設定の状態と各種操作関数。
 */
export function useGenerateSettings() {
  const { loading, errorMessage, run } = useAsyncState()
  const endpoint = ref('')
  const objectInfo = ref<ComfyObjectInfo | null>(null)
  const workflowConfig = ref<WorkflowConfig | null>(null)
  const workflowData = ref<WorkflowData | null>(null)

  const checkpointList = ref<string[]>([])
  const loraList = ref<string[]>([])
  const workflowList = ref<string[]>([])
  const currentCheckpoint = ref('')
  const currentWorkflow = ref('')
  const optionalItems = ref<TDynamicInputItem[]>([])

  /**
   * 初期化処理を行い、エンドポイント・object_info・チェックポイント・
   * ワークフロー情報を取得して初期状態を構築する。
   * @param saved ローカル保存済みの設定。
   * @returns 初期化完了時に解決されるPromise。
   */
  async function initialize(saved?: PersistedSettings): Promise<void> {
    await run(async () => {
      endpoint.value = await fetchComfyUIEndpoint()
      objectInfo.value = await fetchComfyObjectInfo()
      checkpointList.value = extractCheckpointList(objectInfo.value)
      loraList.value = extractLoraList(objectInfo.value)

      // 保存済みチェックポイントをリスト内で優先選択する
      if (saved?.currentCheckpoint && checkpointList.value.includes(saved.currentCheckpoint)) {
        currentCheckpoint.value = saved.currentCheckpoint
      } else if (checkpointList.value.length > 0) {
        currentCheckpoint.value = checkpointList.value[0]
      }

      workflowList.value = await fetchWorkflows()

      // 保存済みワークフローをリスト内で優先選択する
      const preferredWorkflow =
        saved?.currentWorkflow && workflowList.value.includes(saved.currentWorkflow)
          ? saved.currentWorkflow
          : workflowList.value[0]

      if (preferredWorkflow) {
        currentWorkflow.value = preferredWorkflow
        await loadWorkflowResources(preferredWorkflow)
      }
    }, '初期化に失敗しました')
  }

  /**
   * 現在のワークフローを切り替え、関連する設定とワークフローJSONを再読込する。
   * @param nextWorkflow 切り替え先のワークフロー名。
   * @returns 切り替え完了時に解決されるPromise。
   */
  async function changeWorkflow(nextWorkflow: string): Promise<void> {
    await run(async () => {
      currentWorkflow.value = nextWorkflow
      await loadWorkflowResources(nextWorkflow)
    }, 'ワークフロー切り替えに失敗しました')
  }

  /**
   * 指定ワークフローの設定YAMLとJSONを読み込み、任意入力項目を構築する。
   * 保存済み任意設定があれば、適用可能な値のみ復元する。
   * @param workflowName 読み込むワークフロー名。
   * @returns 読み込み完了時に解決されるPromise。
   */
  async function loadWorkflowResources(workflowName: string): Promise<void> {
    const [configText, workflowJson] = await Promise.all([
      fetchWorkflowConfigText(workflowName),
      fetchWorkflowJson(workflowName)
    ])

    const parsedConfig = yaml.load(configText)
    if (!isWorkflowConfig(parsedConfig)) {
      throw new Error('workflow設定の形式が不正です')
    }

    if (!isApiFormatWorkflow(workflowJson)) {
      throw new Error(
        `ワークフロー「${workflowName}」がAPI形式ではありません。` +
          'ComfyUIで「API形式で保存（Save (API Format)）」してから配置してください。'
      )
    }

    workflowConfig.value = parsedConfig
    workflowData.value = workflowJson
    const items = buildOptionalItems(parsedConfig.optional, objectInfo.value)

    // 保存済み値をワークフロー別に復元する（リスト項目はオプション一覧に含まれる値のみ採用）
    const savedValues = loadSettings().optionalValues[workflowName]
    if (savedValues) {
      const allItems = items.flatMap((item) => [item, ...(item.children ?? [])])
      for (const item of allItems) {
        if (item.type === 'image' || item.type === 'seed') {
          continue
        }

        const saved = savedValues[item.id]
        if (saved === undefined) continue
        if (isListLikeType(item.type)) {
          if (item.options.includes(String(saved))) item.value = String(saved)
        } else if (item.type === 'number') {
          if (typeof saved === 'number') item.value = saved
        } else if (item.type === 'switch' || item.type === 'boolean') {
          if (typeof saved === 'boolean') item.value = saved
        } else {
          item.value = saved
        }
      }
    }

    optionalItems.value = items
  }

  /**
   * 任意入力項目の値を更新する。
   * @param itemId 更新対象の項目ID。
   * @param value 設定する値。
   * @returns なし。
   */
  function handleOptionalValueChange(itemId: string, value: DynamicInputValue): void {
    const target = optionalItems.value.find((item) => item.id === itemId)
      ?? optionalItems.value.flatMap((item) => item.children ?? []).find((c) => c.id === itemId)
    if (!target) {
      return
    }
    target.value = value
  }

  // --- 内部ヘルパー ---

  /**
   * optional設定定義から動的入力項目の配列を生成する。
   * @param configOptional ワークフローのoptional定義配列。
   * @param info ComfyUIのobject_info。
   * @returns 画面表示用の動的入力項目配列。
   */
  function buildOptionalItems(
    configOptional: WorkflowConfigOptionalItem[],
    info: ComfyObjectInfo | null
  ): TDynamicInputItem[] {
    return configOptional
      .filter((item) => !configOptional.some(
        (parent) => parent.switch?.items?.some((child) => child.id === item.id)
      ))
      .map((item) => {
        const options = resolveListOptions(item, info)
        const value = resolveInitialValue(item, options)

        const result: TDynamicInputItem = {
          id: item.id,
          title: item.input.title,
          type: item.input.type,
          options,
          value
        }

        if (item.input.type === 'switch' && item.switch?.items) {
          result.children = item.switch.items.map((child) => {
            const childOptions = resolveListOptions(child, info)
            const childValue = resolveInitialValue(child, childOptions)
            return {
              id: `${item.id}.${child.id}`,
              title: child.input.title,
              type: child.input.type,
              options: childOptions,
              value: childValue
            }
          })
        }

        return result
      })
  }

  /**
   * list型入力項目の候補値をobject_infoから解決する。
   * @param item 候補値を解決するoptional項目。
   * @param info ComfyUIのobject_info。
   * @returns 候補値文字列の配列。
   */
  /**
   * object_infoの選択肢一覧を必要とする「リスト系」入力型かどうかを判定する。
   * list（ドロップダウン）と search（検索付きセレクター）が該当する。
   * @param type 判定する入力型。
   * @returns リスト系ならtrue。
   */
  function isListLikeType(type: DynamicInputType): boolean {
    return type === 'list' || type === 'search'
  }

  function resolveListOptions(
    item: WorkflowConfigOptionalItem,
    info: ComfyObjectInfo | null
  ): string[] {
    if (!isListLikeType(item.input.type) || !Array.isArray(item.input.value)) {
      return []
    }

    // YAMLのvalueパスは末尾にインデックス(0)を含み、旧形式のCOMBO定義先頭要素（選択肢配列）を指す。
    // ComfyUI新形式では先頭要素が "COMBO" 文字列に変わったため、末尾インデックスを外して
    // COMBO定義（配列）そのものを取得し、新旧どちらの形式からも選択肢を抽出する。
    const path = item.input.value
    const comboPath = typeof path[path.length - 1] === 'number' ? path.slice(0, -1) : path
    return extractComboOptions(getNestedValue(info, comboPath))
  }

  /**
   * ComfyUIのCOMBO入力定義から選択肢一覧を抽出する。新旧両形式に対応する。
   * - 旧形式: [ [選択肢配列], {metadata} ]
   * - 新形式: [ "COMBO", { options: [選択肢配列], ... } ]
   * @param comboDef object_info上のCOMBO入力定義（input.required.<name> の値）。
   * @returns 選択肢文字列の配列。形式が一致しなければ空配列。
   */
  function extractComboOptions(comboDef: unknown): string[] {
    if (!Array.isArray(comboDef)) {
      return []
    }

    // 旧形式: 先頭要素が選択肢配列
    if (Array.isArray(comboDef[0])) {
      return comboDef[0].map((entry) => String(entry))
    }

    // 新形式: メタデータ側の options が選択肢配列
    const meta = comboDef[1]
    if (meta != null && typeof meta === 'object') {
      const options = (meta as Record<string, unknown>).options
      if (Array.isArray(options)) {
        return options.map((entry) => String(entry))
      }
    }

    return []
  }

  /**
   * 入力項目の型と設定に応じて初期値を決定する。
   * @param item 初期値を決めるoptional項目。
   * @param options list型の場合の候補値配列。
   * @returns 初期値として設定する文字列または数値。
   */
  function resolveInitialValue(
    item: WorkflowConfigOptionalItem,
    options: string[]
  ): DynamicInputValue {
    if (item.input.type === 'image') {
      return ''
    }

    if (item.input.type === 'seed') {
      return Math.floor(Math.random() * 1_000_000_000)
    }

    if (isListLikeType(item.input.type)) {
      if (typeof item.input.default === 'string' && options.includes(item.input.default)) {
        return item.input.default
      }
      return options[0] ?? ''
    }

    if (item.input.type === 'number') {
      return typeof item.input.default === 'number' ? item.input.default : 0
    }

    if (item.input.type === 'switch') {
      return typeof item.input.default === 'boolean' ? item.input.default : true
    }

    if (item.input.type === 'boolean') {
      return typeof item.input.default === 'boolean' ? item.input.default : false
    }

    return typeof item.input.default === 'string' ? item.input.default : ''
  }

  /**
   * object_infoからチェックポイント名一覧を抽出する。
   * @param info ComfyUIのobject_info。
   * @returns チェックポイント名の配列。
   */
  function extractCheckpointList(info: ComfyObjectInfo | null): string[] {
    return extractComboOptions(
      getNestedValue(info, ['D2 Checkpoint Loader', 'input', 'required', 'ckpt_name'])
    )
  }

  /**
   * object_infoからLoRA名一覧を抽出する。
   * @param info ComfyUIのobject_info。
   * @returns LoRA名の配列。
   */
  function extractLoraList(info: ComfyObjectInfo | null): string[] {
    return extractComboOptions(
      getNestedValue(info, ['LoraLoader', 'input', 'required', 'lora_name'])
    )
  }

  /**
   * オブジェクトからパス配列を辿ってネスト値を取得する。
   * @param source 参照元オブジェクト。
   * @param path キーまたはインデックスの配列。
   * @returns 該当値。辿れない場合はundefined。
   */
  function getNestedValue(source: unknown, path: Array<string | number>): unknown {
    let current: unknown = source
    for (const segment of path) {
      if (current == null || typeof current !== 'object') {
        return undefined
      }
      current = (current as Record<string, unknown>)[String(segment)]
    }
    return current
  }

  /**
   * YAML読み込み結果がWorkflowConfig形式かどうかを判定する。
   * @param value 検証対象の値。
   * @returns requiredとoptionalを持つ配列構造ならtrue。
   */
  function isWorkflowConfig(value: unknown): value is WorkflowConfig {
    if (value == null || typeof value !== 'object') {
      return false
    }

    const config = value as Partial<WorkflowConfig>
    return Array.isArray(config.required) && Array.isArray(config.optional)
  }

  /**
   * ワークフローJSONがComfyUIのAPI形式かどうかを判定する。
   * グラフ（通常保存）形式は nodes/links 配列を持ち、各値がノード辞書ではないため除外する。
   * @param value 検証対象のワークフローJSON。
   * @returns ノードIDをキーにした辞書（API形式）ならtrue。
   */
  function isApiFormatWorkflow(value: unknown): value is WorkflowData {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
      return false
    }

    // グラフ（UI）形式の特徴キーを持つ場合はAPI形式ではない
    const graphLike = value as Record<string, unknown>
    if (Array.isArray(graphLike.nodes) || Array.isArray(graphLike.links)) {
      return false
    }

    const entries = Object.entries(value as Record<string, unknown>)
    if (entries.length === 0) {
      return false
    }

    // 全エントリがノード辞書（class_type または inputs を持つオブジェクト）であること
    return entries.every(([, node]) => {
      if (node == null || typeof node !== 'object' || Array.isArray(node)) {
        return false
      }
      const candidate = node as Partial<WorkflowNode>
      return typeof candidate.class_type === 'string' || candidate.inputs != null
    })
  }

  return {
    loading,
    errorMessage,
    endpoint,
    objectInfo,
    workflowConfig,
    workflowData,
    checkpointList,
    loraList,
    workflowList,
    currentCheckpoint,
    currentWorkflow,
    optionalItems,
    initialize,
    changeWorkflow,
    handleOptionalValueChange
  }
}
