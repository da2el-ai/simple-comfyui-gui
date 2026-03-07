export type TDynamicInputType = 'list' | 'text' | 'number' | 'textarea' | 'image' | 'seed'

export type TDynamicInputItem = {
  id: string
  title: string
  type: TDynamicInputType
  options: string[]
  value: string | number
}
