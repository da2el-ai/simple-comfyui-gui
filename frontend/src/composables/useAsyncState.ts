import { ref } from 'vue'

/**
 * loading / errorMessage の状態管理と try/catch を共通化する composable。
 * API 呼び出しを `run()` でラップすることで、各 composable での重複実装を排除する。
 * @returns loading・errorMessage・run を含む状態管理オブジェクト。
 */
export function useAsyncState() {
  const loading = ref(false)
  const errorMessage = ref('')

  /**
   * loading を立てて task を実行し、エラー時は errorMessage にセットする。
   * 成功時は結果を返し、失敗時は undefined を返す。
   * @template T task の戻り値型。
   * @param task 実行する非同期処理。
   * @param fallbackMessage エラー発生時に表示する既定メッセージ。
   * @returns 処理成功時の結果。失敗時はundefined。
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

/**
 * unknown型のエラーを表示用メッセージへ正規化する。
 * @param error 変換対象のエラー値。
 * @param fallback Error以外の値だった場合に返すメッセージ。
 * @returns 表示用のエラーメッセージ。
 */
export function toErrorMessage(error: unknown, fallback = '操作に失敗しました'): string {
  return error instanceof Error ? error.message : fallback
}
