import { ref } from 'vue'
import yaml from 'js-yaml'
import type {
  ComfyObjectInfo,
  TDynamicInputItem,
  WorkflowConfig,
  WorkflowConfigOptionalItem,
  WorkflowData
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
      objectInfo.value = await fetchComfyObjectInfo(endpoint.value)
      checkpointList.value = extractCheckpointList(objectInfo.value)

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

    workflowConfig.value = parsedConfig
    workflowData.value = workflowJson
    const items = buildOptionalItems(parsedConfig.optional, objectInfo.value)

    // 保存済み値をワークフロー別に復元する（リスト項目はオプション一覧に含まれる値のみ採用）
    const savedValues = loadSettings().optionalValues[workflowName]
    if (savedValues) {
      for (const item of items) {
        if (item.type === 'image' || item.type === 'seed') {
          continue
        }

        const saved = savedValues[item.id]
        if (saved === undefined) continue
        if (item.type === 'list') {
          if (item.options.includes(String(saved))) item.value = String(saved)
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
  function handleOptionalValueChange(itemId: string, value: string | number): void {
    const target = optionalItems.value.find((item) => item.id === itemId)
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
    return configOptional.map((item) => {
      const options = resolveListOptions(item, info)
      const value = resolveInitialValue(item, options)

      return {
        id: item.id,
        title: item.input.title,
        type: item.input.type,
        options,
        value
      }
    })
  }

  /**
   * list型入力項目の候補値をobject_infoから解決する。
   * @param item 候補値を解決するoptional項目。
   * @param info ComfyUIのobject_info。
   * @returns 候補値文字列の配列。
   */
  function resolveListOptions(
    item: WorkflowConfigOptionalItem,
    info: ComfyObjectInfo | null
  ): string[] {
    if (item.input.type !== 'list' || !Array.isArray(item.input.value)) {
      return []
    }

    const resolved = getNestedValue(info, item.input.value)
    if (!Array.isArray(resolved)) {
      return []
    }

    return resolved.map((entry) => String(entry))
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
  ): string | number {
    if (item.input.type === 'image') {
      return ''
    }

    if (item.input.type === 'seed') {
      return Math.floor(Math.random() * 1_000_000_000)
    }

    if (item.input.type === 'list') {
      if (typeof item.input.default === 'string' && options.includes(item.input.default)) {
        return item.input.default
      }
      return options[0] ?? ''
    }

    if (item.input.type === 'number') {
      return typeof item.input.default === 'number' ? item.input.default : 0
    }

    return typeof item.input.default === 'string' ? item.input.default : ''
  }

  /**
   * object_infoからチェックポイント名一覧を抽出する。
   * @param info ComfyUIのobject_info。
   * @returns チェックポイント名の配列。
   */
  function extractCheckpointList(info: ComfyObjectInfo | null): string[] {
    const value = getNestedValue(info, [
      'D2 Checkpoint Loader',
      'input',
      'required',
      'ckpt_name',
      0
    ])
    if (!Array.isArray(value)) {
      return []
    }
    return value.map((entry) => String(entry))
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

  return {
    loading,
    errorMessage,
    endpoint,
    objectInfo,
    workflowConfig,
    workflowData,
    checkpointList,
    workflowList,
    currentCheckpoint,
    currentWorkflow,
    optionalItems,
    initialize,
    changeWorkflow,
    handleOptionalValueChange
  }
}
