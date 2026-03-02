<script setup lang="ts">
type InputType = 'list' | 'text' | 'number'

interface Props {
  type: InputType
  title: string
  value: string | number
  options?: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'update:value', value: string | number): void
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
  </div>
</template>
