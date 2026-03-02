<script setup lang="ts">
type InputType = 'list' | 'text' | 'number'

const props = withDefaults(
  defineProps<{
    type: InputType
    title: string
    value: string | number
    options?: string[]
  }>(),
  {
    options: () => []
  }
)
</script>

<template>
  <div class="w-full">
    <label class="block text-sm font-medium mb-1">{{ props.title }}</label>

    <select v-if="props.type === 'list'" class="w-full p-2 border rounded-md" :value="props.value" disabled>
      <option v-for="option in props.options" :key="option" :value="option">{{ option }}</option>
    </select>

    <input
      v-else-if="props.type === 'number'"
      type="number"
      class="w-full p-2 border rounded-md"
      :value="props.value"
      disabled
    />

    <input v-else type="text" class="w-full p-2 border rounded-md" :value="props.value" disabled />
  </div>
</template>
