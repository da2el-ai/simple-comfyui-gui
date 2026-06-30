<script setup lang="ts">
import { ref, watch } from 'vue'
import type { WorkflowData } from '../types/api'

// 親から渡される「最後に送信したワークフロー」を監視してログ化する
const props = defineProps<{
  workflow: WorkflowData | null
}>()

// デバッグログ1件分
interface DebugLog {
  time: string
  text: string
}

// デバッグモードのON/OFF
const enabled = ref(false)
// 表示するログ一覧（新しいものを先頭に積む）
const logs = ref<DebugLog[]>([])

/**
 * 現在時刻を HH:MM:SS 形式の文字列で返す。
 * @returns 時刻文字列。
 */
function nowLabel(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

// 送信ワークフローが更新されたら、デバッグON時のみログへ追加する
watch(
  () => props.workflow,
  (workflow) => {
    if (!enabled.value || !workflow) return
    logs.value.unshift({
      time: nowLabel(),
      text: JSON.stringify(workflow, null, 2)
    })
  }
)

/**
 * ログ表示をすべて消去する。
 * @returns なし。
 */
function clearLogs(): void {
  logs.value = []
}

// コピー完了表示中のログインデックス（-1はなし）
const copiedIndex = ref(-1)

/**
 * テキストをクリップボードへ書き込む。
 * HTTPなど非セキュアコンテキストでは navigator.clipboard が使えないため、
 * textarea + execCommand のフォールバックを用いる。
 * @param text コピーする文字列。
 * @returns コピーに成功したら true。
 */
async function writeClipboard(text: string): Promise<boolean> {
  // セキュアコンテキスト（HTTPS / localhost）では Clipboard API を優先
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // フォールバックへ続行
    }
  }

  // 非セキュアコンテキスト向けフォールバック
  try {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(textarea)
    return ok
  } catch {
    return false
  }
}

/**
 * 指定ログのテキストをクリップボードへコピーする。
 * @param index コピー対象ログのインデックス。
 * @param text コピーする文字列。
 * @returns コピー処理完了時に解決されるPromise。
 */
async function copyLog(index: number, text: string): Promise<void> {
  const ok = await writeClipboard(text)
  if (!ok) {
    copiedIndex.value = -1
    return
  }
  copiedIndex.value = index
  setTimeout(() => {
    if (copiedIndex.value === index) copiedIndex.value = -1
  }, 1500)
}
</script>

<template>
  <section id="debug-panel" class="border rounded-md p-4 mb-6">
    <label class="flex items-center gap-2 mb-2 cursor-pointer">
      <input v-model="enabled" type="checkbox" class="toggle" />
      <span class="text-sm font-medium">デバッグモード</span>
    </label>

    <div v-if="enabled">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500">送信ワークフローログ（{{ logs.length }} 件）</span>
        <button class="px-2 py-1 text-xs bg-gray-200 rounded-md hover:bg-gray-300" @click="clearLogs">
          クリア
        </button>
      </div>

      <p v-if="logs.length === 0" class="text-xs text-gray-400">
        まだログはありません。画像生成を実行すると送信ワークフローが表示されます。
      </p>

      <div v-else class="debug-log-list">
        <details v-for="(log, index) in logs" :key="index" class="debug-log-item" :open="index === 0">
          <summary class="text-xs text-gray-600">[{{ log.time }}] 送信ワークフロー</summary>
          <button
            class="px-2 py-1 mt-1 text-xs bg-gray-200 rounded-md hover:bg-gray-300"
            @click="copyLog(index, log.text)"
          >
            {{ copiedIndex === index ? 'コピーしました' : 'コピー' }}
          </button>
          <pre class="debug-log-pre">{{ log.text }}</pre>
        </details>
      </div>
    </div>
  </section>
</template>

<style scoped>
.debug-log-list {
  max-height: 24rem;
  overflow: auto;
}

.debug-log-item {
  margin-bottom: 0.5rem;
}

.debug-log-pre {
  margin-top: 0.25rem;
  padding: 0.5rem;
  background-color: #1e1e1e;
  color: #d4d4d4;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.75rem;
  line-height: 1.4;
  white-space: pre;
  overflow: auto;
  border-radius: 0.25rem;
}
</style>
