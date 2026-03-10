import { ref } from 'vue'
import { useAsyncState } from './useAsyncState'
import { fetchComfyUIEndpoint, fetchWorkflows } from '../services/backendApi'

/**
 * 初期表示に必要な最小データ取得状態を提供する。
 * @returns 初期化状態と実行関数。
 */
export function useBootstrap() {
  const { loading, errorMessage, run } = useAsyncState()
  const endpoint = ref('')
  const workflows = ref<string[]>([])

  /**
   * 初期表示時に必要なエンドポイントとワークフロー一覧を取得する。
   * @returns 初期化完了時に解決されるPromise。
   */
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
