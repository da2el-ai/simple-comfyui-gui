param(
    [string]$Go = "go",
    [string]$WailsCmd = "github.com/wailsapp/wails/v2/cmd/wails@v2.11.0",
    [string]$WailsProjectDir = "./cmd/app",
    [string]$RuntimeDir = "../runtime"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

Push-Location $WailsProjectDir
try {
    & $Go run $WailsCmd build -s

    if (Test-Path "./build/bin") {
        Copy-Item "./build/bin/*" "../../../runtime/" -Recurse -Force
    }

    if (Test-Path "./build") {
        Remove-Item "./build" -Recurse -Force
    }
}
finally {
    Pop-Location
}

Write-Host "Wails build artifacts copied to" (Resolve-Path $RuntimeDir)
