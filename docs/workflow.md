# ComfyUI Simple Interface GUI: ワークフローカスタマイズ

ワークフローを自分で作成・編集するためのドキュメントです。


## ワークフローのカスタマイズ

自分が普段使っているワークフローを使うことも可能です。

1. ComfyUIのメニューから `Export (API)` で保存
1. 保存したワークフローを、`{Simple ComfyUI GUIインストールフォルダ}/workflow/` フォルダに移動
1. 既存のYAMLファイルを複製して、名前を `{ワークフローのファイル名}.yaml` に変更
1. ワークフローの内容にあわせてYAMLファイルを編集

```
+-- Simple ComfyUI GUI
+-- /workflow
    +-- my-workflow.json  # ワークフロー
    +-- my-workflow.yaml  # ワークフロー設定ファイル
```


### ワークフロー（JSON）の構造

まずはワークフローの構造を知っておく必要があります。

下記はワークフローから `D2_KSampler` の部分を抜粋したものです。<br>
これを念頭に置いて以降の説明をお読みください。

```json
{
  "14": {                            # ID
    "inputs": {
      "seed": 913571682214506,       # 入力項目の名前と値
      "steps": 20,
      〜〜省略〜〜
    },
    "class_type": "D2 KSampler",     # ノードの名前
    "_meta": {
      "title": "D2 KSampler"         # ノードの表示名
    }
  },
}
```

### ワークフロー設定ファイル（YAML）

ワークフローをSimpleComfyUIで使用するための設定ファイルです。<br>
ワークフローの内容に合わせて変更する必要があります。

#### 画像を出力するノードのID（通常はSaveImage）

画像保存ノードのIDを指定します。


```yaml
output_node_id: 9
```

#### 必須の入力項目

Positive / Negativeプロンプト、Checkpointローダー、Seedです。

```yaml
required:
  -
    id: "positive"
    workflow:
      search_type: "title"
      search_value: "Positive"
      input_name: "prompt"
  -
    id: "negative"
    workflow:
      search_type: "title"
      search_value: "Negative"
      input_name: "prompt"
  -
    id: "checkpoint"
    workflow:
      search_type: "id"
      search_value: 10
      input_name: "ckpt_name"
  -
    id: "seed"
    workflow:
      search_type: "class_type"
      search_value: "D2 KSampler"
      input_name: "seed"
```

上記の `positive` について説明します。

Positiveプロンプトはワークフローでは下記のようになっています。<br>
カスタムノードの名前は `D2 Prompt` ですが、表示名を `Positive` に変更しています。そのため `search_type: "title"` として表示名から検索しています。

```json
# ワークフローのPositiveプロンプト入力部分
  "16": {
    "inputs": {
      "prompt": "1girl",
      "comment_type": "# + // + /**/",
      "insert_lora": "CHOOSE",
      "token_count": false
    },
    "class_type": "D2 Prompt",
    "_meta": {
      "title": "Positive"
    }
  },
```

##### Checkpointについて

不要な場合もあるので `id:checkpoint` は無しでもOKにしました。`required` なのに……。



#### 必須の入力項目（required）のパラメーター

- `id`: 名前は固定なので変更禁止
- `search_type`: 該当ノードの検索対象
  - `class_type`
  - `title`
  - `id`
- `search_value`: 該当ノードの検索ワード
- `input_name`: 入力名


#### 追加の入力項目（optional）

ワークフロー毎に追加できる設定項目です。

下記はプルダウンメニュー（Image Size Preset）と数値入力（Width）の例です。<br>
`size_preset` では `D2 Size Selector` のプリセット名を `["D2 Size Selector", "input", "required", preset, 0]` という順番に辿って取得しています。

```
optional:
  -
    id: "size_preset"
    input:
      title: "Image Size Preset"
      type: "list"
      value: ["D2 Size Selector", "input", "required", preset, 0]
    workflow:
      search_type: "class_type"
      search_value: "D2 Size Selector"
      input_name: "preset"
  -
    id: "width"
    input:
      title: "Width"
      type: "number"
      default: 1024
    workflow:
      search_type: "class_type"
      search_value: "D2 Size Selector"
      input_name: "width"
```

#### 追加の入力項目（optional）のパラメーター

- `id`: 他とバッティングしない一意の名前
- `input`: 画面に表示する項目の設定
  - `title`: 表示名
  - `type`: 入力項目のタイプ
    - `prompt`: ツールバー付きプロンプト入力
    - `text`: 文字列
    - `textarea`: 複数行テキスト
    - `number`: 数値
    - `list`: リスト
    - `image`: 画像読み込み
    - `seed`: 乱数
    - `switch`: 指定したノードと入力項目の有効・無効を切り替える
    - `boolean`: 指定したノード入力に真偽値（true/false）を直接設定するトグル
  - `default`: 初期状態で表示する内容
  - `value`: 初期状態で表示する内容。リストなど変更不可なもので使う
    -  カスタムノードから値を取得するにはワークフローを辿る配列を指定
    -  `["D2 Size Selector", "input", "required", preset, 0]`
- `workflow`: ワークフローに関する設定
  - `search_type`: 該当ノードの検索対象
    - `class_type`
    - `title`
    - `id`
  - `search_value`: 該当ノードの検索ワード
  - `input_name`: 入力名
- `switch`: `type:switch` で使用する項目 
  - `workflow`
    - `targets`
      - ワークフローで有効・無効を切り替える対象をリスト形式で指定
      - IDまたは、ワークフローの先頭からの探索経路
      - 例：`54`
      - 例：`["53", "inputs", "any_01"]`
  - `items`
    - スイッチで表示・非表示を切り替える入力項目をネストして定義する
    - 各項目は通常の `optional` 項目と同じ形式（`id`, `input`, `workflow`）
    - スイッチON時のみ画面に表示され、OFF時は非表示になる
    - 画面上ではボーダーで囲まれたグループとして描画される


