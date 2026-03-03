import { ref, onMounted } from 'vue'

// シングルトン状態（モジュールスコープ）
const tags = ref<string[]>([])
const isLoaded = ref(false)
const isLoading = ref(false)

export function useAutoCompleteTags() {
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

  function filterTags(searchTerm: string, limit = 10): string[] {
    if (searchTerm.length < 2) return []
    const term = searchTerm.toLowerCase()
    return tags.value.filter((tag) => tag.toLowerCase().includes(term)).slice(0, limit)
  }

  onMounted(() => {
    loadTags()
  })

  return { filterTags }
}
