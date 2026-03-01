import { ref } from 'vue'
import { fetchComfyUIEndpoint, fetchWorkflows } from '../services/backendApi'

export function useBootstrap() {
  const loading = ref(false)
  const errorMessage = ref('')
  const endpoint = ref('')
  const workflows = ref<string[]>([])

  /** 初期表示時に必要なデータを取得する */
  async function bootstrap(): Promise<void> {
    loading.value = true
    errorMessage.value = ''

    try {
      const [nextEndpoint, nextWorkflows] = await Promise.all([
        fetchComfyUIEndpoint(),
        fetchWorkflows()
      ])
      endpoint.value = nextEndpoint
      workflows.value = nextWorkflows
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : '初期化に失敗しました'
    } finally {
      loading.value = false
    }
  }

  return {
    loading,
    errorMessage,
    endpoint,
    workflows,
    bootstrap
  }
}
