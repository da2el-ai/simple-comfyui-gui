package main

import (
	"context"
	"encoding/base64"
	"fmt"

	"github.com/pkg/browser"
	qrcode "github.com/skip2/go-qrcode"

	"simple-comfyui-gui/app/internal/comfyui"
	"simple-comfyui-gui/app/internal/config"
	"simple-comfyui-gui/app/internal/server"
)

type App struct {
	ctx            context.Context
	frontendURL    string
	lanFrontendURL string
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
	application.lanFrontendURL = application.staticServer.LANURL()
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
	if application.serverStartErr != nil {
		return QRCodeResult{Success: false, Message: fmt.Sprintf("Webサーバー起動に失敗しました: %v", application.serverStartErr)}
	}

	targetURL := application.lanFrontendURL
	if targetURL == "" {
		targetURL = application.frontendURL
	}

	if targetURL == "" {
		return QRCodeResult{Success: false, Message: "QRコード生成対象のURLが未設定です"}
	}

	pngBytes, err := qrcode.Encode(targetURL, qrcode.Medium, 256)
	if err != nil {
		return QRCodeResult{Success: false, Message: fmt.Sprintf("QRコード生成に失敗しました: %v", err)}
	}

	encoded := base64.StdEncoding.EncodeToString(pngBytes)
	return QRCodeResult{
		Success:       true,
		Message:       "QRコードを生成しました",
		AccessURL:     targetURL,
		QRCodeDataURL: "data:image/png;base64," + encoded,
	}
}
