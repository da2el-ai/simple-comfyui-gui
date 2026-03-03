<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'
import { useGenerateSettings } from '../composables/useGenerateSettings'
import { useImageGeneration } from '../composables/useImageGeneration'

// --- UI 専有の状態 ---
const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const positiveTextareaRef = ref<HTMLTextAreaElement | null>(null)
const negativeTextareaRef = ref<HTMLTextAreaElement | null>(null)

// --- 設定管理 composable ---
const settings = useGenerateSettings()
const {
  loading,
  workflowConfig,
  workflowData,
  checkpointList,
  workflowList,
  currentCheckpoint,
  currentWorkflow,
  optionalItems,
  handleOptionalValueChange
} = settings

// --- 画像生成 composable ---
const generation = useImageGeneration({
  endpoint: settings.endpoint,
  workflowConfig: settings.workflowConfig,
  workflowData: settings.workflowData,
  currentCheckpoint: settings.currentCheckpoint,
  optionalItems: settings.optionalItems,
  positive,
  negative,
  batchCount
})
const { isGenerating, generationMessage, queueCount, generateImages } = generation

// どちらかのエラーメッセージを表示する
const errorMessage = computed(
  () => settings.errorMessage.value || generation.errorMessage.value
)

onMounted(async () => {
  await settings.initialize()
})

function handleWorkflowChange(event: Event): void {
  if (isGenerating.value) {
    return
  }
  const nextWorkflow = (event.target as HTMLSelectElement).value
  void settings.changeWorkflow(nextWorkflow)
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
