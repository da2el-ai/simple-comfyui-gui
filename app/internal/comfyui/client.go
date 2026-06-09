package comfyui

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const connectTimeout = 5 * time.Second

// object_infoは約12MBと大きく取得に時間がかかるため、接続確認より長いタイムアウトを設ける
const objectInfoTimeout = 60 * time.Second

// URLを正規化する
func NormalizeBaseURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("ComfyUI URLを入力してください")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return "", fmt.Errorf("ComfyUI URLの形式が不正です")
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("ComfyUI URLはhttp:// または https:// で入力してください")
	}

	if parsed.Host == "" {
		return "", fmt.Errorf("ComfyUI URLにホスト名がありません")
	}

	return strings.TrimRight(trimmed, "/"), nil
}

// ComfyUI APIへの接続を確認する
func CheckConnection(ctx context.Context, baseURL string) error {
	normalizedURL, err := NormalizeBaseURL(baseURL)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, normalizedURL+"/system_stats", nil)
	if err != nil {
		return fmt.Errorf("接続リクエストの作成に失敗しました")
	}

	httpClient := &http.Client{Timeout: connectTimeout}
	res, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("ComfyUIへの接続に失敗しました: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("ComfyUI APIの応答が異常です: %d", res.StatusCode)
	}

	return nil
}

// FetchObjectInfo はComfyUIから/object_infoのレスポンス本文（JSONバイト列）を取得して返す。
// baseURLは保存済み設定のComfyUI URLを想定し、内部で正規化する。
// レスポンスが約12MBと大きいため、長めのタイムアウト(objectInfoTimeout)を用いる。
// この生のJSONをバックエンドがgzip圧縮して配信することで、Tailscale等の低速回線越しの
// 転送量を削減する用途で使う。
func FetchObjectInfo(ctx context.Context, baseURL string) ([]byte, error) {
	normalizedURL, err := NormalizeBaseURL(baseURL)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, normalizedURL+"/object_info", nil)
	if err != nil {
		return nil, fmt.Errorf("object_infoリクエストの作成に失敗しました")
	}

	httpClient := &http.Client{Timeout: objectInfoTimeout}
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("ComfyUIからobject_infoの取得に失敗しました: %w", err)
	}
	defer res.Body.Close()

	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, fmt.Errorf("ComfyUI object_infoの応答が異常です: %d", res.StatusCode)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, fmt.Errorf("object_infoの読み込みに失敗しました: %w", err)
	}

	return body, nil
}
