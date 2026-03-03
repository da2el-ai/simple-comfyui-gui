import type {
  ComfyObjectInfo,
  ComfyQueue,
  ComfyUIEndpointResponse,
  PromptHistory,
  PromptResponse,
  SelectorAddRequest,
  SelectorAllData,
  SelectorDeleteRequest,
  SelectorEditRequest,
  WorkflowData,
  WorkflowName,
  WorkflowsResponse
} from '../types/api'

/** キャッシュを避けるためURLに時刻クエリを付与する */
function withCacheBust(path: string): string {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}_t=${Date.now()}`
}

/** キャッシュ無効でGETリクエストする */
async function fetchNoStore(path: string): Promise<Response> {
  return fetch(withCacheBust(path), { cache: 'no-store' })
}

/** バックエンドHTTP APIへGETリクエストする */
async function getJson<T>(path: string): Promise<T> {
  const response = await fetchNoStore(path)
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`)
  }
  return (await response.json()) as T
}

/** ComfyUIエンドポイントURLを取得する */
export async function fetchComfyUIEndpoint(): Promise<string> {
  const data = await getJson<ComfyUIEndpointResponse>('/api/comfyui_endpoint')
  return data.endpoint
}

/** ワークフロー名一覧を取得する */
export async function fetchWorkflows(): Promise<WorkflowName[]> {
  const data = await getJson<WorkflowsResponse>('/api/workflows')
  return data
}

/** ワークフロー設定YAMLを取得する */
export async function fetchWorkflowConfigText(workflowName: string): Promise<string> {
  const candidatePaths = [
    `/workflow/${workflowName}.yaml`,
    `/workflow/${workflowName}_config.yaml`
  ]

  for (const path of candidatePaths) {
    const response = await fetchNoStore(path)
    if (response.ok) {
      return response.text()
    }
  }

  throw new Error('workflow config取得に失敗しました: 設定ファイルが見つかりません')
}

/** ComfyUIの object_info を取得する */
export async function fetchComfyObjectInfo(endpoint: string): Promise<ComfyObjectInfo> {
  const response = await fetch(`${endpoint}/object_info`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`ComfyUI object_info取得に失敗しました: ${response.status}`)
  }
  return (await response.json()) as ComfyObjectInfo
}

/** ワークフローJSONを取得する */
export async function fetchWorkflowJson(workflowName: string): Promise<WorkflowData> {
  const response = await fetchNoStore(`/workflow/${workflowName}.json`)
  if (!response.ok) {
    throw new Error(`workflow json取得に失敗しました: ${response.status}`)
  }
  return (await response.json()) as WorkflowData
}

/** ComfyUIへpromptを送信する */
export async function submitPrompt(endpoint: string, prompt: WorkflowData): Promise<PromptResponse> {
  const response = await fetch(`${endpoint}/prompt`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ prompt })
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`prompt送信に失敗しました: ${response.status} ${errorText}`)
  }

  return (await response.json()) as PromptResponse
}

/** ComfyUIの履歴を取得する */
export async function fetchPromptHistory(endpoint: string, promptId: string): Promise<PromptHistory> {
  const response = await fetch(`${endpoint}/history/${promptId}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`history取得に失敗しました: ${response.status}`)
  }
  return (await response.json()) as PromptHistory
}

/** ComfyUIのキュー状態を取得する */
export async function fetchQueue(endpoint: string): Promise<ComfyQueue> {
  const response = await fetch(`${endpoint}/queue`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`queue取得に失敗しました: ${response.status}`)
  }
  return (await response.json()) as ComfyQueue
}

/** ComfyUIの保留中キューを削除する */
export async function deleteQueueItems(endpoint: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return
  const response = await fetch(`${endpoint}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ delete: ids })
  })
  if (!response.ok) {
    throw new Error(`queue削除に失敗しました: ${response.status}`)
  }
}

// ─── PromptSelector API ────────────────────────────────────────────────────────

/** セレクター全データを取得する */
export async function fetchSelectorData(): Promise<SelectorAllData> {
  return getJson<SelectorAllData>('/api/selector/')
}

/** セレクターアイテムを追加する */
export async function addSelectorItem(req: SelectorAddRequest): Promise<void> {
  const response = await fetch('/api/selector/add', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  })
  if (!response.ok) {
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? `selector/add 失敗: ${response.status}`)
  }
}

/** セレクターアイテムを編集する */
export async function editSelectorItem(
  category: string,
  subcategory: string,
  name: string,
  req: SelectorEditRequest
): Promise<void> {
  const response = await fetch(
    `/api/selector/edit/${encodeURIComponent(category)}/${encodeURIComponent(subcategory)}/${encodeURIComponent(name)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req)
    }
  )
  if (!response.ok) {
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? `selector/edit 失敗: ${response.status}`)
  }
}

/** セレクターデータ（アイテム/サブカテゴリ/カテゴリ）を削除する */
export async function deleteSelectorData(req: SelectorDeleteRequest): Promise<void> {
  const response = await fetch('/api/selector/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req)
  })
  if (!response.ok) {
    const data = (await response.json()) as { error?: string }
    throw new Error(data.error ?? `selector/delete 失敗: ${response.status}`)
  }
}
