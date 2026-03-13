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

// --- キーボードショートカット ---
/**
 * 重み調整のショートカットを処理する。
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
