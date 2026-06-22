<script setup lang="ts">
import { ref } from 'vue'
import SearchListDialog from './SearchListDialog.vue'

// 検索付きリスト選択コンポーネント。
// Checkpoint に限らず、Diffusion Model など任意のローダー系リスト入力で汎用的に使う
// （DynamicInput の type: search から呼び出される）。
const props = defineProps<{
  options: string[]
  modelValue: string
  placeholder?: string
}>()

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const dialogRef = ref<InstanceType<typeof SearchListDialog> | null>(null)

/** 表示用：拡張子 .safetensors を除去 */
function displayName(cp: string): string {
  return cp.replace(/\.safetensors$/i, '')
}

function openDialog(): void {
  dialogRef.value?.open()
}

function selectItem(item: string): void {
  emit('update:modelValue', item)
}
</script>

<template>
  <div>
    <!-- トリガーボタン：現在の選択を表示 -->
    <button type="button" class="cp-trigger" @click="openDialog">
      <span class="cp-trigger-label">
        {{ props.modelValue ? displayName(props.modelValue) : (props.placeholder ?? '選択...') }}
      </span>
      <span class="cp-trigger-icon">▾</span>
    </button>

    <!-- モーダルダイアログ -->
    <SearchListDialog
      ref="dialogRef"
      :items="options"
      :selected-value="modelValue"
      empty-message="一致する項目が見つかりません"
      @select="selectItem"
    >
      <template #item="{ item }">{{ displayName(item) }}</template>
    </SearchListDialog>
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
  min-width: 0;
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
</style>
