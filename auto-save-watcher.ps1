# V39 Auto Save Watcher
# Run: .\auto-save-watcher.ps1

$folder = "C:\Users\kim\trading-automation"
$debounceSeconds = 3

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "V39 Auto Save Watcher" -ForegroundColor Green
Write-Host "Folder: $folder" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan

$lastSave = [DateTime]::MinValue

$watcher = New-Object System.IO.FileSystemWatcher
$watcher.Path = $folder
$watcher.Filter = "*.*"
$watcher.IncludeSubdirectories = $false

while ($true) {
    $result = $watcher.WaitForChanged("Changed", 1000)

    if ($result.TimedOut) { continue }

    $name = $result.Name
    $now = Get-Date
    $time = Get-Date -Format "HH:mm:ss"

    # Skip unwanted files
    if ($name -like "*.git*") { continue }
    if ($name -like "*.tmp") { continue }
    if ($name -like "*node_modules*") { continue }

    # Only watch these extensions
    $ext = [System.IO.Path]::GetExtension($name)
    if ($ext -notin @(".js", ".pine", ".md", ".ps1", ".bat")) { continue }

    # Debounce
    if (($now - $lastSave).TotalSeconds -lt $debounceSeconds) { continue }
    $lastSave = $now

    Write-Host "[$time] $name changed" -ForegroundColor Yellow

    # Run git commands
    cmd /c "cd /d $folder && git add -A && git commit -m `"Auto-save: $name ($time)`""

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$time] Committed!" -ForegroundColor Green
    }
}
