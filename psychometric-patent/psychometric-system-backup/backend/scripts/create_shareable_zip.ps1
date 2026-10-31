$ErrorActionPreference = "Stop"

$src = "c:\Users\prayu\Downloads\psychometric-patent-platform latest\psychometric-patent-platform"
$staging = Join-Path $env:TEMP "psychometric-platform-shareable"
$zipPath = "c:\Users\prayu\Downloads\psychometric-patent-platform-updated.zip"

Write-Host "Cleaning up staging directory..."
if (Test-Path $staging) {
    Remove-Item -Path $staging -Recurse -Force
}
New-Item -ItemType Directory -Path $staging -Force | Out-Null

Write-Host "Copying project files (excluding node_modules, .git, dist, and cache)..."
& robocopy $src $staging /E /XD node_modules .git dist .vite temp /XF *.log /R:1 /W:1 | Out-Null

Write-Host "Compressing to $zipPath ..."
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}

Compress-Archive -Path "$staging\*" -DestinationPath $zipPath -CompressionLevel Optimal

Write-Host "Cleaning up staging folder..."
Remove-Item -Path $staging -Recurse -Force

Write-Host "ZIP Creation Complete!"
Get-Item $zipPath | Select-Object FullName, Length, LastWriteTime
