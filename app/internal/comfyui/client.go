package comfyui

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const connectTimeout = 5 * time.Second

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
