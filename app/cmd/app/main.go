package main

import (
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	application := NewApp()

	err := wails.Run(&options.App{
		Title:  "Simple ComfyUI GUI",
		Width:  520,
		Height: 360,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup: application.startup,
		Bind: []interface{}{
			application,
		},
	})

	if err != nil {
		log.Fatal(err)
	}
}
