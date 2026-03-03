import { ref } from 'vue'

/**
 * loading / errorMessage の状態管理と try/catch を共通化する composable。
 * API 呼び出しを `run()` でラップすることで、各 composable での重複実装を排除する。
 */
export function useAsyncState() {
  const loading = ref(false)
  const errorMessage = ref('')

  /**
   * loading を立てて task を実行し、エラー時は errorMessage にセットする。
   * 成功時は結果を返し、失敗時は undefined を返す。
   */
  async function run<T>(
    task: () => Promise<T>,
    fallbackMessage = '操作に失敗しました'
  ): Promise<T | undefined> {
    loading.value = true
    errorMessage.value = ''

    try {
      return await task()
    } catch (error) {
      errorMessage.value = toErrorMessage(error, fallbackMessage)
      return undefined
    } finally {
      loading.value = false
    }
  }

  return { loading, errorMessage, run }
}

/** unknown 型のエラーを表示用文字列に正規化する */
export function toErrorMessage(error: unknown, fallback = '操作に失敗しました'): string {
  return error instanceof Error ? error.message : fallback
}
