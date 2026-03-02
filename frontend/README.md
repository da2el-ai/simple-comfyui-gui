# frontend 開発・配布手順

このディレクトリは `simple-comfyui-gui` のフロントエンド（Vue + TypeScript + Vite）です。

## 前提

- Node.js: 20 LTS 推奨
- npm

> 補足: Node 21 でも実行は可能ですが、依存パッケージの `engine` 警告が出る場合があります。

## 1. 環境構築

```bash
cd frontend
npm install
```

## 2. 開発サーバー起動

```bash
cd frontend
npm run dev -- --host 127.0.0.1 --port 5173
```

- 画面URL: `http://127.0.0.1:5173`
- バックエンドは `VITE_BACKEND_ORIGIN`（未指定時は `http://localhost:3000`）へプロキシします

必要ならバックエンド接続先を指定して起動します。

```bash
cd frontend
VITE_BACKEND_ORIGIN=http://xxx.xxx.xxx.xxx:3000 npm run dev -- --host 127.0.0.1 --port 5173
```

## 3. 品質チェック

```bash
cd frontend
npm run lint
npm run test
```

## 4. フロント本番ビルド

```bash
cd frontend
npm run build
```

- 出力先: `frontend/dist`

## 5. 配布用アセットへ反映

以下を1コマンドで実行できます。

```bash
cd frontend
npm run build:runtime
```

このコマンドで実行される内容:

1. `npm run build`
2. `../runtime/frontend` を作り直し
3. `dist` の内容を `../runtime/frontend` にコピー

## 6. 配布までの全体手順（推奨）

```bash
cd frontend
npm run build:runtime

cd ../app
make wails-build
```

- フロント配布アセット: `runtime/frontend`
- ワークフロー配布アセット: `runtime/workflow`
- アプリ成果物（macOS）: `runtime/*.app`

## 7. トラブルシュート

### `npm run dev` が `package.json` を見つけられない

`frontend` 以外のディレクトリで実行している可能性があります。以下のどちらかで実行してください。

```bash
cd frontend && npm run dev
```

または

```bash
npm --prefix /absolute/path/to/simple-comfyui-gui/frontend run dev
```
