<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface Props {
  images: string[]
  initialIndex: number
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (event: 'close'): void
}>()

const currentIndex = ref(props.initialIndex)

function nextImage(): void {
  currentIndex.value =
    currentIndex.value < props.images.length - 1 ? currentIndex.value + 1 : 0
}

function prevImage(): void {
  currentIndex.value =
    currentIndex.value > 0 ? currentIndex.value - 1 : props.images.length - 1
}

function selectImage(index: number): void {
  currentIndex.value = index
}

function handleKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') emit('close')
  else if (event.key === 'ArrowLeft') prevImage()
  else if (event.key === 'ArrowRight') nextImage()
}

watch(
  () => props.initialIndex,
  (newIndex) => {
    currentIndex.value = newIndex
  }
)

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.body.style.overflow = 'hidden'
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.style.overflow = ''
})
</script>

<template>
  <div class="gallery-overlay" @click="emit('close')">
    <div class="gallery-content" @click.stop>
      <!-- 閉じるボタン -->
      <button class="close-button" @click="emit('close')">&times;</button>

      <!-- 前へボタン -->
      <button
        v-if="props.images.length > 1"
        class="nav-button prev-button"
        @click="prevImage"
      >
        &#8249;
      </button>

      <!-- メイン画像 -->
      <div class="main-image-container">
        <img
          :src="props.images[currentIndex]"
          class="main-image"
          alt="Gallery image"
        />
      </div>

      <!-- 次へボタン -->
      <button
        v-if="props.images.length > 1"
        class="nav-button next-button"
        @click="nextImage"
      >
        &#8250;
      </button>

      <!-- サムネイル一覧 -->
      <div v-if="props.images.length > 1" class="thumbnails-container">
        <div
          v-for="(image, index) in props.images"
          :key="index"
          class="thumbnail"
          :class="{ active: index === currentIndex }"
          @click="selectImage(index)"
        >
          <img :src="image" alt="Thumbnail" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gallery-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.9);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.gallery-content {
  position: relative;
  width: 90%;
  height: 90%;
  display: flex;
  flex-direction: column;
}

.close-button {
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: white;
  font-size: 30px;
  cursor: pointer;
  z-index: 1010;
  line-height: 1;
  padding: 4px 8px;
}

.close-button:hover {
  color: #d1d5db;
}

.nav-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: white;
  font-size: 24px;
  padding: 0;
  cursor: pointer;
  z-index: 1010;
  border-radius: 50%;
  width: 50px;
  height: 50px;
  display: flex;
  justify-content: center;
  align-items: center;
  transition: background 0.2s;
}

.nav-button:hover {
  background: rgba(0, 0, 0, 0.7);
}

.prev-button {
  left: 10px;
}

.next-button {
  right: 10px;
}

.main-image-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.main-image {
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}

.thumbnails-container {
  display: flex;
  justify-content: center;
  gap: 10px;
  padding: 10px;
  overflow-x: auto;
  background-color: rgba(0, 0, 0, 0.5);
  margin-top: 10px;
  border-radius: 0.375rem;
}

.thumbnail {
  width: 80px;
  height: 80px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.2s, opacity 0.2s;
  overflow: hidden;
  flex: none;
  border-radius: 4px;
  opacity: 0.6;
}

.thumbnail:hover {
  opacity: 1;
}

.thumbnail.active {
  border-color: #42b883;
  opacity: 1;
}

.thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
