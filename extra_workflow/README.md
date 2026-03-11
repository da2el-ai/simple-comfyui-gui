# ComfyUI Simple Interface GUI Extra Workflow

ComfyUI Simple Interface GUI で使う拡張ワークフローです。

標準で同梱していない理由は、「他のワークフローや設定が必要」「使う人が少ない」というものです。

## NovelAI


- NovelAIで画像を生成するためのワークフロー
- Eagleに保存

### 必要なカスタムノード

- [D2-nodes-ComfyUI](https://github.com/da2el-ai/d2-nodes-comfyui)
- だにえる版 [ComfyUI_NAIDGenerator](https://github.com/da2el-ai/ComfyUI_NAIDGenerator) 
  - [本家版](https://github.com/bedovyy/ComfyUI_NAIDGenerator) では動作しない可能性があります
- [comfyui-dynamicprompts](https://github.com/adieyal/comfyui-dynamicprompts)

## D2_txt2img_extra

- Controlnetが使えるワークフロー
  - Controlnetは無効にすることも可能
  - AnyTest以外での使用は想定していません
- ワイルドカードも使えるのでtxt2imgならこれで十分
- Eagleに保存

### 必要なカスタムノード

- [D2-nodes-ComfyUI](https://github.com/da2el-ai/d2-nodes-comfyui)
- [comfyui-dynamicprompts](https://github.com/adieyal/comfyui-dynamicprompts)
- Controlnetの各種モデル