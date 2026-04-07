<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted } from 'vue'
import { useAutoCompleteTags } from '../composables/useAutoCompleteTags'

const props = defineProps<{
  targetElement?: HTMLTextAreaElement | null
}>()

const modelValue = defineModel<string>({ default: '' })

const emit = defineEmits<{
  applied: []
}>()

const { filterTags } = useAutoCompleteTags()

const filteredTags = ref<string[]>([])
const activeTagIndex = ref(-1)

function updateFilteredTagsByCursor(): void {
  if (!props.targetElement) return
  const textarea = props.targetElement
  const textBefore = textarea.value.substring(0, textarea.selectionStart)
  const match = textBefore.match(/[0-9a-zA-Z_ -]+$/)

  if (match && match[0].length >= 2) {
    filteredTags.value = filterTags(match[0])
  } else {
    filteredTags.value = []
  }
  activeTagIndex.value = -1
}

/** textarea の input イベント: カーソル前の単語を取り出して候補を絞り込む */
function onInput(): void {
  updateFilteredTagsByCursor()
}

/**
 * タグバッジをクリック。
 * @mousedown.prevent でフォーカスを textarea に保ったまま selectionStart を読み取り、
 * カーソル位置の単語（後方は空白/カンマ/改行まで）をタグで置き換える。
 */
function selectTag(tag: string): void {
  if (!props.targetElement) return

  const textarea = props.targetElement
  const cursor = textarea.selectionStart
  const value = textarea.value
  const isDelimiter = (char: string): boolean => char === ',' || char === '\n'

  let replaceStart = cursor
  while (replaceStart > 0 && !isDelimiter(value.charAt(replaceStart - 1))) {
    replaceStart -= 1
  }

  let replaceEnd = cursor
  while (replaceEnd < value.length && !isDelimiter(value.charAt(replaceEnd))) {
    replaceEnd += 1
  }

  const newTextBefore = value.substring(0, replaceStart) + tag + ', '
  const newValue = newTextBefore + value.substring(replaceEnd)

  modelValue.value = newValue
  filteredTags.value = []
  activeTagIndex.value = -1
  emit('applied')

  const newCursor = newTextBefore.length
  nextTick(() => {
    if (props.targetElement) {
      props.targetElement.setSelectionRange(newCursor, newCursor)
    }
  })
}

function onKeyDown(event: KeyboardEvent): void {
  if (filteredTags.value.length === 0) return

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    if (activeTagIndex.value < 0) {
      activeTagIndex.value = 0
    } else {
      activeTagIndex.value = (activeTagIndex.value + 1) % filteredTags.value.length
    }
    return
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    if (activeTagIndex.value < 0) {
      activeTagIndex.value = filteredTags.value.length - 1
    } else {
      activeTagIndex.value =
        (activeTagIndex.value - 1 + filteredTags.value.length) % filteredTags.value.length
    }
    return
  }

  if (event.key === 'Enter') {
    if (activeTagIndex.value < 0 || activeTagIndex.value >= filteredTags.value.length) return
    event.preventDefault()
    selectTag(filteredTags.value[activeTagIndex.value])
    return
  }

  if (event.key === 'Escape') {
    event.preventDefault()
    filteredTags.value = []
    activeTagIndex.value = -1
  }
}

function onKeyUp(event: KeyboardEvent): void {
  if (filteredTags.value.length === 0) return
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  updateFilteredTagsByCursor()
}

function addListeners(el: HTMLTextAreaElement): void {
  el.addEventListener('input', onInput)
  el.addEventListener('keydown', onKeyDown)
  el.addEventListener('keyup', onKeyUp)
}

function removeListeners(el: HTMLTextAreaElement): void {
  el.removeEventListener('input', onInput)
  el.removeEventListener('keydown', onKeyDown)
  el.removeEventListener('keyup', onKeyUp)
  filteredTags.value = []
  activeTagIndex.value = -1
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
      v-for="(tag, index) in filteredTags"
      :key="tag"
      type="button"
      class="ac-tag"
      :class="{ 'ac-tag-active': index === activeTagIndex }"
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

.ac-tag-active {
  background: #bfdbfe;
}
</style>
