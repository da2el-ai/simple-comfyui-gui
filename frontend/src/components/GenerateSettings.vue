<script setup lang="ts">
import { onMounted, ref } from 'vue'
import yaml from 'js-yaml'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'
import type { TDynamicInputItem } from '../types'
import type {
  ComfyObjectInfo,
  PromptHistory,
  WorkflowConfig,
  WorkflowConfigOptionalItem,
  WorkflowConfigRequiredItem,
  WorkflowData,
  WorkflowNode,
  WorkflowSearchType
} from '../types/api'
import {
  fetchComfyObjectInfo,
  fetchComfyUIEndpoint,
  fetchPromptHistory,
  fetchWorkflowConfigText,
  fetchWorkflowJson,
  fetchWorkflows,
  submitPrompt
} from '../services/backendApi'

const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const queueCount = ref(0)
const positiveTextareaRef = ref<HTMLTextAreaElement | null>(null)
const negativeTextareaRef = ref<HTMLTextAreaElement | null>(null)

const loading = ref(false)
const errorMessage = ref('')
const generationMessage = ref('')
const isGenerating = ref(false)
const endpoint = ref('')
const objectInfo = ref<ComfyObjectInfo | null>(null)
const workflowConfig = ref<WorkflowConfig | null>(null)
const workflowData = ref<WorkflowData | null>(null)

const checkpointList = ref<string[]>([])
const workflowList = ref<string[]>([])
const currentCheckpoint = ref('')
const currentWorkflow = ref('')
const optionalItems = ref<TDynamicInputItem[]>([])

const HISTORY_POLL_BASE_MS = 3000
const HISTORY_POLL_MAX_MS = 10000
const HISTORY_MONITOR_TIMEOUT_MS = 15 * 60 * 1000

onMounted(async () => {
  await initialize()
})

