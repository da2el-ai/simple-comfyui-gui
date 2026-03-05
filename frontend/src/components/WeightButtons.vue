<script setup lang="ts">
import { computed } from 'vue'
import { useWeightAdjust } from '../composables/useWeightAdjust'

const props = defineProps<{
  targetElement?: HTMLTextAreaElement | null
}>()

const modelValue = defineModel<string>({ default: '' })
const targetRef = computed(() => props.targetElement ?? null)
const { setWeight } = useWeightAdjust(modelValue, targetRef)
</script>

<template>
  <div class="w-1/3 flex gap-4">
    <button
      type="button"
      class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
      @click="setWeight(0.1)"
    >
      ▲
    </button>

    <button
      type="button"
      class="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
      @click="setWeight(-0.1)"
    >
      ▼
    </button>
  </div>
</template>
