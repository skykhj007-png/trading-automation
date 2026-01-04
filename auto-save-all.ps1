# Auto Save All Projects
# Automatically detects all git repositories in C:\Users\kim

$baseFolder = "C:\Users\kim"
$debounceSeconds = 3
$lastSave = @{}
$watchers = @()

function Get-GitFolders {
    $folders = @()
    Get-ChildItem -Path $baseFolder -Directory | ForEach-Object {
        $gitPath = Join-Path $_.FullName ".git"
        if (Test-Path $gitPath) {
            $folders += $_.FullName
        }
    }
    return $folders
}

function Start-Watching {
    $folders = Get-GitFolders

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Auto Save All Projects" -ForegroundColor Green
    Write-Host "Base: $baseFolder" -ForegroundColor Yellow
    Write-Host "Watching:" -ForegroundColor Yellow
    foreach ($f in $folders) {
        $name = Split-Path $f -Leaf
        Write-Host "  - $name" -ForegroundColor Yellow
        $lastSave[$f] = [DateTime]::MinValue
    }
    Write-Host "New projects will be detected automatically!" -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan

    # Create watchers for each folder
    foreach ($folder in $folders) {
        $watcher = New-Object System.IO.FileSystemWatcher
        $watcher.Path = $folder
        $watcher.Filter = "*.*"
        $watcher.IncludeSubdirectories = $false
        $watcher.EnableRaisingEvents = $true

        Register-ObjectEvent -InputObject $watcher -EventName Changed -Action {
            Save-Changes -folder $Event.MessageData -name $Event.SourceEventArgs.Name
        } -MessageData $folder | Out-Null

        $script:watchers += $watcher
    }

    return $folders
}

function Save-Changes {
    param($folder, $name)

    $now = Get-Date
    $time = Get-Date -Format "HH:mm:ss"

    # Skip unwanted files
    if ($name -like "*.git*") { return }
    if ($name -like "*.tmp") { return }
    if ($name -like "*node_modules*") { return }

    # Only watch these extensions
    $ext = [System.IO.Path]::GetExtension($name)
    if ($ext -notin @(".js", ".gs", ".pine", ".md", ".ps1", ".bat", ".json", ".tsx", ".ts", ".css", ".html", ".vue", ".jsx", ".py", ".sh")) { return }

    # Debounce
    if (-not $lastSave.ContainsKey($folder)) {
        $lastSave[$folder] = [DateTime]::MinValue
    }
    if (($now - $lastSave[$folder]).TotalSeconds -lt $debounceSeconds) { return }
    $lastSave[$folder] = $now

    $projectName = Split-Path $folder -Leaf
    Write-Host "[$time] [$projectName] $name changed" -ForegroundColor Yellow

    # Run git commands
    Push-Location $folder
    git add -A 2>$null
    $commitResult = git commit -m "Auto-save: $name ($time)" 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$time] [$projectName] Committed!" -ForegroundColor Green
        git push 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$time] [$projectName] Pushed!" -ForegroundColor Cyan
        }
    }
    Pop-Location
}

# Initial start
$currentFolders = Start-Watching

Write-Host ""
Write-Host "Watching for changes..." -ForegroundColor Green

# Check for new projects every 60 seconds
$lastCheck = Get-Date

while ($true) {
    Start-Sleep -Seconds 5

    # Check for new projects periodically
    $now = Get-Date
    if (($now - $lastCheck).TotalSeconds -ge 60) {
        $newFolders = Get-GitFolders
        $addedFolders = $newFolders | Where-Object { $_ -notin $currentFolders }

        foreach ($folder in $addedFolders) {
            $name = Split-Path $folder -Leaf
            Write-Host "[NEW PROJECT DETECTED] $name" -ForegroundColor Magenta

            $watcher = New-Object System.IO.FileSystemWatcher
            $watcher.Path = $folder
            $watcher.Filter = "*.*"
            $watcher.IncludeSubdirectories = $false
            $watcher.EnableRaisingEvents = $true

            Register-ObjectEvent -InputObject $watcher -EventName Changed -Action {
                Save-Changes -folder $Event.MessageData -name $Event.SourceEventArgs.Name
            } -MessageData $folder | Out-Null

            $watchers += $watcher
            $lastSave[$folder] = [DateTime]::MinValue
            $currentFolders += $folder
        }

        $lastCheck = $now
    }
}
