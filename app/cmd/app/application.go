package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/pkg/browser"
	qrcode "github.com/skip2/go-qrcode"

	"simple-comfyui-gui/app/internal/comfyui"
	"simple-comfyui-gui/app/internal/config"
	"simple-comfyui-gui/app/internal/server"
)

type App struct {
	ctx            context.Context
	frontendURL    string
	accessURLs     []string
	staticServer   *server.StaticServer
	serverStartErr error
}

type ConnectResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

type QRCodeResult struct {
	Success       bool   `json:"success"`
	Message       string `json:"message"`
	AccessURL     string `json:"accessUrl"`
	QRCodeDataURL string `json:"qrCodeDataUrl"`
}

type QRCodeListResult struct {
	Success bool           `json:"success"`
	Message string         `json:"message"`
	Items   []QRCodeResult `json:"items"`
}

type TagsFileExistsResult struct {
	Success bool   `json:"success"`
	Exists  bool   `json:"exists"`
	Message string `json:"message"`
}

const defaultTagsFileURL = "https://gist.githubusercontent.com/pythongosssss/1d3efa6050356a08cea975183088159a/raw/a18fb2f94f9156cf4476b0c24a09544d6c0baec6/danbooru-tags.txt"

func NewApp() *App {
	return &App{
		staticServer: server.NewStaticServer(),
	}
}

func (application *App) startup(ctx context.Context) {
	application.ctx = ctx

	err := application.staticServer.Start()
	if err != nil {
		application.serverStartErr = err
		return
	}

	application.frontendURL = application.staticServer.URL()
	application.accessURLs = application.staticServer.AccessURLs()
}

func (application *App) shutdown(_ context.Context) {
	if application.staticServer == nil {
		return
	}

	_ = application.staticServer.Stop()
}

func (application *App) CheckConnection(rawURL string) ConnectResult {
	normalizedURL, err := comfyui.NormalizeBaseURL(rawURL)
	if err != nil {
		return ConnectResult{Success: false, Message: err.Error()}
	}

	err = comfyui.CheckConnection(context.Background(), normalizedURL)
	if err != nil {
		return ConnectResult{Success: false, Message: err.Error()}
	}

	err = config.Save(config.AppConfig{ComfyUIURL: normalizedURL})
	if err != nil {
		return ConnectResult{Success: true, Message: fmt.Sprintf("ComfyUIへの接続に成功しました（設定保存に失敗: %v）", err)}
	}

	return ConnectResult{Success: true, Message: "ComfyUIへの接続に成功しました"}
}

func (application *App) GetSavedComfyUIURL() string {
	loaded, err := config.Load()
	if err != nil {
		return config.DefaultConfig().ComfyUIURL
	}

	return loaded.ComfyUIURL
}

func (application *App) GetDefaultTagsFileURL() string {
	return defaultTagsFileURL
}

func (application *App) CheckTagsFileExists() TagsFileExistsResult {
	tagsFilePath := application.staticServer.TagsFilePath()
	if tagsFilePath == "" {
		return TagsFileExistsResult{Success: false, Exists: false, Message: "タグファイル保存先が見つかりません"}
	}

	_, err := os.Stat(tagsFilePath)
	if err == nil {
		return TagsFileExistsResult{Success: true, Exists: true, Message: "タグファイルが存在します"}
	}

	if os.IsNotExist(err) {
		return TagsFileExistsResult{Success: true, Exists: false, Message: "タグファイルは未作成です"}
	}

	return TagsFileExistsResult{Success: false, Exists: false, Message: fmt.Sprintf("タグファイル確認に失敗しました: %v", err)}
}

