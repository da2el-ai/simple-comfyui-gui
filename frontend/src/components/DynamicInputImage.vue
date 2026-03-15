<script lang="ts">
// モジュールスコープ: 全インスタンスで共有
import { shallowRef } from 'vue'

type InstanceEntry = {
  receivePaste: (file: File) => void
}

const activeEntryRef = shallowRef<InstanceEntry | null>(null)
const instanceEntries: InstanceEntry[] = []

/**
 * window の paste イベントを処理する。
 * input/textarea/contenteditable にフォーカス中は何もしない。
 * クリップボードに画像がなければ何もしない。
 * アクティブなインスタンスへ画像を渡す。アクティブがなければ先頭インスタンスへ渡す。
 * @param event ClipboardEvent。
 */
function handleGlobalPaste(event: ClipboardEvent): void {
  const active = document.activeElement
  if (
    active &&
    (active.tagName === 'INPUT' ||
      active.tagName === 'TEXTAREA' ||
      (active as HTMLElement).isContentEditable)
  ) {
    return
  }

  const items = event.clipboardData?.items
  if (!items) return

  let imageFile: File | null = null
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      imageFile = item.getAsFile()
      break
    }
  }
  if (!imageFile) return

  const target = activeEntryRef.value ?? instanceEntries[0]
  target?.receivePaste(imageFile)
}
</script>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

interface Props {
  file: File | null
  hiddenValue: string | number
  overlayDataUrl?: string
  previewClickable?: boolean
  accept?: string
  dropText?: string
  buttonText?: string
}

const props = withDefaults(defineProps<Props>(), {
  overlayDataUrl: '',
  previewClickable: false,
  accept: 'image/*',
  dropText: 'ここに画像をドラッグ&ドロップ',
  buttonText: '画像を選択'
})

const emit = defineEmits<{
  (event: 'update:file', value: File | null): void
  (event: 'clear-hidden-value'): void
  (event: 'preview-click'): void
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const previewUrl = ref('')
const isDragging = ref(false)

/**
 * このインスタンスのペースト受け取り口。
 * accept prop に合致しない MIME タイプは無視する。
 */
const entry: InstanceEntry = {
  /**
   * ペーストされた画像ファイルを受け取り、親へ emit する。
   * @param file ペーストされた画像ファイル。
   */
  receivePaste(file: File) {
    const acceptedPrefix = props.accept.replace('/*', '/').trim()
    if (acceptedPrefix && !props.accept.includes('*') && file.type !== props.accept) return
    if (props.accept.includes('/*') && !file.type.startsWith(acceptedPrefix)) return
    emit('clear-hidden-value')
    emit('update:file', file)
  }
}

const isActive = computed(() => activeEntryRef.value === entry)

/**
 * インスタンスをグローバル一覧へ登録する。
 * 最初のインスタンスがマウントされた時のみ window に paste リスナーを登録する。
 */
onMounted(() => {
  instanceEntries.push(entry)
  if (instanceEntries.length === 1) {
    window.addEventListener('paste', handleGlobalPaste)
  }
})

/**
 * プレビュー用 Object URL を解放してメモリリークを防ぐ。
 * グローバル一覧からこのインスタンスを除去する。
 * アクティブだった場合は選択をリセットする。
 * 全インスタンスがなくなった時は paste リスナーを解除する。
 */
onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  const index = instanceEntries.indexOf(entry)
  if (index !== -1) instanceEntries.splice(index, 1)
  if (activeEntryRef.value === entry) activeEntryRef.value = null
  if (instanceEntries.length === 0) {
    window.removeEventListener('paste', handleGlobalPaste)
  }
})

/**
 * props.file の変更を監視してプレビュー URL を更新する。
 * 古い Object URL は都度解放する。immediate: true で初期値も処理する。
 */
