import { ref } from 'vue'
import yaml from 'js-yaml'
import type { TDynamicInputItem } from '../types'
import type {
  ComfyObjectInfo,
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

  /** 初期化: エンドポイント・object_info・ワークフロー一覧を取得する */
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

  /** ワークフロー切り替え */
  async function changeWorkflow(nextWorkflow: string): Promise<void> {
    await run(async () => {
      currentWorkflow.value = nextWorkflow
      await loadWorkflowResources(nextWorkflow)
    }, 'ワークフロー切り替えに失敗しました')
  }

  /** ワークフロー設定と JSON を読み込む */
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

  /** 任意設定の値を変更する */
  function handleOptionalValueChange(itemId: string, value: string | number): void {
    const target = optionalItems.value.find((item) => item.id === itemId)
    if (!target) {
      return
    }
    target.value = value
  }

  // --- 内部ヘルパー ---

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

  function resolveInitialValue(
    item: WorkflowConfigOptionalItem,
    options: string[]
  ): string | number {
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
