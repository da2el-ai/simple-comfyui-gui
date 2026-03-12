<script setup lang="ts">
import { ref } from 'vue'
import SearchListDialog from './SearchListDialog.vue'

defineProps<{
  loraList: string[]
}>()

const emit = defineEmits<{
  select: [loraTag: string]
}>()

const dialogRef = ref<InstanceType<typeof SearchListDialog> | null>(null)

/** 表示用：拡張子 .safetensors を除去 */
function displayName(name: string): string {
  return name.replace(/\.safetensors$/i, '')
}

/** ダイアログを開く */
function open(): void {
  dialogRef.value?.open()
}

/** ダイアログを閉じる */
function close(): void {
  dialogRef.value?.close()
}

function handleSelect(name: string): void {
  emit('select', `<lora:${name}:1>`)
}

defineExpose({ open, close })
</script>

<template>
  <SearchListDialog
    ref="dialogRef"
    :items="loraList"
    empty-message="一致するLoRAが見つかりません"
    @select="handleSelect"
  >
    <template #item="{ item }">{{ displayName(item) }}</template>
  </SearchListDialog>
</template>
