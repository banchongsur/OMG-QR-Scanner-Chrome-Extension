$ErrorActionPreference = "Stop"
$lib = Join-Path $PSScriptRoot "lib"
New-Item -ItemType Directory -Force -Path $lib | Out-Null

$downloads = @(
  @{
    Url = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"
    Out = (Join-Path $lib "jsQR.js")
  },
  @{
    Url = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.mjs"
    Out = (Join-Path $lib "pdf.mjs")
  },
  @{
    Url = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.mjs"
    Out = (Join-Path $lib "pdf.worker.mjs")
  }
)

foreach ($item in $downloads) {
  Write-Host "Downloading $($item.Url)" -ForegroundColor Cyan
  Invoke-WebRequest -Uri $item.Url -OutFile $item.Out
  if (!(Test-Path $item.Out) -or (Get-Item $item.Out).Length -lt 1000) {
    throw "Download failed or file too small: $($item.Out)"
  }
  Write-Host "Saved: $($item.Out)" -ForegroundColor Green
}
Write-Host "`nLibraries installed. Now load this folder in chrome://extensions" -ForegroundColor Green
