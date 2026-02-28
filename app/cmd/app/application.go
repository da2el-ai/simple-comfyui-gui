package main

import (
	"context"
	"fmt"

	"github.com/pkg/browser"

	"simple-comfyui-gui/app/internal/comfyui"
)

type App struct {
	ctx         context.Context
	frontendURL string
}

type ConnectResult struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

func NewApp() *App {
	return &App{
		frontendURL: "http://127.0.0.1:3000",
	}
}

func (application *App) startup(ctx context.Context) {
	application.ctx = ctx
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

	return ConnectResult{Success: true, Message: "ComfyUIへの接続に成功しました"}
}

func (application *App) OpenSimpleComfyUI() ConnectResult {
	if err := browser.OpenURL(application.frontendURL); err != nil {
		return ConnectResult{Success: false, Message: fmt.Sprintf("ブラウザ起動に失敗しました: %v", err)}
	}

	return ConnectResult{Success: true, Message: "SimpleComfyUIを起動しました"}
}
