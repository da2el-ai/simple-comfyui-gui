param(
    [string]$Go = "go",
    [string]$WailsCmd = "github.com/wailsapp/wails/v2/cmd/wails@v2.11.0",
    [string]$WailsProjectDir = "./cmd/app",
    [string]$RuntimeDir = "../runtime",
    [string]$IconSource = "../icon.png"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

$iconTargetDir = Join-Path $WailsProjectDir "build"
$iconTargetPath = Join-Path $iconTargetDir "appicon.png"

if (Test-Path $IconSource) {
    New-Item -ItemType Directory -Path $iconTargetDir -Force | Out-Null
    Copy-Item $IconSource $iconTargetPath -Force
}

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
