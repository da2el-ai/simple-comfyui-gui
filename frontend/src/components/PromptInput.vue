<script setup lang="ts">
import { nextTick, watch, ref, onMounted } from 'vue'
import AutoComplete from './AutoComplete.vue'
import LoraSelector from './LoraSelector.vue'
import PromptSelector from './PromptSelector.vue'
import { useUndoRedo } from '../composables/useUndoRedo'
import { useWeightAdjust } from '../composables/useWeightAdjust'

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

const { canUndo, canRedo, undo, redo, onInput, saveImmediate } = useUndoRedo(modelValue)

defineExpose({ textareaRef })


// 初期履歴保存フラグ
let initialHistorySaved = false

watch(modelValue, (val) => {
  if (!initialHistorySaved && val && canUndo.value === false && canRedo.value === false) {
    saveImmediate()
    initialHistorySaved = true
  }
})

// --- ウェイト調整（キーボードショートカット用） ---
const { setWeight } = useWeightAdjust(modelValue, textareaRef)

/**
 * テキストエリアの拡大・縮小を切り替える。
 */
function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
}

// /**
//  * カーソルを指定方向に1文字移動する。
//  */
// function moveCursor(direction: 'left' | 'right'): void {
//   const ta = textareaRef.value
//   if (!ta) return
//   const pos = ta.selectionStart ?? 0
//   const next = direction === 'left'
//     ? Math.max(0, pos - 1)
//     : Math.min(ta.value.length, pos + 1)
//   ta.setSelectionRange(next, next)
// }

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

/**
 * コメントのトグルを行う。
 * 優先順位:
 *   1. カーソルがブロックコメント内 → ブロックコメント記号を削除
 *   2. カーソル行の行頭が `//` → `//` を削除
 *   3. 選択範囲あり → 選択範囲をブロックコメントで囲む
 *   4. 選択なし → カーソル行の行頭に `//` を挿入
 * @returns なし。
 */
function toggleComment(): void {
  const ta = textareaRef.value
  if (!ta) return

  const text = ta.value
  const cursor = ta.selectionStart
  const selEnd = ta.selectionEnd

  // Case 1: カーソルより前の最後の /* を探し、その /* に対応する最初の */ が
  //         カーソル以降にあれば、カーソルはブロックコメント内にある
  const blockStart = text.lastIndexOf('/*', cursor - 1)
  if (blockStart !== -1) {
    const firstCloseAfterStart = text.indexOf('*/', blockStart + 2)
    if (firstCloseAfterStart !== -1 && firstCloseAfterStart >= cursor) {
      const blockEnd = firstCloseAfterStart
      const newText =
        text.slice(0, blockStart) +
        text.slice(blockStart + 2, blockEnd) +
        text.slice(blockEnd + 2)
      modelValue.value = newText
      const newCursor = Math.max(blockStart, cursor - 2)
      nextTick(() => { ta.setSelectionRange(newCursor, newCursor); ta.focus() })
      saveImmediate()
      return
    }
  }

  // Case 2: カーソル行の行頭が // → // を削除
  const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
  if (text.slice(lineStart, lineStart + 2) === '//') {
    const newText = text.slice(0, lineStart) + text.slice(lineStart + 2)
    modelValue.value = newText
    const newCursor = Math.max(lineStart, cursor - 2)
    nextTick(() => { ta.setSelectionRange(newCursor, newCursor); ta.focus() })
    saveImmediate()
    return
  }

  // Case 3: 選択範囲あり → /* */ で囲む
  if (cursor !== selEnd) {
    const newText =
      text.slice(0, cursor) + '/*' + text.slice(cursor, selEnd) + '*/' + text.slice(selEnd)
    modelValue.value = newText
    nextTick(() => { ta.setSelectionRange(cursor + 2, selEnd + 2); ta.focus() })
    saveImmediate()
    return
  }

  // Case 4: 選択なし → 行頭に // を挿入
  const newText = text.slice(0, lineStart) + '//' + text.slice(lineStart)
  modelValue.value = newText
  nextTick(() => { ta.setSelectionRange(cursor + 2, cursor + 2); ta.focus() })
  saveImmediate()
}

// --- キーボードショートカット ---
/**
 * 重み調整・コメントトグルのショートカットを処理する。
 * @param event keydownイベント。
 * @returns なし。
 */
function handleKeyDown(event: KeyboardEvent): void {
  const isCtrl = event.ctrlKey || event.metaKey
  if (!isCtrl) return

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    void setWeight(0.1)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    void setWeight(-0.1)
  } else if (event.key === '/') {
    event.preventDefault()
    toggleComment()
  }
}

onMounted(()=>{
  // キーボードショートカットを登録する
  const ta = textareaRef.value as HTMLTextAreaElement
  ta.addEventListener('keydown', handleKeyDown)
})
</script>

<template>
  <div class="prompt-input">

    <!-- テキストエリア -->
    <textarea
      ref="textareaRef"
      v-model="modelValue"
      :placeholder="placeholder"
      class="prompt-input__textarea"
      :style="{ height: isExpanded ? '20em' : '8em' }"
      rows="4"
      @input="onInput"
    ></textarea>

    <!-- ツールバー -->
    <div class="prompt-input__toolbar">
      <button type="button" class="prompt-input__btn" :disabled="!canUndo" title="Undo" @mousedown.prevent="undo"><i class="i-icomoon-undo"></i></button>
      <button type="button" class="prompt-input__btn" :disabled="!canRedo" title="Redo" @mousedown.prevent="redo"><i class="i-icomoon-redo"></i></button>
      <button type="button" class="prompt-input__btn" title="コメント" @mousedown.prevent="toggleComment">//</button>
<!--      
      <button type="button" class="prompt-input__btn" title="カーソル左" @mousedown.prevent="moveCursor('left')">◀</button>
      <button type="button" class="prompt-input__btn" title="カーソル右" @mousedown.prevent="moveCursor('right')">▶</button> 
-->
      <button type="button" class="prompt-input__btn" title="ウェイトUp" @mousedown.prevent="setWeight(0.1)"><i class="i-icomoon-plus"></i></button>
      <button type="button" class="prompt-input__btn" title="ウェイトDown" @mousedown.prevent="setWeight(-0.1)"><i class="i-icomoon-minus"></i></button>
      <button type="button" class="prompt-input__btn" title="LoRA挿入" @click="loraSelectorRef?.open()"><i class="i-icomoon-user"></i></button>
      <button type="button" class="prompt-input__btn" title="PromptSelector" @click="promptSelectorRef?.isOpen ? promptSelectorRef?.close() : promptSelectorRef?.open()"><i class="i-icomoon-book"></i></button>
      <button
        type="button"
        class="prompt-input__btn"
        :title="isExpanded ? '縮小' : '拡大'"
        @click="toggleExpand"
      >
        {{ isExpanded ? '◤' : '◢' }}
      </button>
    </div>

    <!-- オートコンプリート -->
    <AutoComplete v-model="modelValue" :target-element="textareaRef" @applied="saveImmediate" />

    <!-- プロンプトセレクター -->
    <PromptSelector ref="promptSelectorRef" v-model="modelValue" :target-element="textareaRef" @applied="saveImmediate" />

    <!-- LoRAセレクター -->
    <LoraSelector ref="loraSelectorRef" :lora-list="loraList" @select="insertLora" />
  </div>
</template>

<style scoped>
.prompt-input__toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: .8rem;
  flex-wrap: wrap;
}

.prompt-input__btn {
  min-width: 2.2rem;
  padding: .3rem;
  font-size: 1rem;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
  color: #000;
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
