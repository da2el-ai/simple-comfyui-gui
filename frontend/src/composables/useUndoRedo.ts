import { ref, computed, nextTick, type Ref } from 'vue'

const MAX_HISTORY = 50

/**
 * テキストのアンドゥ・リドゥ機能を提供する。
 * スナップショット方式で全文を保存する。
 * @param text v-model で管理するテキストの ref。
 * @returns アンドゥ・リドゥ操作関数とボタン活性状態。
 */
export function useUndoRedo(text: Ref<string>) {
  const history = ref<string[]>([text.value])
  const historyIndex = ref(0)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  /** アンドゥ/リドゥ操作中に onInput を無視するフラグ */
  let isRestoring = false

  const canUndo = computed(() => historyIndex.value > 1)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)

  /**
   * 履歴にスナップショットを追加する。
   * 同一内容は保存しない。リドゥ先は切り捨てられる。
   */
  function saveHistory(value: string): void {
    cancelDebounce()
    const h = history.value
    // 同一内容は保存しない
    if (h[historyIndex.value] === value) return
    // 現在位置より未来のリドゥ履歴を削除
    history.value = h.slice(0, historyIndex.value + 1)
    history.value.push(value)
    historyIndex.value++
    // 上限管理
    if (history.value.length > MAX_HISTORY) {
      history.value.shift()
      historyIndex.value--
    }
  }

  /**
   * 遅延付きで履歴を保存する（入力が1秒間止まったら保存）。
   */
  function saveHistoryDebounced(value: string): void {
    cancelDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      saveHistory(value)
    }, 1000)
  }

  function cancelDebounce(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  /**
   * テキスト変更時にトリガーに応じて即時/遅延保存を判定する。
   * textarea の input イベントから呼ぶ。
   */
  function onInput(event: Event): void {
    if (isRestoring) return
    const inputEvent = event as InputEvent
    const value = text.value

    // 即時保存トリガー: カンマ・改行・ペースト
    if (
      inputEvent.inputType === 'insertFromPaste' ||
      inputEvent.data === ',' ||
      inputEvent.data === '、' ||
      inputEvent.inputType === 'insertLineBreak'
    ) {
      saveHistory(value)
    } else {
      // それ以外は遅延保存
      saveHistoryDebounced(value)
    }
  }

  /**
   * 外部操作（LoRA挿入など）後に即時保存する。
   */
  function saveImmediate(): void {
    saveHistory(text.value)
  }

  /** 1ステップ前に戻す */
  function undo(): void {
    if (!canUndo.value) return
    cancelDebounce()
    // 現在のテキストが未保存なら先に保存
    if (history.value[historyIndex.value] !== text.value) {
      saveHistory(text.value)
      historyIndex.value -= 2
    } else {
      historyIndex.value--
    }
    isRestoring = true
    text.value = history.value[historyIndex.value]
    nextTick(() => { isRestoring = false })
  }

  /** アンドゥした操作をやり直す */
  function redo(): void {
    if (!canRedo.value) return
    cancelDebounce()
    historyIndex.value++
    isRestoring = true
    text.value = history.value[historyIndex.value]
    nextTick(() => { isRestoring = false })
  }

  return {
    canUndo,
    canRedo,
    undo,
    redo,
    onInput,
    saveImmediate
  }
}
