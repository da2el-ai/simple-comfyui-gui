<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

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

onBeforeUnmount(() => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
})

function openFilePicker(): void {
  fileInputRef.value?.click()
}

function handleFileInput(event: Event): void {
  const files = (event.target as HTMLInputElement).files
  if (!files || files.length === 0) {
    return
  }
  emit('clear-hidden-value')
  emit('update:file', files[0])
}

function clearFile(): void {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
  emit('update:file', null)
  emit('clear-hidden-value')
}

function handleDragOver(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false
}

function handleDrop(event: DragEvent): void {
  event.preventDefault()
  isDragging.value = false

  const droppedFile = event.dataTransfer?.files?.[0]
  if (!droppedFile) {
    return
  }

  const acceptedPrefix = props.accept.replace('/*', '/').trim()
  if (acceptedPrefix && !props.accept.includes('*') && droppedFile.type !== props.accept) {
    return
  }
  if (props.accept.includes('/*') && !droppedFile.type.startsWith(acceptedPrefix)) {
    return
  }

  emit('clear-hidden-value')
  emit('update:file', droppedFile)
}
</script>

<template>
  <div class="w-full">
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
      :class="isDragging ? 'border-blue-500' : ''"
      @dragover="handleDragOver"
      @dragleave="handleDragLeave"
      @drop="handleDrop"
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
