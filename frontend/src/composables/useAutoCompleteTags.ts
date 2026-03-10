import { ref, onMounted } from 'vue'

// シングルトン状態（モジュールスコープ）
const tags = ref<string[]>([])
const isLoaded = ref(false)
const isLoading = ref(false)

/**
 * タグの自動補完候補を読み込み、検索する機能を提供する。
 * @returns タグ候補を絞り込む関数。
 */
export function useAutoCompleteTags() {
  /**
   * タグ一覧を一度だけ取得してメモリ上に保持する。
   * @returns 読み込み完了時に解決されるPromise。
   */
  async function loadTags(): Promise<void> {
    if (isLoaded.value || isLoading.value) return
    isLoading.value = true
    try {
      const response = await fetch('/api/tags')
      if (!response.ok) return
      const text = await response.text()
      tags.value = text
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => line.split(',')[0])
      isLoaded.value = true
    } catch {
      // 取得失敗時はサジェストなしで継続
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 検索語を含むタグを抽出して候補として返す。
   * @param searchTerm 入力中の検索語。
   * @param limit 返却する最大件数。
   * @returns 候補タグの配列。
   */
  function filterTags(searchTerm: string, limit = 10): string[] {
    const term = searchTerm.trim().toLowerCase().replace(/ /g, '_')
    if (term.length < 2) return []
    return tags.value.filter((tag) => tag.toLowerCase().includes(term)).slice(0, limit)
  }

  onMounted(() => {
    loadTags()
  })

  return { filterTags }
}