async function initialize() {
  loading.value = true
  errorMessage.value = ''

  try {
    endpoint.value = await fetchComfyUIEndpoint()
    objectInfo.value = await fetchComfyObjectInfo(endpoint.value)
    checkpointList.value = extractCheckpointList(objectInfo.value)
    if (checkpointList.value.length > 0) {
      currentCheckpoint.value = checkpointList.value[0]
    }

    workflowList.value = await fetchWorkflows()
    if (workflowList.value.length > 0) {
      currentWorkflow.value = workflowList.value[0]
      await loadWorkflowResources(currentWorkflow.value)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '初期化に失敗しました'
  } finally {
    loading.value = false
  }
}

async function handleWorkflowChange(event: Event) {
  if (isGenerating.value) {
    return
  }

  const nextWorkflow = (event.target as HTMLSelectElement).value
  loading.value = true
  errorMessage.value = ''

  try {
    currentWorkflow.value = nextWorkflow
    await loadWorkflowResources(nextWorkflow)
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'ワークフロー切り替えに失敗しました'
  } finally {
    loading.value = false
  }
}

async function loadWorkflowResources(workflowName: string) {
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
  optionalItems.value = buildOptionalItems(parsedConfig.optional, objectInfo.value)
}

async function generateImages() {
  if (!workflowConfig.value || !workflowData.value || !endpoint.value || isGenerating.value) {
    return
  }

  isGenerating.value = true
  errorMessage.value = ''
  generationMessage.value = 'キューへ投入しています...'
  queueCount.value = 0

  try {
    const promptIds: string[] = []

    for (let index = 0; index < batchCount.value; index += 1) {
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

function buildPromptWorkflow(): WorkflowData {
  if (!workflowData.value) {
    throw new Error('workflowデータが未初期化です')
  }

  const promptWorkflow = cloneWorkflow(workflowData.value)
  const optionalValueMap = buildOptionalValueMap()

  setNodeValueByConfig(promptWorkflow, 'required', 'positive', positive.value)
  setNodeValueByConfig(promptWorkflow, 'required', 'negative', negative.value)
  if (currentCheckpoint.value !== '') {
    setNodeValueByConfig(promptWorkflow, 'required', 'checkpoint', currentCheckpoint.value)
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

  for (const item of optionalItems.value) {
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
) {
  if (typeof value === 'string' && value === '') {
    return
  }

  const configItem = findConfigItem(category, itemId)
  if (!configItem) {
    return
  }

  const targetNode = findNode(workflow, configItem.workflow.search_type, configItem.workflow.search_value)
  if (!targetNode) {
    return
  }

  targetNode.inputs[configItem.workflow.input_name] = value
}

function findConfigItem(
  category: 'required' | 'optional',
  itemId: string
): WorkflowConfigRequiredItem | WorkflowConfigOptionalItem | null {
  if (!workflowConfig.value) {
    return null
  }

  const targetItems = workflowConfig.value[category]
  const foundItem = targetItems.find((item) => item.id === itemId)
  return foundItem ?? null
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

async function monitorPromptCompletion(promptIds: string[]) {
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
      const history = await fetchPromptHistory(endpoint.value, promptId)
      if (isPromptCompleted(history, promptId)) {
        return true
      }
    } catch {
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

function buildOptionalItems(configOptional: WorkflowConfigOptionalItem[], info: ComfyObjectInfo | null): TDynamicInputItem[] {
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

function resolveListOptions(item: WorkflowConfigOptionalItem, info: ComfyObjectInfo | null): string[] {
  if (item.input.type !== 'list' || !Array.isArray(item.input.value)) {
    return []
  }

  const resolved = getNestedValue(info, item.input.value)
  if (!Array.isArray(resolved)) {
    return []
  }

  return resolved.map((entry) => String(entry))
}

function resolveInitialValue(item: WorkflowConfigOptionalItem, options: string[]): string | number {
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
  const value = getNestedValue(info, ['D2 Checkpoint Loader', 'input', 'required', 'ckpt_name', 0])
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

function handleOptionalValueChange(itemId: string, value: string | number) {
  const target = optionalItems.value.find((item) => item.id === itemId)
  if (!target) {
    return
  }

  target.value = value
}
</script>

<template>
  <section id="generate-settings">
    <div class="mb-4">
      <label class="block text-sm font-medium mb-1">Positive Prompt</label>
      <div class="relative">
        <textarea
          ref="positiveTextareaRef"
          v-model="positive"
          placeholder="Enter your prompt here..."
          class="w-full p-2 border rounded-md resize-vertical"
          rows="4"
        ></textarea>
        <AutoComplete v-model="positive" :target-element="positiveTextareaRef" />
      </div>
    </div>

    <div class="flex gap-4 mb-4">
      <div class="w-1/3">
        <label class="block text-sm font-medium mb-1">Batch Count</label>
        <input
          v-model.number="batchCount"
          type="number"
          min="1"
          max="10"
          class="w-full p-2 border rounded-md"
        />
      </div>

      <div class="w-1/3">
        <label class="block text-sm font-medium mb-1">Queue Count</label>
        <div class="p-2 flex gap-4">
          <span>{{ queueCount }}</span>
          <span class="c-loading" :data-generating="queueCount > 0 ? 'true' : 'false'">★</span>
        </div>
      </div>

      <WeightButtons v-model="positive" :target-element="positiveTextareaRef" />
    </div>

    <div class="flex gap-4 mb-2">
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        :disabled="loading || isGenerating || !workflowData || !workflowConfig"
        @click="generateImages"
      >
        {{ isGenerating ? 'Generating...' : 'Generate' }}
      </button>

      <button class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600" disabled>Cancel</button>

      <button class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600" disabled>
        Clear Preview
      </button>
    </div>

    <p v-if="generationMessage" class="mb-4 text-sm text-gray-600">{{ generationMessage }}</p>

    <details class="mb-6">
      <summary>Advanced Settings</summary>

      <div class="flex gap-4 mb-6" style="flex-wrap: wrap">
        <div class="w-full">
          <label class="block text-sm font-medium mb-1">Negative Prompt</label>
          <div class="relative">
            <textarea
              ref="negativeTextareaRef"
              v-model="negative"
              placeholder="Enter negative prompt here..."
              class="w-full p-2 border rounded-md resize-vertical"
              rows="2"
            ></textarea>
            <AutoComplete v-model="negative" :target-element="negativeTextareaRef" />
          </div>
        </div>

        <div class="w-full">
          <label class="block text-sm font-medium mb-1">Checkpoint</label>
          <select v-model="currentCheckpoint" class="w-full p-2 border rounded-md">
            <option v-for="cp in checkpointList" :key="cp" :value="cp">
              {{ cp }}
            </option>
          </select>
        </div>

        <template v-for="item in optionalItems" :key="item.id">
          <DynamicInput
            :type="item.type"
            :title="item.title"
            :value="item.value"
            :options="item.options"
            @update:value="(value) => handleOptionalValueChange(item.id, value)"
          />
        </template>

        <div class="w-full">
          <label class="block text-sm font-medium mb-1">Workflow</label>
          <select
            v-model="currentWorkflow"
            class="w-full p-2 border rounded-md"
            @change="handleWorkflowChange"
          >
            <option v-for="wf in workflowList" :key="wf" :value="wf">{{ wf }}</option>
          </select>
        </div>

        <p v-if="loading" class="w-full text-sm text-gray-500">設定を読み込み中です...</p>
        <p v-if="errorMessage" class="w-full text-sm text-red-600">{{ errorMessage }}</p>
      </div>
    </details>
  </section>
</template>
