import type { ComfyUIEndpointResponse, WorkflowName, WorkflowsResponse } from '../types/api'

/** バックエンドHTTP APIへGETリクエストする */
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
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
  return data.workflows
}
