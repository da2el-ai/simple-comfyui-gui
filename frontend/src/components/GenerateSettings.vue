<script setup lang="ts">
import { onMounted, ref } from 'vue'
import yaml from 'js-yaml'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'
import type { TDynamicInputItem } from '../types'
import type { ComfyObjectInfo, WorkflowConfig, WorkflowConfigOptionalItem } from '../types/api'
import {
  fetchComfyObjectInfo,
  fetchComfyUIEndpoint,
  fetchWorkflowConfigText,
  fetchWorkflows
} from '../services/backendApi'

const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const queueCount = ref(0)
const positiveTextareaRef = ref<HTMLTextAreaElement | null>(null)
const negativeTextareaRef = ref<HTMLTextAreaElement | null>(null)

const loading = ref(false)
const errorMessage = ref('')
const endpoint = ref('')
const objectInfo = ref<ComfyObjectInfo | null>(null)

const checkpointList = ref<string[]>([])
const workflowList = ref<string[]>([])
const currentCheckpoint = ref('')
const currentWorkflow = ref('')
const optionalItems = ref<TDynamicInputItem[]>([])

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
      await loadWorkflowConfig(currentWorkflow.value)
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '初期化に失敗しました'
  } finally {
    loading.value = false
  }
}

async function handleWorkflowChange(event: Event) {
  const nextWorkflow = (event.target as HTMLSelectElement).value
  currentWorkflow.value = nextWorkflow
  await loadWorkflowConfig(nextWorkflow)
}

async function loadWorkflowConfig(workflowName: string) {
  const configText = await fetchWorkflowConfigText(workflowName)
  const parsedConfig = yaml.load(configText)

  if (!isWorkflowConfig(parsedConfig)) {
    throw new Error('workflow設定の形式が不正です')
  }

  optionalItems.value = buildOptionalItems(parsedConfig.optional, objectInfo.value)
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

    <div class="flex gap-4 mb-6">
      <button class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400" disabled>
        Generate
      </button>

      <button class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600" disabled>Cancel</button>

      <button class="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600" disabled>
        Clear Preview
      </button>
    </div>

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
