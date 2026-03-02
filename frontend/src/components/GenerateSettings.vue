<script setup lang="ts">
import { ref } from 'vue'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'

const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const queueCount = ref(0)

const checkpointList = ['checkpoint_a.safetensors', 'checkpoint_b.safetensors']
const workflowList = ['dummy_workflow']
const currentCheckpoint = ref(checkpointList[0])
const currentWorkflow = ref(workflowList[0])

type OptionalItem = {
  id: string
  title: string
  type: 'list' | 'text' | 'number'
  options: string[]
  value: string | number
}

const optionalItems: OptionalItem[] = [
  {
    id: 'seed_mode',
    title: 'Seed Mode',
    type: 'list',
    options: ['random', 'fixed'],
    value: 'random'
  },
  {
    id: 'steps',
    title: 'Steps',
    type: 'number',
    options: [],
    value: 20
  }
]
</script>

<template>
  <section id="generate-settings" class="card">
    <div class="mb-4">
      <label class="block text-sm font-medium mb-1">Positive Prompt</label>
      <div class="relative">
        <textarea
          v-model="positive"
          placeholder="Enter your prompt here..."
          class="w-full p-2 border rounded-md resize-vertical"
          rows="4"
        ></textarea>
        <AutoComplete v-model="positive" />
      </div>
    </div>

    <div class="flex gap-4 mb-4">
      <div class="w-1-3">
        <label class="block text-sm font-medium mb-1">Batch Count</label>
        <input
          v-model.number="batchCount"
          type="number"
          min="1"
          max="10"
          class="w-full p-2 border rounded-md"
        />
      </div>

      <div class="w-1-3">
        <label class="block text-sm font-medium mb-1">Queue Count</label>
        <div class="p-2 flex gap-4">
          <span>{{ queueCount }}</span>
          <span class="c-loading" :data-generating="queueCount > 0 ? 'true' : 'false'">★</span>
        </div>
      </div>

      <WeightButtons v-model="positive" />
    </div>

    <div class="flex gap-4 mb-6">
      <button class="btn btn-primary" disabled>Generate</button>
      <button class="btn btn-danger" disabled>Cancel</button>
      <button class="btn btn-muted" disabled>Clear Preview</button>
    </div>

    <details class="mb-6" open>
      <summary>Advanced Settings</summary>

      <div class="flex gap-4 mb-6 wrap">
        <div class="w-full">
          <label class="block text-sm font-medium mb-1">Negative Prompt</label>
          <div class="relative">
            <textarea
              v-model="negative"
              placeholder="Enter negative prompt here..."
              class="w-full p-2 border rounded-md resize-vertical"
              rows="2"
            ></textarea>
            <AutoComplete v-model="negative" />
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
