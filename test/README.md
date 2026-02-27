# テスト配置ルール

`/test` 配下にテストを集約し、フロントエンドとバックエンドを分離します。

## 構成

- `backend/unit`: Go の単体テスト
- `backend/integration`: Go の結合テスト
- `backend/fixtures`: Go テスト用固定データ
- `frontend/unit`: Vue の単体テスト
- `frontend/e2e`: Vue の E2E テスト
- `frontend/fixtures`: フロントテスト用固定データ
