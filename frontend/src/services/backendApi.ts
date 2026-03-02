import type {
  ComfyObjectInfo,
  ComfyUIEndpointResponse,
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
