package main

import (
	"context"
	"fmt"

	"github.com/pkg/browser"

	"simple-comfyui-gui/app/internal/comfyui"
	"simple-comfyui-gui/app/internal/config"
	"simple-comfyui-gui/app/internal/server"
)

type App struct {
	ctx            context.Context
	frontendURL    string
	staticServer   *server.StaticServer
	serverStartErr error
}

type ConnectResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
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
