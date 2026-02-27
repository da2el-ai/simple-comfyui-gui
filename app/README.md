# Go アプリ開発環境

このディレクトリは Go + Fyne バックエンド開発用の土台です。
現時点ではソースコード（`.go`）はまだ配置していません。

## 前提

- Go 1.24 以上
- `make`（任意）

## 初期確認

```bash
cd app
make env-check
```

## よく使うコマンド

```bash
cd app
make fmt
make test
make tidy
make build
```

`make build` は `../runtime/bin/app` を出力先にします。
