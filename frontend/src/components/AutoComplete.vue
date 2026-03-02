<script setup lang="ts">
const modelValue = defineModel<string>({ default: '' })
</script>

<template>
  <div class="autocomplete-placeholder">
    <span class="placeholder-text">AutoComplete（未実装）</span>
    <input v-model="modelValue" type="hidden" />
  </div>
</template>
