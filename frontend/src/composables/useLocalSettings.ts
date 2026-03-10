const STORAGE_KEY = 'comfyui-settings'

/** localStorage に永続化する設定の型 */
export type PersistedSettings = {
  positive: string
  negative: string
  batchCount: number
  currentCheckpoint: string
  currentWorkflow: string
  /** ワークフロー名 → { itemId → 値 } のマップ */
  optionalValues: Record<string, Record<string, string | number>>
}

const DEFAULT_SETTINGS: PersistedSettings = {
  positive: '',
  negative: '',
  batchCount: 1,
  currentCheckpoint: '',
  currentWorkflow: '',
  optionalValues: {}
}

/**
 * localStorageから永続化設定を読み込む。
 * 未保存またはパース失敗時はデフォルト設定を返す。
 * @returns 読み込まれた設定オブジェクト。
 */
export function loadSettings(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS, optionalValues: {} }
    const parsed = JSON.parse(raw) as Partial<PersistedSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      optionalValues: parsed.optionalValues ?? {}
    }
  } catch {
    return { ...DEFAULT_SETTINGS, optionalValues: {} }
  }
}

/**
 * 現在の保存済み設定に部分マージしてlocalStorageへ書き込む。
 * @param partial 上書き保存する設定の一部。
 * @returns なし。
 */
export function saveSettings(partial: Partial<PersistedSettings>): void {
  try {
    const current = loadSettings()
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...partial }))
  } catch {
    // ストレージ書き込みエラーは無視する
  }
}

/**
 * 指定ワークフローのoptional値を保存済みマップへ上書き保存する。
 * @param workflowName 保存対象のワークフロー名。
 * @param values 保存するoptional値マップ。
 * @returns なし。
 */
export function saveOptionalValues(
  workflowName: string,
  values: Record<string, string | number>
): void {
  const current = loadSettings()
  saveSettings({
    optionalValues: {
      ...current.optionalValues,
      [workflowName]: values
    }
  })
}
