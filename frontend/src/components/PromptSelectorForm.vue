<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { SelectorAddRequest, SelectorAllData, SelectorEditRequest } from '../types/api'

const props = defineProps<{
  mode: 'add' | 'edit'
  /** 既存カテゴリ一覧 (add モードのみ使用) */
  categories: string[]
  /** 選択中カテゴリのサブカテゴリ一覧 (add モードのみ使用) */
  subcategories: string[]
  /** 編集開始時の初期値 */
  initialData?: {
    category?: string
    subcategory?: string
    name?: string
    prompt?: string
  }
  /** 重複チェック用に全データを渡す */
  selectorData?: SelectorAllData
}>()

const emit = defineEmits<{
  submitAdd: [req: SelectorAddRequest]
  submitEdit: [req: SelectorEditRequest]
  cancel: []
}>()

// ─── add モード用 ───────────────────────────────────────────────────────────

const selectedCategory = ref(props.initialData?.category ?? props.categories[0] ?? '__new__')
const newCategory = ref('')
const selectedSubcategory = ref(
  props.initialData?.subcategory ?? props.subcategories[0] ?? '__new__'
)
const newSubcategory = ref('')

// カテゴリが変わったらサブカテゴリをリセット
watch(selectedCategory, () => {
  selectedSubcategory.value = props.subcategories[0] ?? '__new__'
})

const isNewCategory = computed(() => selectedCategory.value === '__new__')
const isNewSubcategory = computed(() => selectedSubcategory.value === '__new__')

// ─── 共通フィールド ──────────────────────────────────────────────────────────

const name = ref(props.initialData?.name ?? '')
const prompt = ref(props.initialData?.prompt ?? '')

// ─── バリデーション ─────────────────────────────────────────────────────────

// 選択中のサブカテゴリに既に存在する名前一覧
const existingNames = computed<string[]>(() => {
  if (!props.selectorData) return []
  const cat = props.mode === 'edit'
    ? (props.initialData?.category ?? '')
    : selectedCategory.value
  const sub = props.mode === 'edit'
    ? (props.initialData?.subcategory ?? '')
    : selectedSubcategory.value
  const subcats = props.selectorData[cat] ?? []
  const found = subcats.find((s) => s.subcategory === sub)
  return found ? found.items.map((i) => i.name) : []
})

// 重複チェック (edit モードは元の名前を除外)
const isDuplicate = computed(() => {
  const trimmed = name.value.trim()
  if (!trimmed) return false
  const originalName = props.mode === 'edit' ? (props.initialData?.name ?? '') : ''
  return existingNames.value
    .filter((n) => n !== originalName)
    .includes(trimmed)
})

// 名前・プロンプト両方の記入がある場合のみ保存可
const canSave = computed(() => name.value.trim() !== '' && prompt.value.trim() !== '' && !isDuplicate.value)

// ─── 送信 ───────────────────────────────────────────────────────────────────

function handleSubmit() {
  if (props.mode === 'add') {
    const category = isNewCategory.value
      ? newCategory.value.trim()
      : selectedCategory.value
    const subcategory = isNewSubcategory.value
      ? newSubcategory.value.trim()
      : selectedSubcategory.value

    if (!category || !subcategory || !name.value.trim()) return

    emit('submitAdd', {
      category: isNewCategory.value ? '__new__' : category,
      new_category: isNewCategory.value ? category : undefined,
      subcategory: isNewSubcategory.value ? '__new__' : subcategory,
      new_subcategory: isNewSubcategory.value ? subcategory : undefined,
      name: name.value.trim(),
      prompt: prompt.value.trim()
    })
  } else {
    if (!name.value.trim()) return
    emit('submitEdit', {
      new_name: name.value.trim(),
      new_prompt: prompt.value.trim()
    })
  }
}
</script>

<template>
  <div class="ps-form-backdrop" @click.self="emit('cancel')">
    <div class="ps-form">
      <h3 class="ps-form__title">{{ mode === 'add' ? 'プロンプトを追加' : 'プロンプトを編集' }}</h3>

      <!-- add モード: カテゴリ選択 -->
      <template v-if="mode === 'add'">
        <label class="ps-form__label">カテゴリ</label>
        <select v-model="selectedCategory" class="ps-form__select">
          <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          <option value="__new__">＋ 新規カテゴリ</option>
        </select>
        <input
          v-if="isNewCategory"
          v-model="newCategory"
          class="ps-form__input"
          placeholder="新規カテゴリ名"
        />

        <label class="ps-form__label">サブカテゴリ</label>
        <select v-model="selectedSubcategory" class="ps-form__select">
          <option v-for="sub in subcategories" :key="sub" :value="sub">{{ sub }}</option>
          <option value="__new__">＋ 新規サブカテゴリ</option>
        </select>
        <input
          v-if="isNewSubcategory"
          v-model="newSubcategory"
          class="ps-form__input"
          placeholder="新規サブカテゴリ名"
        />
      </template>

      <!-- 共通: 名前とプロンプト -->
      <label class="ps-form__label">名前</label>
      <input v-model="name" class="ps-form__input" placeholder="表示名" />

      <label class="ps-form__label">プロンプト</label>
      <textarea v-model="prompt" class="ps-form__textarea" rows="3" placeholder="1girl, ..."></textarea>

      <div class="ps-form__actions">
        <button class="ps-form__btn ps-form__btn--primary" :disabled="!canSave" @click="handleSubmit">保存</button>
        <button class="ps-form__btn" @click="emit('cancel')">キャンセル</button>
      </div>
      <p v-if="isDuplicate" class="ps-form__error">同じ名前がすでに存在します</p>
    </div>
  </div>
</template>

<style scoped>
.ps-form-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10001;
}

.ps-form {
  background: #fff;
  border-radius: 10px;
  padding: 24px;
  min-width: 320px;
  max-width: 480px;
  width: 90vw;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
}

.ps-form__title {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 8px;
}

.ps-form__label {
  font-size: 0.8rem;
  color: #555;
  margin-top: 6px;
}

.ps-form__select,
.ps-form__input,
.ps-form__textarea {
  width: 100%;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.9rem;
  box-sizing: border-box;
  font-family: inherit;
}

.ps-form__textarea {
  resize: vertical;
}

.ps-form__actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  justify-content: flex-end;
}

.ps-form__btn {
  padding: 6px 18px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #f3f4f6;
  cursor: pointer;
  font-size: 0.9rem;
}

.ps-form__btn:hover {
  background: #e5e7eb;
}

.ps-form__btn--primary {
  background: #3b82f6;
  color: #fff;
  border-color: #3b82f6;
}

.ps-form__btn--primary:hover {
  background: #2563eb;
}

.ps-form__btn--primary:disabled {
  background: #93c5fd;
  border-color: #93c5fd;
  cursor: not-allowed;
}

.ps-form__error {
  margin: 6px 0 0;
  font-size: 0.8rem;
  color: #dc2626;
}
</style>
