param(
    [string]$Go = "go",
    [string]$RuntimeDir = "../runtime"
)

$ErrorActionPreference = "Stop"

New-Item -ItemType Directory -Path $RuntimeDir -Force | Out-Null

$outputName = "app.exe"
& $Go build -tags production -o (Join-Path $RuntimeDir $outputName) ./cmd/app

Write-Host "Built:" (Join-Path $RuntimeDir $outputName)
