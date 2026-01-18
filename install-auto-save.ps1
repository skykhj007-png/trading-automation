# Install Auto Save as Scheduled Task
# Run this script as Administrator

$taskName = "AutoSaveAllProjects"
$scriptPath = "C:\Users\k\trading-automation\auto-save-all.ps1"

# Remove existing task if exists
schtasks /delete /tn $taskName /f 2>$null

# Create scheduled task - runs at logon, hidden window
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Auto-save all git projects to GitHub" -Force

Write-Host "`n[Auto Save] " -NoNewline -ForegroundColor Cyan
Write-Host "Installed successfully!" -ForegroundColor Green
Write-Host "  Task: $taskName" -ForegroundColor DarkGray
Write-Host "  Script: $scriptPath" -ForegroundColor DarkGray
Write-Host "`n[Auto Save] " -NoNewline -ForegroundColor Cyan
Write-Host "Starting background monitoring...`n" -ForegroundColor Yellow

# Start the task immediately
Start-ScheduledTask -TaskName $taskName

Write-Host "[Auto Save] " -NoNewline -ForegroundColor Cyan
Write-Host "Running in background ✓`n" -ForegroundColor Green
