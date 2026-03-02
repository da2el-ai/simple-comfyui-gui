<script setup lang="ts">
defineProps<{
  targetElement?: HTMLTextAreaElement | null
}>()

const modelValue = defineModel<string>({ default: '' })
</script>

<template>
  <div class="w-1/3 flex gap-4">
    <button type="button" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400" disabled>
      ▲
    </button>

    <button type="button" class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400" disabled>
      ▼
    </button>
    <input v-model="modelValue" type="hidden" />
  </div>
</template>
