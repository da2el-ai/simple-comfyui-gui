<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SelectorAllData, SelectorItem, SelectorSubcategory } from '../types/api'
import {
  addSelectorItem,
  deleteSelectorData,
  editSelectorItem,
  fetchSelectorData
} from '../services/backendApi'
import PromptSelectorForm from './PromptSelectorForm.vue'
import PromptTicker from './PromptTicker.vue'

// ─── props / emits ───────────────────────────────────────────────────────────

const props = defineProps<{
  /** 挿入先テキストエリア (positive / negative) */
  targetElement: HTMLTextAreaElement | null
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// ─── ダイアログ開閉 ─────────────────────────────────────────────────────────

const isOpen = ref(false)
const isEditMode = ref(false)

function open() {
  isOpen.value = true
  void loadData()
}

function close() {
  isOpen.value = false
  isEditMode.value = false
  showForm.value = false
  deleteConfirm.value = null
}

function toggleEditMode() {
  isEditMode.value = !isEditMode.value
  deleteConfirm.value = null
}

// ─── データ ─────────────────────────────────────────────────────────────────

const selectorData = ref<SelectorAllData>({})
const loading = ref(false)
const errorMsg = ref('')

const categories = computed(() => Object.keys(selectorData.value))
const selectedCategory = ref('')

const currentSubcategories = computed<SelectorSubcategory[]>(() =>
  selectedCategory.value ? (selectorData.value[selectedCategory.value] ?? []) : []
)

watch(categories, (cats) => {
  if (!selectedCategory.value && cats.length > 0) {
    selectedCategory.value = cats[0]
  }
})

async function loadData() {
  loading.value = true
  errorMsg.value = ''
  try {
    selectorData.value = await fetchSelectorData()
    if (!selectedCategory.value && categories.value.length > 0) {
      selectedCategory.value = categories.value[0]
    }
    // 現在のカテゴリが消えた場合に先頭へフォールバック
    if (selectedCategory.value && !selectorData.value[selectedCategory.value]) {
      selectedCategory.value = categories.value[0] ?? ''
    }
  } catch (e) {
    errorMsg.value = String(e)
  } finally {
    loading.value = false
  }
}

// ─── プロンプト挿入 ──────────────────────────────────────────────────────────

function insertPrompt(prompt: string) {
  if (!props.targetElement) return

  const ta = props.targetElement
  const start = ta.selectionStart ?? ta.value.length
  const end = ta.selectionEnd ?? start
  const before = ta.value.slice(0, start)
  const after = ta.value.slice(end)
  const sep = before.length > 0 && !before.match(/[,\s]$/) ? ', ' : ''
  const newVal = before + sep + prompt + after

  emit('update:modelValue', newVal)

  requestAnimationFrame(() => {
    const cursor = start + sep.length + prompt.length
    ta.setSelectionRange(cursor, cursor)
    ta.focus()
  })
}

// ─── フォーム ────────────────────────────────────────────────────────────────

const showForm = ref(false)
const formMode = ref<'add' | 'edit'>('add')

const editTarget = ref<{
  category: string
  subcategory: string
  item: SelectorItem
} | null>(null)

const formSubcategories = computed(() => {
  const key = formMode.value === 'edit' ? (editTarget.value?.category ?? '') : selectedCategory.value
  return (selectorData.value[key] ?? []).map((s) => s.subcategory)
})

function openAddForm() {
  formMode.value = 'add'
  editTarget.value = null
  showForm.value = true
}

function openEditForm(category: string, subcategory: string, item: SelectorItem) {
  formMode.value = 'edit'
  editTarget.value = { category, subcategory, item }
  showForm.value = true
}

async function handleSubmitAdd(req: Parameters<typeof addSelectorItem>[0]) {
  await addSelectorItem(req)
  showForm.value = false
  await loadData()
  showTicker('保存しました')
}

async function handleSubmitEdit(req: { new_name?: string; new_prompt?: string }) {
  if (!editTarget.value) return
  await editSelectorItem(
    editTarget.value.category,
    editTarget.value.subcategory,
    editTarget.value.item.name,
    req
  )
  showForm.value = false
  await loadData()
  showTicker('更新しました')
}

// ─── 削除確認 ────────────────────────────────────────────────────────────────

const deleteConfirm = ref<{
  type: 'item' | 'subcategory' | 'category'
  category: string
  subcategory?: string
  name?: string
  label: string
} | null>(null)

function confirmDeleteItem(category: string, subcategory: string, item: SelectorItem) {
  deleteConfirm.value = {
    type: 'item',
    category,
    subcategory,
    name: item.name,
    label: `「${item.name}」を削除しますか？`
  }
}

function confirmDeleteSubcategory(category: string, subcategory: string) {
  deleteConfirm.value = {
    type: 'subcategory',
    category,
    subcategory,
    label: `サブカテゴリ「${subcategory}」ごと削除しますか？`
  }
}

function confirmDeleteCategory(category: string) {
  deleteConfirm.value = {
    type: 'category',
    category,
    label: `カテゴリ「${category}」ごと削除しますか？`
  }
}

async function executeDelete() {
  if (!deleteConfirm.value) return
  const dc = deleteConfirm.value
  deleteConfirm.value = null
  await deleteSelectorData({
    type: dc.type,
    category: dc.category,
    subcategory: dc.subcategory,
    name: dc.name
  })
  await loadData()
  showTicker('削除しました')
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

const tickerMessage = ref('')
const tickerVisible = ref(false)
let tickerTimer: ReturnType<typeof setTimeout> | null = null

function showTicker(message: string) {
  tickerMessage.value = message
  tickerVisible.value = true
  if (tickerTimer) clearTimeout(tickerTimer)
  tickerTimer = setTimeout(() => {
    tickerVisible.value = false
  }, 2500)
}
</script>

<template>
  <!-- トグルボタン -->
  <button class="ps-toggle-btn" @click="isOpen ? close() : open()">Prompts</button>

  <!-- Ticker -->
  <PromptTicker :message="tickerMessage" :visible="tickerVisible" />

  <!-- フォームモーダル -->
  <PromptSelectorForm
    v-if="showForm"
    :mode="formMode"
    :categories="categories"
    :subcategories="formSubcategories"
    :initial-data="
      editTarget
        ? {
            category: editTarget.category,
            subcategory: editTarget.subcategory,
            name: editTarget.item.name,
            prompt: editTarget.item.prompt
          }
        : { category: selectedCategory }
    "
    :selector-data="selectorData"
    @submit-add="handleSubmitAdd"
    @submit-edit="handleSubmitEdit"
    @cancel="showForm = false"
  />

  <!-- ダイアログ本体 -->
  <div v-if="isOpen" class="ps-dialog">
    <!-- ヘッダー -->
    <div class="ps-dialog__header">
      <select v-model="selectedCategory" class="ps-dialog__cat-select">
        <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
      </select>

      <div class="ps-dialog__header-actions">
        <!-- 削除確認 -->
        <template v-if="deleteConfirm">
          <span class="ps-confirm__label">{{ deleteConfirm.label }}</span>
          <button class="ps-btn ps-btn--danger" @click="executeDelete">削除</button>
          <button class="ps-btn" @click="deleteConfirm = null">キャンセル</button>
        </template>
        <template v-else>
          <button
            v-if="isEditMode"
            class="ps-btn ps-btn--danger-outline"
            title="このカテゴリを削除"
            @click="confirmDeleteCategory(selectedCategory)"
          >
            カテゴリ削除
          </button>
          <button v-if="!isEditMode" class="ps-btn" @click="openAddForm">＋ 追加</button>
          <button
            class="ps-btn"
            :class="{ 'ps-btn--active': isEditMode }"
            @click="toggleEditMode"
          >
            {{ isEditMode ? '完了' : '編集' }}
          </button>
          <button class="ps-btn ps-btn--close" @click="close">✕</button>
        </template>
      </div>
    </div>

    <!-- ボディ -->
    <div class="ps-dialog__body">
      <p v-if="loading" class="ps-dialog__loading">読み込み中...</p>
      <p v-else-if="errorMsg" class="ps-dialog__error">{{ errorMsg }}</p>
      <p v-else-if="categories.length === 0" class="ps-dialog__empty">
        データがありません。「＋ 追加」から作成できます。
      </p>

      <details
        v-for="subcat in currentSubcategories"
        :key="subcat.subcategory"
        class="ps-subcat"
        open
      >
        <summary class="ps-subcat__summary">
          <span>{{ subcat.subcategory }}</span>
          <button
            v-if="isEditMode"
            class="ps-btn ps-btn--danger-xs"
            title="サブカテゴリを削除"
            @click.stop="confirmDeleteSubcategory(selectedCategory, subcat.subcategory)"
          >
            削除
          </button>
        </summary>

        <div class="ps-subcat__items">
          <template v-for="item in subcat.items" :key="item.name">
            <!-- 編集モード: バッジクリックで編集フォーム、×で削除確認 -->
            <template v-if="isEditMode">
              <span class="ps-item ps-item--edit">
                <button
                  class="ps-item__label ps-item__label--edit"
                  @click="openEditForm(selectedCategory, subcat.subcategory, item)"
                >
                  {{ item.name }}
                </button>
                <button
                  class="ps-item__del"
                  title="削除"
                  @click="confirmDeleteItem(selectedCategory, subcat.subcategory, item)"
                >
                  ×
                </button>
              </span>
            </template>
            <!-- 通常モード: バッジクリックで挿入 -->
            <button
              v-else
              class="ps-item ps-item--normal"
              :title="item.prompt"
              @click="insertPrompt(item.prompt)"
            >
              {{ item.name }}
            </button>
          </template>
        </div>
      </details>
    </div>
  </div>
</template>

<style scoped>
/* ─── トグルボタン ─────────────────────────────────────────────────────────── */
.ps-toggle-btn {
  padding: 4px 12px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #1d4ed8;
}
.ps-toggle-btn:hover {
  background: #dbeafe;
}

/* ─── ダイアログ ───────────────────────────────────────────────────────────── */
.ps-dialog {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 50vh;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  z-index: 10000;
}

/* ─── ヘッダー ─────────────────────────────────────────────────────────────── */
.ps-dialog__header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.ps-dialog__cat-select {
  flex: 1;
  min-width: 120px;
  padding: 4px 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 0.9rem;
}

.ps-dialog__header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.ps-confirm__label {
  font-size: 0.82rem;
  color: #dc2626;
}

/* ─── ボタン共通 ───────────────────────────────────────────────────────────── */
.ps-btn {
  padding: 4px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f9fafb;
  cursor: pointer;
  font-size: 0.8rem;
  line-height: 1.4;
}
.ps-btn:hover {
  background: #f3f4f6;
}
.ps-btn--active {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #92400e;
}
.ps-btn--danger {
  background: #fef2f2;
  border-color: #fca5a5;
  color: #dc2626;
}
.ps-btn--danger:hover {
  background: #fee2e2;
}
.ps-btn--danger-outline {
  background: transparent;
  border-color: #fca5a5;
  color: #dc2626;
  font-size: 0.78rem;
}
.ps-btn--danger-outline:hover {
  background: #fef2f2;
}
.ps-btn--close {
  font-size: 0.9rem;
  padding: 2px 8px;
}

/* ─── ボディ ───────────────────────────────────────────────────────────────── */
.ps-dialog__body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 12px;
}

.ps-dialog__loading,
.ps-dialog__error,
.ps-dialog__empty {
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 12px;
}
.ps-dialog__error {
  color: #dc2626;
}

/* ─── サブカテゴリ ─────────────────────────────────────────────────────────── */
.ps-subcat {
  margin-bottom: 8px;
}

.ps-subcat__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  color: #374151;
  padding: 2px 0;
  list-style: none;
  user-select: none;
}

