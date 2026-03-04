<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useAutoCompleteTags } from '../composables/useAutoCompleteTags'

const props = defineProps<{
  targetElement?: HTMLTextAreaElement | null
}>()

const modelValue = defineModel<string>({ default: '' })

const { filterTags } = useAutoCompleteTags()

const filteredTags = ref<string[]>([])

/** textarea の input イベント: カーソル前の単語を取り出して候補を絞り込む */
function onInput(): void {
  if (!props.targetElement) return
  const textarea = props.targetElement
  const textBefore = textarea.value.substring(0, textarea.selectionStart)
  const match = textBefore.match(/[0-9a-zA-Z_ ]+$/)

  if (match && match[0].length >= 2) {
    filteredTags.value = filterTags(match[0])
  } else {
    filteredTags.value = []
  }
}

/**
 * タグバッジをクリック。
 * @mousedown.prevent でフォーカスを textarea に保ったまま selectionStart を読み取り、
 * カーソル前の部分単語をタグで置き換える。
 */
function selectTag(tag: string): void {
  if (!props.targetElement) return

  const textarea = props.targetElement
  const cursor = textarea.selectionStart
  const value = textarea.value
  const textBefore = value.substring(0, cursor)
  const match = textBefore.match(/[0-9a-zA-Z_ ]+$/)
  if (!match) return

  const trimmedMatch = match[0].trimStart()
  const newTextBefore =
    textBefore.substring(0, textBefore.length - trimmedMatch.length) + tag + ', '
  const newValue = newTextBefore + value.substring(cursor)

  modelValue.value = newValue
  filteredTags.value = []

  const newCursor = newTextBefore.length
  nextTick(() => {
    if (props.targetElement) {
      props.targetElement.setSelectionRange(newCursor, newCursor)
    }
  })
}

function addListeners(el: HTMLTextAreaElement): void {
  el.addEventListener('input', onInput)
}

function removeListeners(el: HTMLTextAreaElement): void {
  el.removeEventListener('input', onInput)
  filteredTags.value = []
}

watch(
  () => props.targetElement,
  (newEl, oldEl) => {
    if (oldEl) removeListeners(oldEl)
    if (newEl) addListeners(newEl)
  },
  { immediate: true }
)

onUnmounted(() => {
  if (props.targetElement) removeListeners(props.targetElement)
})
</script>

<template>
  <div v-if="filteredTags.length > 0" class="ac-tags">
    <button
      v-for="tag in filteredTags"
      :key="tag"
      type="button"
      class="ac-tag"
      @mousedown.prevent="selectTag(tag)"
    >
      {{ tag }}
    </button>
  </div>
</template>

<style scoped>
.ac-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 4px;
}

.ac-tag {
  font-size: 0.75rem;
  padding: 2px 10px;
  background: #dbeafe;
  color: #1d4ed8;
  border: 1px solid #bfdbfe;
  border-radius: 9999px;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1.6;
}

.ac-tag:hover {
  background: #bfdbfe;
}
</style>
