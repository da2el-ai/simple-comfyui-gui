param(
    [string]$Go = "go",
    [string]$WailsCmd = "github.com/wailsapp/wails/v2/cmd/wails@v2.11.0",
    [string]$WailsProjectDir = "./cmd/app"
)

$ErrorActionPreference = "Stop"

Push-Location $WailsProjectDir
try {
    & $Go run $WailsCmd dev -s
}
finally {
    Pop-Location
}
