export type TDynamicInputType = 'list' | 'text' | 'number' | 'textarea' | 'image'

export type TDynamicInputItem = {
  id: string
  title: string
  type: TDynamicInputType
  options: string[]
  value: string | number
}
