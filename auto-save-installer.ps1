# ========================================
# Auto Save Installer - One Click Setup
# ========================================
#
# 사용법 (다른 컴퓨터에서):
# 1. PowerShell 관리자 권한으로 실행
# 2. 아래 명령어 복사해서 실행:
#
# irm https://raw.githubusercontent.com/skykhj007-png/trading-automation/main/auto-save-installer.ps1 | iex
#
# ========================================

$baseFolder = $env:USERPROFILE
$scriptPath = Join-Path $baseFolder "auto-save-all.ps1"
$taskName = "AutoSaveAllProjects"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Auto Save Installer" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Download auto-save-all.ps1
Write-Host "[1/3] Downloading auto-save script..." -ForegroundColor Yellow

$scriptContent = @'
# Auto Save All Projects
# Automatically detects all git repositories

$baseFolder = $env:USERPROFILE
$debounceSeconds = 3
$lastSave = @{}
$watchers = @()

function Get-GitFolders {
    $folders = @()
    Get-ChildItem -Path $baseFolder -Directory -ErrorAction SilentlyContinue | ForEach-Object {
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
    Write-Host "========================================" -ForegroundColor Cyan

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

    if ($name -like "*.git*") { return }
    if ($name -like "*.tmp") { return }
    if ($name -like "*node_modules*") { return }

    $ext = [System.IO.Path]::GetExtension($name)
    if ($ext -notin @(".js", ".gs", ".pine", ".md", ".ps1", ".bat", ".json", ".tsx", ".ts", ".css", ".html", ".vue", ".jsx", ".py", ".sh")) { return }

    if (-not $lastSave.ContainsKey($folder)) {
        $lastSave[$folder] = [DateTime]::MinValue
    }
    if (($now - $lastSave[$folder]).TotalSeconds -lt $debounceSeconds) { return }
    $lastSave[$folder] = $now

    $projectName = Split-Path $folder -Leaf
    Write-Host "[$time] [$projectName] $name changed" -ForegroundColor Yellow

    Push-Location $folder
    git add -A 2>$null
    git commit -m "Auto-save: $name ($time)" 2>&1 | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$time] [$projectName] Committed!" -ForegroundColor Green
        git push 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "[$time] [$projectName] Pushed!" -ForegroundColor Cyan
        }
    }
    Pop-Location
}

$currentFolders = Start-Watching
Write-Host "`nWatching for changes..." -ForegroundColor Green

$lastCheck = Get-Date
while ($true) {
    Start-Sleep -Seconds 5

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
'@

$scriptContent | Out-File -FilePath $scriptPath -Encoding UTF8 -Force
Write-Host "  Saved to: $scriptPath" -ForegroundColor Green

# Step 2: Remove existing task
Write-Host "[2/3] Setting up scheduled task..." -ForegroundColor Yellow
schtasks /delete /tn $taskName /f 2>$null | Out-Null

# Step 3: Create scheduled task
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Auto-save all git projects to GitHub" -Force | Out-Null

Write-Host "  Task created: $taskName" -ForegroundColor Green

# Step 4: Start now
Write-Host "[3/3] Starting auto-save..." -ForegroundColor Yellow
Start-ScheduledTask -TaskName $taskName

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Auto-save is now running in background." -ForegroundColor Yellow
Write-Host "All git projects in $baseFolder will be auto-saved." -ForegroundColor Yellow
Write-Host ""
