<script setup lang="ts">
import DynamicInputImage from './DynamicInputImage.vue'

type InputType = 'list' | 'text' | 'number' | 'textarea' | 'image' | 'mask'

interface Props {
  type: InputType
  title: string
  value: string | number
  options?: string[]
  imageFile?: File | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:value', value: string | number): void
  (event: 'update:image-file', value: File | null): void
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
      v-if="props.type === 'image' || props.type === 'mask'"
      :file="props.imageFile ?? null"
      :hidden-value="props.value"
      accept="image/*"
      :drop-text="props.type === 'mask' ? 'ここにマスク画像をドラッグ&ドロップ' : 'ここに画像をドラッグ&ドロップ'"
      :button-text="props.type === 'mask' ? 'マスク画像を選択' : '画像を選択'"
      @update:file="(file) => emit('update:image-file', file)"
      @clear-hidden-value="emit('update:value', '')"
    />
  </div>
</template>
