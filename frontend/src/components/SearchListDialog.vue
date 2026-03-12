<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  items: string[]
  selectedValue?: string
  emptyMessage?: string
}>()

const emit = defineEmits<{
  select: [value: string]
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const searchQuery = ref('')

const filteredList = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return props.items
  return props.items.filter((item) => item.toLowerCase().includes(q))
})

/** ダイアログを開く */
function open(): void {
  searchQuery.value = ''
  dialogRef.value?.showModal()
}

/** ダイアログを閉じる */
function close(): void {
  dialogRef.value?.close()
}

function selectItem(item: string): void {
  emit('select', item)
  close()
}

/** backdrop クリックで閉じる */
function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) {
    close()
  }
}

defineExpose({ open, close })
</script>

<template>
  <dialog ref="dialogRef" class="sld-dialog" @click="onDialogClick">
    <div class="sld-dialog-inner">
      <div class="sld-dialog-header">
        <button type="button" class="sld-close-btn" @click="close">&times;</button>
      </div>

      <input
        v-model="searchQuery"
        type="text"
        placeholder="検索..."
        class="sld-search"
        autofocus
      />

      <ul class="sld-list">
        <li
          v-for="item in filteredList"
          :key="item"
          class="sld-item"
          :class="{ 'sld-item--active': item === selectedValue }"
          @click="selectItem(item)"
        >
          <slot name="item" :item="item">{{ item }}</slot>
        </li>
        <li v-if="filteredList.length === 0" class="sld-empty">
          {{ emptyMessage ?? '一致する項目が見つかりません' }}
        </li>
      </ul>
    </div>
  </dialog>
</template>

<style scoped>
.sld-dialog {
  width: 100%;
  max-width: 50rem;
  height: 80vh;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.sld-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.sld-dialog-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
}

.sld-dialog-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.sld-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0 4px;
}

.sld-close-btn:hover {
  color: #1f2937;
}

.sld-search {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font: inherit;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
}

.sld-search:focus {
  outline: none;
  border-color: #3b82f6;
}

.sld-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.sld-item {
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1f2937;
  word-break: break-all;
  transition: background 0.1s;
}

.sld-item:hover {
  background: #f3f4f6;
}

.sld-item--active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 500;
}

.sld-item--active:hover {
  background: #bfdbfe;
}

.sld-empty {
  padding: 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>
