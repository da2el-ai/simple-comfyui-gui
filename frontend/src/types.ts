export type TDynamicInputType = 'list' | 'text' | 'number' | 'textarea'

export type TDynamicInputItem = {
  id: string
  title: string
  type: TDynamicInputType
  options: string[]
  value: string | number
}
