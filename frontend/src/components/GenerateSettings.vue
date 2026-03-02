<script setup lang="ts">
import { ref } from 'vue'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'
import type { TDynamicInputItem } from '../types'

const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const queueCount = ref(0)
const positiveTextareaRef = ref<HTMLTextAreaElement | null>(null)
const negativeTextareaRef = ref<HTMLTextAreaElement | null>(null)

const checkpointList = ['sdxl_base_1.0.safetensors', 'animagine-xl-4.0.safetensors']
const workflowList = ['simple_t2i', 'simple_t2i_eagle']
const currentCheckpoint = ref(checkpointList[0])
const currentWorkflow = ref(workflowList[0])

const optionalItems: TDynamicInputItem[] = [
  {
    id: 'size_preset',
    title: 'Image Size Preset',
    type: 'list',
    options: ['square_1024', 'portrait_832x1216', 'landscape_1216x832'],
    value: 'square_1024'
  },
  {
    id: 'width',
    title: 'Width',
    type: 'number',
    options: [],
    value: 1024
  },
  {
    id: 'height',
    title: 'Height',
    type: 'number',
    options: [],
    value: 1024
  },
  {
    id: 'memo',
    title: 'Memo',
    type: 'text',
    options: [],
    value: 'sample memo'
  }
]
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
          max="50"
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
            <option v-for="cp in checkpointList" :key="cp" :value="cp">{{ cp }}</option>
          </select>
        </div>

        <template v-for="item in optionalItems" :key="item.id">
          <DynamicInput
            :type="item.type"
            :title="item.title"
            :value="item.value"
            :options="item.options"
          />
        </template>

        <div class="w-full">
          <label class="block text-sm font-medium mb-1">Workflow</label>
          <select v-model="currentWorkflow" class="w-full p-2 border rounded-md">
            <option v-for="wf in workflowList" :key="wf" :value="wf">{{ wf }}</option>
          </select>
        </div>
      </div>
    </details>
  </section>
</template>
