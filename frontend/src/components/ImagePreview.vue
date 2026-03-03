<script setup lang="ts">
interface Props {
  images: string[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'open', index: number): void
  (event: 'clear'): void
}>()
</script>

<template>
  <div v-if="props.images.length > 0" class="preview-container">
    <div class="preview-header">
<!--      <h2 class="preview-title">Preview</h2> -->
      <button
        class="px-3 py-1 text-xs bg-gray-500 text-white rounded-md hover:bg-gray-600"
        @click="emit('clear')"
      >
        x
      </button>
    </div>
    <div class="preview-grid">
      <div
        v-for="(image, index) in props.images"
        :key="index"
        class="preview-item"
        @click="emit('open', index)"
      >
        <img :src="image" class="preview-img" alt="Preview image" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.preview-container {
  margin-top: 1rem;
  border: 1px solid #c4cad7;
  border-radius: 10px;
  padding: 12px;
}

.preview-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 0.5rem;
}

.preview-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat( auto-fill, minmax(70px, 1fr));
  gap: 0.5rem;
}

.preview-item {
  cursor: pointer;
  border-radius: 0.375rem;
  overflow: hidden;
  transition: opacity 0.15s;
}

.preview-item:hover {
  opacity: 0.8;
}

.preview-img {
  width: 100%;
  height: auto;
  display: block;
  object-fit: cover;
  aspect-ratio: 1 / 1;
}
</style>