watch(
  () => props.file,
  (file) => {
    if (previewUrl.value) {
      URL.revokeObjectURL(previewUrl.value)
      previewUrl.value = ''
    }
    if (file) {
      previewUrl.value = URL.createObjectURL(file)
    }
  },
  { immediate: true }
)

/**
 * このインスタンスをペースト対象としてアクティブ化する。
 * @returns なし。
 */
function setActive(): void {
  activeEntryRef.value = entry
}

/**
 * 非表示の file input を開いてファイル選択ダイアログを表示する。
 * @returns なし。
 */
function openFilePicker(): void {
  fileInputRef.value?.click()
}

/**
 * ファイル選択ダイアログで選んだファイルを親へ通知する。
 * @param event inputのchangeイベント。
 * @returns なし。
 */
function handleFileInput(event: Event): void {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) return
  emit('clear-hidden-value')
  emit('update:file', files[0])
}

/**
 * 選択中のファイルをクリアして親へ通知する。
 * @returns なし。
 */
function clearFile(): void {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  emit('update:file', null)
  emit('clear-hidden-value')
}

/**
 * ドラッグオーバー中のスタイルを有効化し、デフォルト動作を抑止する。
 * @param event DragEvent。
 * @returns なし。
 */
function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

/**
 * ドラッグオーバー中のスタイルを解除する。
 * @param event DragEvent。
 * @returns なし。
 */
function handleDragLeave(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
}

/**
 * ドロップされたファイルを検証して親へ通知する。
 * accept prop に合致しない MIME タイプは無視する。
 * @param event DragEvent。
 * @returns なし。
 */
function handleDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false

  const droppedFile = event.dataTransfer?.files?.[0]
  if (!droppedFile) return

  const acceptedPrefix = props.accept.replace('/*', '/').trim()
  if (acceptedPrefix && !props.accept.includes('*') && droppedFile.type !== props.accept) return
  if (props.accept.includes('/*') && !droppedFile.type.startsWith(acceptedPrefix)) return

  emit('clear-hidden-value')
  emit('update:file', droppedFile)
}
</script>

<template>
  <div class="rounded-md" style="max-width:30rem; background-color:var(--color_white-dark);">
    <input
      ref="fileInputRef"
      type="file"
      :accept="props.accept"
      class="hidden"
      @change="handleFileInput"
      style="display: none;"
    />

    <input type="hidden" :value="String(props.hiddenValue)" />

    <div
      class="relative w-full border rounded-md p-3"
      :class="[isDragging ? 'border-blue-500' : '', isActive ? 'paste-target' : '']"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
      @click="setActive"
      style="padding:.5rem"
    >
      <div style="display:flex; justify-content:flex-end;">
        <button
          v-if="props.file"
          type="button"
          class="btn-close"
          @click="clearFile"
        >
          &times;
        </button>
      </div>

      <div v-if="previewUrl" class="flex justify-center">
        <div class="relative inline-block">
          <img
            :src="previewUrl"
            alt="uploaded preview"
            class="max-h-60 rounded-md"
            :class="props.previewClickable ? 'cursor-pointer' : ''"
            @click="props.previewClickable ? emit('preview-click') : undefined"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          />
          <img
            v-if="props.overlayDataUrl"
            :src="props.overlayDataUrl"
            alt="mask overlay"
            class="absolute inset-0 max-h-60 rounded-md pointer-events-none"
            style="opacity: 0.5;"
            @click="props.previewClickable ? emit('preview-click') : undefined"
            @dragover="handleDragOver"
            @dragleave="handleDragLeave"
            @drop="handleDrop"
          />
        </div>
      </div>

      <div v-else class="text-sm text-gray-500 text-center py-6">
        {{ props.dropText }}
      </div>

      <div class="mt-3 flex justify-center">
        <button
          type="button"
          class="px-3 py-1 border rounded-md"
          @click="openFilePicker"
        >
          {{ props.buttonText }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.paste-target {
  border-color: var(--color_blue, #3b82f6);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color_blue, #3b82f6) 30%, transparent);
}
</style>
