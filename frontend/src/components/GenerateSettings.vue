<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AutoComplete from './AutoComplete.vue'
import DynamicInput from './DynamicInput.vue'
import MaskEditor from './MaskEditor.vue'
import WeightButtons from './WeightButtons.vue'
import ImagePreview from './ImagePreview.vue'
import ImageGallery from './ImageGallery.vue'
import CheckpointSelector from './CheckpointSelector.vue'
import PromptSelector from './PromptSelector.vue'
import { useGenerateSettings } from '../composables/useGenerateSettings'
import { useImageGeneration } from '../composables/useImageGeneration'
import { loadSettings, saveSettings, saveOptionalValues } from '../composables/useLocalSettings'
import { useWeightAdjust } from '../composables/useWeightAdjust'
import { uploadImage, uploadImageWithOptions, uploadMask } from '../services/backendApi'
import type { ComfyOriginalRef } from '../types/api'

// --- UI 専有の状態 ---
const positive = ref('')
const negative = ref('')
const batchCount = ref(1)
const imageFileMap = ref<Record<string, File | null>>({})
const imageOriginalRefMap = ref<Record<string, ComfyOriginalRef | null>>({})
const maskOverlayDataUrl = ref('')
const isMaskEditorOpen = ref(false)
const activeImageInputId = ref('')
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

async function handleOptionalImageFileChange(itemId: string, imageFile: File | null): Promise<void> {
  imageFileMap.value = {
    ...imageFileMap.value,
    [itemId]: imageFile
  }

  if (!imageFile) {
    handleOptionalValueChange(itemId, '')
    imageOriginalRefMap.value = {
      ...imageOriginalRefMap.value,
      [itemId]: null
    }
    clearMaskState()
    return
  }

  if (!settings.endpoint.value) {
    return
  }

  try {
    const uploaded = await uploadImage(settings.endpoint.value, imageFile)
    const normalizedSubfolder = uploaded.subfolder ? `${uploaded.subfolder}/` : ''
    const uploadedPath = `${normalizedSubfolder}${uploaded.name}`

    handleOptionalValueChange(itemId, uploadedPath)
    imageOriginalRefMap.value = {
      ...imageOriginalRefMap.value,
      [itemId]: {
        filename: uploaded.name,
        subfolder: uploaded.subfolder,
        type: uploaded.type
      }
    }

  } catch (error) {
    handleOptionalValueChange(itemId, '')
  }

  clearMaskState()
}

function openMaskEditor(itemId: string): void {
  if (!imageFileMap.value[itemId]) {
    return
  }
  activeImageInputId.value = itemId
  isMaskEditorOpen.value = true
}

function closeMaskEditor(): void {
  isMaskEditorOpen.value = false
}

async function handleMaskSave(payload: { maskFile: File; overlayDataUrl: string }): Promise<void> {
  maskOverlayDataUrl.value = payload.overlayDataUrl

  if (!settings.endpoint.value) {
    isMaskEditorOpen.value = false
    return
  }

  const originalRef = imageOriginalRefMap.value[activeImageInputId.value] ?? null
  if (!originalRef) {
    isMaskEditorOpen.value = false
    return
  }

  const sourceImageFile = imageFileMap.value[activeImageInputId.value] ?? null
  if (!sourceImageFile) {
    isMaskEditorOpen.value = false
    return
  }

  try {
    const timestamp = Date.now()

    const clipspaceMaskFile = await renameFile(payload.maskFile, `clipspace-mask-${timestamp}.png`)
    const clipspacePaintFile = await createTransparentImageFile(sourceImageFile, `clipspace-paint-${timestamp}.png`)
    const clipspacePaintedFile = await renameFile(
      sourceImageFile,
      `clipspace-painted-${timestamp}.png`
    )
    const clipspacePaintedMaskedFile = await renameFile(
      payload.maskFile,
      `clipspace-painted-masked-${timestamp}.png`
    )

    await uploadMask(
      settings.endpoint.value,
      clipspaceMaskFile,
      originalRef,
      'input',
      'clipspace'
    )

    await uploadImageWithOptions(settings.endpoint.value, clipspacePaintFile, {
      uploadType: 'input',
      subfolder: 'clipspace',
      originalRef
    })

    const uploadedPainted = await uploadImageWithOptions(settings.endpoint.value, clipspacePaintedFile, {
      uploadType: 'input',
      subfolder: 'clipspace',
      originalRef
    })

    const secondOriginalRef: ComfyOriginalRef = {
      filename: uploadedPainted.name,
      subfolder: uploadedPainted.subfolder,
      type: uploadedPainted.type
    }

    const uploadedMask2 = await uploadMask(
      settings.endpoint.value,
      clipspacePaintedMaskedFile,
      secondOriginalRef,
      'input',
      'clipspace'
    )

    const normalizedMaskedSubfolder = uploadedMask2.subfolder ? `${uploadedMask2.subfolder}/` : ''
    const maskedImagePath = `${normalizedMaskedSubfolder}${uploadedMask2.name}`

    handleOptionalValueChange(activeImageInputId.value, maskedImagePath)

  } catch {
  }

  isMaskEditorOpen.value = false
}

function clearMaskState(): void {
  maskOverlayDataUrl.value = ''
}

async function renameFile(source: File, nextName: string): Promise<File> {
  const content = await source.arrayBuffer()
  return new File([content], nextName, { type: source.type || 'image/png' })
}

function createTransparentImageFile(sourceImageFile: File, fileName: string): Promise<File> {
  return createCanvasFile(sourceImageFile, fileName, (ctx, width, height) => {
    ctx.clearRect(0, 0, width, height)
  })
}

async function createCanvasFile(
  sourceImageFile: File,
  fileName: string,
  painter: (ctx: CanvasRenderingContext2D, width: number, height: number) => void | Promise<void>
): Promise<File> {
  const image = await loadImageFromFile(sourceImageFile)
  const width = image.naturalWidth || image.width
  const height = image.naturalHeight || image.height

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('canvas contextの取得に失敗しました')
  }

  await painter(ctx, width, height)

  const blob = await canvasToBlob(canvas)
  return new File([blob], fileName, { type: 'image/png' })
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file)
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('画像ファイルの読み込みに失敗しました'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('画像出力に失敗しました'))
        return
      }
      resolve(blob)
    }, 'image/png')
  })
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
            :image-file="imageFileMap[item.id] ?? null"
            :image-mask-overlay="item.type === 'image' ? maskOverlayDataUrl : ''"
            @update:value="(value) => handleOptionalValueChange(item.id, value)"
            @update:image-file="(file) => handleOptionalImageFileChange(item.id, file)"
            @open-mask-editor="openMaskEditor(item.id)"
          />
        </template>

        <MaskEditor
          :open="isMaskEditorOpen"
          :image-file="imageFileMap[activeImageInputId] ?? null"
          :initial-mask-data-url="maskOverlayDataUrl"
          @close="closeMaskEditor"
          @save="handleMaskSave"
        />

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
