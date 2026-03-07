<script setup lang="ts">
import DynamicInputImage from './DynamicInputImage.vue'

type InputType = 'list' | 'text' | 'number' | 'textarea' | 'image' | 'seed'

interface Props {
  type: InputType
  title: string
  value: string | number
  options?: string[]
  imageFile?: File | null
  imageMaskOverlay?: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:value', value: string | number): void
  (event: 'update:image-file', value: File | null): void
  (event: 'open-mask-editor'): void
}>()
</script>

<template>
  <div class="w-full">
    <label class="block text-sm font-medium mb-1">{{ props.title }}</label>

    <select
      v-if="props.type === 'list' && props.options"
      :value="props.value"
      @input="emit('update:value', ($event.target as HTMLSelectElement).value)"
      class="w-full p-2 border rounded-md"
    >
      <option v-for="option in props.options" :key="option" :value="option">{{ option }}</option>
    </select>

    <input
      v-if="props.type === 'text'"
      type="text"
      :value="props.value"
      @input="emit('update:value', ($event.target as HTMLInputElement).value)"
      class="w-full p-2 border rounded-md"
    />

    <input
      v-if="props.type === 'number'"
      type="number"
      :value="props.value"
      @input="emit('update:value', Number(($event.target as HTMLInputElement).value))"
      class="w-full p-2 border rounded-md"
    />

    <textarea
      v-if="props.type === 'textarea'"
      :value="props.value"
      @input="emit('update:value', ($event.target as HTMLTextAreaElement).value)"
      class="w-full p-2 border rounded-md resize-vertical"
      rows="3"
    />

    <DynamicInputImage
      v-if="props.type === 'image'"
      :file="props.imageFile ?? null"
      :hidden-value="props.value"
      :overlay-data-url="props.imageMaskOverlay ?? ''"
      :preview-clickable="true"
      accept="image/*"
      drop-text="ここに画像をドラッグ&ドロップ"
      button-text="画像を選択"
      @update:file="(file) => emit('update:image-file', file)"
      @clear-hidden-value="emit('update:value', '')"
      @preview-click="emit('open-mask-editor')"
    />
  </div>
</template>