.ps-subcat__summary::-webkit-details-marker {
  display: none;
}

.ps-subcat__summary::before {
  content: '▶';
  font-size: 0.65rem;
  transition: transform 0.15s;
  display: inline-block;
}

details[open] > .ps-subcat__summary::before {
  transform: rotate(90deg);
}

.ps-btn--danger-xs {
  padding: 1px 6px;
  font-size: 0.72rem;
  background: transparent;
  border-color: #fca5a5;
  color: #dc2626;
}
.ps-btn--danger-xs:hover {
  background: #fef2f2;
}

/* ─── アイテム ─────────────────────────────────────────────────────────────── */
.ps-subcat__items {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 0 6px 12px;
}

/* 通常モードのバッジ */
.ps-item--normal {
  padding: 3px 10px;
  background: #eff6ff;
  border: 1px solid #93c5fd;
  border-radius: 14px;
  font-size: 0.8rem;
  cursor: pointer;
  color: #1d4ed8;
}
.ps-item--normal:hover {
  background: #dbeafe;
}

/* 編集モードのバッジ */
.ps-item--edit {
  display: inline-flex;
  align-items: center;
  border: 1px solid #fdba74;
  border-radius: 14px;
  overflow: hidden;
}

.ps-item__label--edit {
  padding: 3px 8px;
  background: #fff7ed;
  border: none;
  font-size: 0.8rem;
  cursor: pointer;
  color: #9a3412;
}
.ps-item__label--edit:hover {
  background: #ffedd5;
}

.ps-item__del {
  padding: 3px 7px;
  background: #fef2f2;
  border: none;
  border-left: 1px solid #fdba74;
  font-size: 0.75rem;
  cursor: pointer;
  color: #dc2626;
  line-height: 1;
}
.ps-item__del:hover {
  background: #fee2e2;
}
</style>
