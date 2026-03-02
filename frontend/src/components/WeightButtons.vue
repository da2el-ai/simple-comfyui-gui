<script setup lang="ts">
const modelValue = defineModel<string>({ default: '' })
</script>

<template>
  <div class="weight-buttons">
    <button type="button" class="btn btn-muted" disabled>▲</button>
    <button type="button" class="btn btn-muted" disabled>▼</button>
    <input v-model="modelValue" type="hidden" />
  </div>
</template>
