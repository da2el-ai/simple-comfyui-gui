<script setup lang="ts">
import { nextTick, ref } from 'vue'
import AutoComplete from './AutoComplete.vue'
import LoraSelector from './LoraSelector.vue'
import PromptSelector from './PromptSelector.vue'

withDefaults(defineProps<{
  placeholder?: string
  loraList?: string[]
}>(), {
  placeholder: '',
  loraList: () => []
})

const modelValue = defineModel<string>({ default: '' })

const textareaRef = ref<HTMLTextAreaElement | null>(null)
const isExpanded = ref(false)
const promptSelectorRef = ref<InstanceType<typeof PromptSelector> | null>(null)
const loraSelectorRef = ref<InstanceType<typeof LoraSelector> | null>(null)

defineExpose({ textareaRef })

/**
 * テキストエリアの拡大・縮小を切り替える。
 */
function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

/**
 * カーソルを指定方向に1文字移動する。
 */
function moveCursor(direction: 'left' | 'right'): void {
  const ta = textareaRef.value
  if (!ta) return
  const pos = ta.selectionStart ?? 0
  const next = direction === 'left'
    ? Math.max(0, pos - 1)
    : Math.min(ta.value.length, pos + 1)
  ta.setSelectionRange(next, next)
}

/**
 * Loraタグをカーソル位置の次の行に挿入する。
 */
function insertLora(loraTag: string): void {
  const ta = textareaRef.value
  if (!ta) return

  const value = ta.value
  const cursor = ta.selectionStart ?? value.length

  // カーソル位置から次の改行を探す
  let insertPos = value.indexOf('\n', cursor)
  if (insertPos === -1) {
    // 改行がない場合は末尾に追加
    insertPos = value.length
  }

  const before = value.slice(0, insertPos)
  const after = value.slice(insertPos)
  const newValue = before + '\n' + loraTag + after

  modelValue.value = newValue

  const newCursor = insertPos + 1 + loraTag.length
  nextTick(() => {
    ta.setSelectionRange(newCursor, newCursor)
    ta.focus()
  })
}
</script>

<template>
  <div class="prompt-input">
    <!-- ツールバー -->
    <div class="prompt-input__toolbar">
      <button type="button" class="prompt-input__btn" disabled title="Undo">Undo</button>
      <button type="button" class="prompt-input__btn" disabled title="Redo">Redo</button>
      <button type="button" class="prompt-input__btn" title="カーソル左" @mousedown.prevent="moveCursor('left')">◀</button>
      <button type="button" class="prompt-input__btn" title="カーソル右" @mousedown.prevent="moveCursor('right')">▶</button>
      <button type="button" class="prompt-input__btn" title="LoRA挿入" @click="loraSelectorRef?.open()">Lora</button>
      <button type="button" class="prompt-input__btn" title="PromptSelector" @click="promptSelectorRef?.isOpen ? promptSelectorRef?.close() : promptSelectorRef?.open()">Prompts</button>
      <button
        type="button"
        class="prompt-input__btn"
        :title="isExpanded ? '縮小' : '拡大'"
        @click="toggleExpand"
      >
        {{ isExpanded ? '◤' : '◢' }}
      </button>
    </div>

    <!-- テキストエリア -->
    <textarea
      ref="textareaRef"
      v-model="modelValue"
      :placeholder="placeholder"
      class="prompt-input__textarea"
      :style="{ height: isExpanded ? '20em' : '8em' }"
      rows="4"
    ></textarea>

    <!-- オートコンプリート -->
    <AutoComplete v-model="modelValue" :target-element="textareaRef" />

    <!-- プロンプトセレクター -->
    <PromptSelector ref="promptSelectorRef" v-model="modelValue" :target-element="textareaRef" />

    <!-- LoRAセレクター -->
    <LoraSelector ref="loraSelectorRef" :lora-list="loraList" @select="insertLora" />
  </div>
</template>

<style scoped>
.prompt-input__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.prompt-input__btn {
  padding: 4px 8px;
  font-size: 0.75rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
  cursor: pointer;
  line-height: 1.2;
}

.prompt-input__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.prompt-input__btn:not(:disabled):hover {
  background: #e5e7eb;
}

.prompt-input__textarea {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  border-radius: 0.375rem;
  resize: vertical;
}
</style>
