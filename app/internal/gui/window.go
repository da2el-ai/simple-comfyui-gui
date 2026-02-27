package gui

import (
	"image/color"

	"fyne.io/fyne/v2"
	"fyne.io/fyne/v2/app"
	"fyne.io/fyne/v2/canvas"
	"fyne.io/fyne/v2/container"
	"fyne.io/fyne/v2/widget"
)

const (
	windowTitle  = "Simple ComfyUI GUI"
	windowWidth  = 520
	windowHeight = 360
)

func Run() {
	uiApp := app.New()
	mainWindow := uiApp.NewWindow(windowTitle)

	mainWindow.SetContent(buildMainContent())
	mainWindow.Resize(fyne.NewSize(windowWidth, windowHeight))
	mainWindow.ShowAndRun()
}

func buildMainContent() fyne.CanvasObject {
	urlLabel := widget.NewLabel("ComfyUI URL")
	urlEntry := widget.NewEntry()
	urlEntry.SetPlaceHolder("http://localhost:8188")

	connectButton := widget.NewButton("ComfyUIに接続", func() {
	})

	openUIButton := widget.NewButton("SimpleComfyUI起動", func() {
	})
	openUIButton.Disable()

	gapAfterEntry := canvas.NewRectangle(color.Transparent)
	gapAfterEntry.SetMinSize(fyne.NewSize(0, 12))

	gapAfterConnect := canvas.NewRectangle(color.Transparent)
	gapAfterConnect.SetMinSize(fyne.NewSize(0, 12))

	qrTitle := widget.NewLabel("QRコード")
	qrPlaceholder := widget.NewLabel("接続後に表示")
	qrContainer := container.NewVBox(qrTitle, qrPlaceholder)
	qrContainer.Hide()

	content := container.NewVBox(
		urlLabel,
		urlEntry,
		gapAfterEntry,
		connectButton,
		gapAfterConnect,
		openUIButton,
		qrContainer,
	)

	return container.NewPadded(content)
}
