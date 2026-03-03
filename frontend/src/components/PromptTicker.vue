<script setup lang="ts">
defineProps<{
  message: string
  visible: boolean
}>()
</script>

<template>
  <Transition name="ticker">
    <div v-if="visible" class="prompt-ticker">{{ message }}</div>
  </Transition>
</template>

<style scoped>
.prompt-ticker {
  position: fixed;
  bottom: calc(50vh + 12px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 30, 0.88);
  color: #fff;
  padding: 6px 20px;
  border-radius: 20px;
  font-size: 0.85rem;
  pointer-events: none;
  white-space: nowrap;
  z-index: 9999;
}

.ticker-enter-active,
.ticker-leave-active {
  transition:
    opacity 0.3s,
    transform 0.3s;
}

.ticker-enter-from,
.ticker-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
