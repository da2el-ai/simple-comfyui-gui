# Go + Wails 開発運用

このディレクトリは `simple-comfyui-gui` の Go + Wails 実装です。

## 前提

- Go 1.24 以上
- macOS / Linux: `make`
- Windows: PowerShell 5.1 以上（`make` 不要）
- macOS の場合: Xcode Command Line Tools

## 初期確認

```bash
cd app
make env-check
```

## 開発（Wails）

```bash
cd app
make wails-dev
```

Windows の場合は以下を実行してください（`make` 不要）。

```powershell
cd app
powershell -ExecutionPolicy Bypass -File .\scripts\wails-dev.ps1
```

- Wails の開発モードで起動します
- `make wails-dev` は内部で `go run github.com/wailsapp/wails/v2/cmd/wails@v2.11.0 dev` を実行します

## 本番ビルド（現行運用）

```bash
cd app
make build
```

Windows の場合は以下を実行してください（`make` 不要）。

```powershell
cd app
powershell -ExecutionPolicy Bypass -File .\scripts\build.ps1
```

- 出力先: `../runtime/app`（Windows は `../runtime/app.exe`）
- ビルド時に `production` タグを付与します

## 配布向けビルド（推奨）

配布用は `make wails-build` を使用してください。

```bash
cd app
make wails-build
```

Windows の場合は以下を実行してください（`make` 不要）。

```powershell
cd app
powershell -ExecutionPolicy Bypass -File .\scripts\wails-build.ps1
```

- `make build` は単体バイナリ生成用（ターミナル起動向け）です
- 配布用途では Wails 標準の成果物（macOS なら `.app`）を使用します
- 出力先（macOS）: `runtime/*.app`

### 起動方法（macOS）

1. `make wails-build` 実行後、生成された `.app` を Finder で開く
2. またはターミナルから `open <生成されたappのパス>` で起動する

配布時の推奨配置（同階層）:

```text
配布フォルダ/
	├── Simple ComfyUI GUI.app
	├── frontend/
	└── workflow/
```

※ `.app` は同階層の `frontend/` と `workflow/` を探索して起動します

例:

```bash
open ../runtime/Simple\ ComfyUI\ GUI.app
```

※ `make wails-build` 実行時は `cmd/app/build/bin` のみ自動削除されます
※ アイコンなどの静的ファイル（例: `cmd/app/build/appicon.png`）は保持されます

## 実行

```bash
cd app
make run
```

- `make run` は `../runtime/app` を実行します

## 補助コマンド

```bash
cd app
make fmt
make test
make tidy
```

## バックエンドHTTP API（フロント向け）

- `GET /api/comfyui_endpoint`
- `GET /api/workflows`
- `GET /api/tags`（`tags/autocomplete.csv` または `runtime/tags/autocomplete.csv` を配信）
- `GET /api/selector/`（`runtime/selector/*.yml` を集約して返却）
- `POST /api/selector/add`
- `POST /api/selector/edit/{category}/{subcategory}/{name}`
- `POST /api/selector/delete`

`PromptSelector` で使用するセレクターデータは `runtime/selector/*.yml` を編集して管理します。
