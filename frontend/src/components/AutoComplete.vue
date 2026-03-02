<script setup lang="ts">
defineProps<{
  targetElement?: HTMLTextAreaElement | null
}>()

const modelValue = defineModel<string>({ default: '' })

const dummySuggestions = ['1girl', 'solo', 'highres']
</script>

<template>
  <div class="autocomplete-placeholder">
    <div class="suggestions-container">
      <div v-for="tag in dummySuggestions" :key="tag" class="suggestion-item">
        {{ tag }}
      </div>
      <div class="suggestion-note">AutoComplete 機能は未実装（表示のみ）</div>
    </div>

    <input v-model="modelValue" type="hidden" />
  </div>
</template>

<style scoped>
.autocomplete-placeholder {
  margin-top: 0.25rem;
}

.suggestions-container {
  z-index: 10;
  background-color: white;
  border: 1px solid #ccc;
  border-radius: 0.25rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  max-height: 120px;
  overflow-y: auto;
  width: auto;
  min-width: 150px;
}

.suggestion-item {
  padding: 0.5rem;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
}

.suggestion-note {
  padding: 0.5rem;
  font-size: 0.75rem;
  color: #6b7280;
}
</style>