func (application *App) CreateTagsFileFromURL(rawURL string) ConnectResult {
	tagsFilePath := application.staticServer.TagsFilePath()
	if tagsFilePath == "" {
		return ConnectResult{Success: false, Message: "タグファイル保存先が見つかりません"}
	}

	trimmedURL := strings.TrimSpace(rawURL)
	if trimmedURL == "" {
		return ConnectResult{Success: false, Message: "タグファイルURLを入力してください"}
	}

	parsedURL, err := url.Parse(trimmedURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return ConnectResult{Success: false, Message: "タグファイルURLが不正です"}
	}

	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Get(trimmedURL)
	if err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("タグファイル取得に失敗しました: %v", err)}
	}
	defer response.Body.Close()

	if response.StatusCode != http.StatusOK {
		return ConnectResult{Success: false, Message: fmt.Sprintf("タグファイル取得に失敗しました: HTTP %d", response.StatusCode)}
	}

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("タグファイル読み込みに失敗しました: %v", err)}
	}

	err = os.MkdirAll(filepath.Dir(tagsFilePath), 0o755)
	if err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("タグ保存ディレクトリ作成に失敗しました: %v", err)}
	}

	err = os.WriteFile(tagsFilePath, body, 0o644)
	if err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("タグファイル保存に失敗しました: %v", err)}
	}

	return ConnectResult{Success: true, Message: "タグファイルを保存しました"}
}

func (application *App) OpenSimpleComfyUI() ConnectResult {
	if application.serverStartErr != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("Webサーバー起動に失敗しました: %v", application.serverStartErr)}
	}

	if application.frontendURL == "" {
		return ConnectResult{Success: false, Message: "WebサーバーURLが未設定です"}
	}

	if err := browser.OpenURL(application.frontendURL); err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("ブラウザ起動に失敗しました: %v", err)}
	}

	return ConnectResult{Success: true, Message: "SimpleComfyUIを起動しました"}
}

func (application *App) GetQRCode() QRCodeResult {
	listResult := application.GetQRCodes()
	if !listResult.Success {
		return QRCodeResult{Success: false, Message: listResult.Message}
	}

	if len(listResult.Items) == 0 {
		return QRCodeResult{Success: false, Message: "QRコード生成対象のURLが見つかりません"}
	}

	first := listResult.Items[0]
	first.Success = true
	first.Message = "QRコードを生成しました"
	return first
}

func (application *App) GetQRCodes() QRCodeListResult {
	if application.serverStartErr != nil {
		return QRCodeListResult{Success: false, Message: fmt.Sprintf("Webサーバー起動に失敗しました: %v", application.serverStartErr)}
	}

	targetURLs := make([]string, 0, len(application.accessURLs)+1)
	targetURLs = append(targetURLs, application.accessURLs...)
	if application.frontendURL != "" {
		targetURLs = append(targetURLs, application.frontendURL)
	}
	targetURLs = dedupeURLs(targetURLs)

	if len(targetURLs) == 0 {
		return QRCodeListResult{Success: false, Message: "QRコード生成対象のURLが未設定です"}
	}

	items := make([]QRCodeResult, 0, len(targetURLs))
	for _, targetURL := range targetURLs {
		pngBytes, err := qrcode.Encode(targetURL, qrcode.Medium, 256)
		if err != nil {
			return QRCodeListResult{Success: false, Message: fmt.Sprintf("QRコード生成に失敗しました: %v", err)}
		}

		encoded := base64.StdEncoding.EncodeToString(pngBytes)
		items = append(items, QRCodeResult{
			AccessURL:     targetURL,
			QRCodeDataURL: "data:image/png;base64," + encoded,
		})
	}

	return QRCodeListResult{
		Success: true,
		Message: "QRコードを生成しました",
		Items:   items,
	}
}

func dedupeURLs(urls []string) []string {
	seen := map[string]bool{}
	result := make([]string, 0, len(urls))

	for _, url := range urls {
		if url == "" || seen[url] || isLoopbackURL(url) {
			continue
		}
		seen[url] = true
		result = append(result, url)
	}

	return result
}

func isLoopbackURL(rawURL string) bool {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return false
	}

	hostname := parsedURL.Hostname()
	if hostname == "" {
		return false
	}

	if hostname == "localhost" {
		return true
	}

	ip := net.ParseIP(hostname)
	if ip == nil {
		return false
	}

	return ip.IsLoopback()
}
