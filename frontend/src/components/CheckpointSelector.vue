<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  checkpointList: string[]
  modelValue: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)
const searchQuery = ref('')

/** 表示用：拡張子 .safetensors を除去 */
function displayName(cp: string): string {
  return cp.replace(/\.safetensors$/i, '')
}

const filteredList = computed(() => {
  const q = searchQuery.value.toLowerCase()
  if (!q) return props.checkpointList
  return props.checkpointList.filter((cp) => cp.toLowerCase().includes(q))
})

function openDialog(): void {
  searchQuery.value = ''
  dialogRef.value?.showModal()
}

function closeDialog(): void {
  dialogRef.value?.close()
}

function selectCheckpoint(cp: string): void {
  emit('update:modelValue', cp)
  closeDialog()
}

/** ダイアログ外クリック（backdrop クリック）で閉じる */
function onDialogClick(event: MouseEvent): void {
  if (event.target === dialogRef.value) {
    closeDialog()
  }
}
</script>

<template>
  <div>
    <!-- トリガーボタン：現在の選択を表示 -->
    <button type="button" class="cp-trigger" @click="openDialog">
      <span class="cp-trigger-label">
        {{ props.modelValue ? displayName(props.modelValue) : 'Checkpoint を選択...' }}
      </span>
      <span class="cp-trigger-icon">▾</span>
    </button>

    <!-- モーダルダイアログ -->
    <dialog ref="dialogRef" class="cp-dialog" @click="onDialogClick">
      <div class="cp-dialog-inner">
        <div class="cp-dialog-header">
<!--          <h2 class="cp-dialog-title">Checkpoint</h2> -->
          <button type="button" class="cp-close-btn" @click="closeDialog">&times;</button>
        </div>

        <input
          v-model="searchQuery"
          type="text"
          placeholder="検索..."
          class="cp-search"
          autofocus
        />

        <ul class="cp-list">
          <li
            v-for="cp in filteredList"
            :key="cp"
            class="cp-item"
            :class="{ 'cp-item--active': cp === props.modelValue }"
            @click="selectCheckpoint(cp)"
          >
            {{ displayName(cp) }}
          </li>
          <li v-if="filteredList.length === 0" class="cp-empty">
            一致するチェックポイントが見つかりません
          </li>
        </ul>
      </div>
    </dialog>
  </div>
</template>

<style scoped>
/* トリガーボタン */
.cp-trigger {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  background: #fff;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  cursor: pointer;
  text-align: left;
  font: inherit;
}

.cp-trigger:hover {
  border-color: #9ca3af;
}

.cp-trigger-label {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
  color: #1f2937;
}

.cp-trigger-icon {
  margin-left: 0.5rem;
  color: #6b7280;
  flex-shrink: 0;
}

/* ダイアログ */
.cp-dialog {
  width: 100%;
  max-width: 50rem;
  height: 80vh;
  padding: 0;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.cp-dialog::backdrop {
  background: rgba(0, 0, 0, 0.4);
}

.cp-dialog-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
  box-sizing: border-box;
}

.cp-dialog-header {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
}

.cp-dialog-title {
  font-size: 1.125rem;
  font-weight: 600;
  margin: 0;
}

.cp-close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  color: #6b7280;
  padding: 0 4px;
}

.cp-close-btn:hover {
  color: #1f2937;
}

/* 検索入力 */
.cp-search {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  font: inherit;
  font-size: 0.875rem;
  margin-bottom: 0.75rem;
  box-sizing: border-box;
}

.cp-search:focus {
  outline: none;
  border-color: #3b82f6;
}

/* リスト */
.cp-list {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  flex: 1;
}

.cp-item {
  padding: 0.625rem 0.75rem;
  cursor: pointer;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  color: #1f2937;
  word-break: break-all;
  transition: background 0.1s;
}

.cp-item:hover {
  background: #f3f4f6;
}

.cp-item--active {
  background: #dbeafe;
  color: #1d4ed8;
  font-weight: 500;
}

.cp-item--active:hover {
  background: #bfdbfe;
}

.cp-empty {
  padding: 1rem;
  text-align: center;
  color: #9ca3af;
  font-size: 0.875rem;
}
</style>
