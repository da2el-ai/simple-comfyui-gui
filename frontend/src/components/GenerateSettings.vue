<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import WeightButtons from './WeightButtons.vue'
import ImagePreview from './ImagePreview.vue'
import ImageGallery from './ImageGallery.vue'
import CheckpointSelector from './CheckpointSelector.vue'
import PromptSelector from './PromptSelector.vue'
import { useGenerateSettings } from '../composables/useGenerateSettings'
import { useImageGeneration } from '../composables/useImageGeneration'
import { loadSettings, saveSettings, saveOptionalValues } from '../composables/useLocalSettings'
import { useWeightAdjust } from '../composables/useWeightAdjust'

// --- UI 専有の状態 ---
const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const isPositiveExpanded = ref(false)
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
const {
  isGenerating,
  generationMessage,
  queueCount,
  previewImages,
  generateImages,
  cancelGeneration,
  clearPreview
} = generation

// --- ギャラリー状態 ---
const showGallery = ref(false)
const selectedImageIndex = ref(0)

function openGallery(index: number): void {
  selectedImageIndex.value = index
  showGallery.value = true
}

function closeGallery(): void {
  showGallery.value = false
}

function togglePositiveExpand(): void {
  isPositiveExpanded.value = !isPositiveExpanded.value
}

// --- ウェイト調整（キーボードショートカット用） ---
const { setWeight } = useWeightAdjust(positive, positiveTextareaRef)

// --- キーボードショートカット ---
function handleKeyDown(event: KeyboardEvent): void {
  const isCtrl = event.ctrlKey || event.metaKey
  if (!isCtrl) return

  // ギャラリー表示中はギャラリー側のハンドラに任せる
  if (showGallery.value) return

  if (event.key === 'Enter') {
    event.preventDefault()
    if (!loading.value && !isGenerating.value && workflowData.value && workflowConfig.value) {
      void generateImages()
    }
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    void setWeight(0.1)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    void setWeight(-0.1)
  } else if (event.key === 'g') {
    event.preventDefault()
    if (previewImages.value.length > 0) {
      openGallery(0)
    }
  }
}

// どちらかのエラーメッセージを表示する
const errorMessage = computed(
  () => settings.errorMessage.value || generation.errorMessage.value
)

onMounted(async () => {
  // 保存済み設定を読み込んで UI 状態に反映する
  const saved = loadSettings()
  positive.value = saved.positive
  negative.value = saved.negative
  batchCount.value = saved.batchCount

  // 設定管理 composable に保存済み選択を渡して初期化する
  await settings.initialize(saved)

  // 初期化後、設定変更の自動保存を開始する
  startAutoSave()

  // キーボードショートカットを登録する
  document.addEventListener('keydown', handleKeyDown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
})

function handleWorkflowChange(event: Event): void {
  if (isGenerating.value) {
    return
  }
  const nextWorkflow = (event.target as HTMLSelectElement).value
  void settings.changeWorkflow(nextWorkflow)
}

// --- 自動保存 ---

/** 各 ref の変更を監視して localStorage へ自動保存する */
function startAutoSave(): void {
  // プロンプト・基本設定の保存
  watch(
    [positive, negative, batchCount, currentCheckpoint, currentWorkflow],
    ([pos, neg, batch, checkpoint, workflow]) => {
      saveSettings({
        positive: pos,
        negative: neg,
        batchCount: batch,
        currentCheckpoint: checkpoint,
        currentWorkflow: workflow
      })
    }
  )

  // optional 項目（DynamicInput）の保存 — ワークフロー別に保存する
  watch(
    optionalItems,
    (items) => {
      if (!currentWorkflow.value || items.length === 0) return
      const values = Object.fromEntries(items.map((item) => [item.id, item.value]))
      saveOptionalValues(currentWorkflow.value, values)
    },
    { deep: true }
  )
}
</script>

<template>
  <section id="generate-settings">
    <p v-if="currentWorkflow" class="text-sm text-gray-400 -mt-3 mb-4">Workflow: {{ currentWorkflow }}</p>
    <div class="mb-4">
      <div class="prompt-label-row">
        <label class="block text-sm font-medium mb-1">Positive Prompt</label>
        <PromptSelector v-model="positive" :target-element="positiveTextareaRef" />
      </div>
      <div class="relative">
        <textarea
          ref="positiveTextareaRef"
          v-model="positive"
          placeholder="Enter your prompt here..."
          class="w-full p-2 border rounded-md resize-vertical"
          :style="{ height: isPositiveExpanded ? '20em' : '8em' }"
          rows="4"
        ></textarea>
        
        <button
          type="button"
          class="resize-btn text-sm"
          @click="togglePositiveExpand"
        >
          {{ isPositiveExpanded ? '◤' : '◢' }}
        </button>
      </div>
      <AutoComplete v-model="positive" :target-element="positiveTextareaRef" />
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

    <div class="flex gap-4 mb-4">
      <button
        class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
        :disabled="loading || isGenerating || !workflowData || !workflowConfig"
        @click="generateImages"
      >
        {{ isGenerating ? 'Generating...' : 'Generate' }}
      </button>

      <button class="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600 disabled:bg-gray-400"
        :disabled="!isGenerating"
        @click="cancelGeneration"
      >Cancel</button>

    </div>

    <p v-if="generationMessage" class="mb-4 text-sm text-gray-600">{{ generationMessage }}</p>

    <!-- プレビュー -->
    <ImagePreview :images="previewImages" @open="openGallery" @clear="clearPreview" class="mb-4" />

    <!-- ギャラリーモーダル -->
    <ImageGallery
      v-if="showGallery"
      :images="previewImages"
      :initial-index="selectedImageIndex"
      @close="closeGallery"
    />

    <details class="mb-6">
      <summary>Advanced Settings</summary>

      <div class="flex gap-4 mb-6" style="flex-wrap: wrap">
        <div class="w-full">
          <div class="prompt-label-row">
            <label class="block text-sm font-medium mb-1">Negative Prompt</label>
            <PromptSelector v-model="negative" :target-element="negativeTextareaRef" />
          </div>
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
          <CheckpointSelector
            v-model="currentCheckpoint"
            :checkpoint-list="checkpointList"
          />
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

<style scoped>
.prompt-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.resize-btn{
  position: absolute;
  padding: 0;
  right: 0.2rem;
  bottom: 0.5rem;
  border: none;
  background: transparent;
  font-size: .8rem;
  line-height: 1;
}
</style>
