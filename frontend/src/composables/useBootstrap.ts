import { ref } from 'vue'
import { useAsyncState } from './useAsyncState'
import { fetchComfyUIEndpoint, fetchWorkflows } from '../services/backendApi'

export function useBootstrap() {
  const { loading, errorMessage, run } = useAsyncState()
  const endpoint = ref('')
  const workflows = ref<string[]>([])

  /** 初期表示時に必要なデータを取得する */
  async function bootstrap(): Promise<void> {
    await run(async () => {
      const [nextEndpoint, nextWorkflows] = await Promise.all([
        fetchComfyUIEndpoint(),
        fetchWorkflows()
      ])
      endpoint.value = nextEndpoint
      workflows.value = nextWorkflows
    }, '初期化に失敗しました')
  }

  return {
    loading,
    errorMessage,
    endpoint,
    workflows,
    bootstrap
  }
}
