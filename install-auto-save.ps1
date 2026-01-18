# Install Auto Save as Scheduled Task
# Run this script as Administrator

$taskName = "AutoSaveAllProjects"
$scriptPath = "C:\Users\kim\auto-save-all.ps1"

# Remove existing task if exists
schtasks /delete /tn $taskName /f 2>$null

# Create scheduled task - runs at logon, hidden window
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-WindowStyle Hidden -ExecutionPolicy Bypass -File `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 0)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Description "Auto-save trading-automation and blog-gen to GitHub" -Force

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Auto Save Installed!" -ForegroundColor Green
Write-Host "Task Name: $taskName" -ForegroundColor Yellow
Write-Host "Script: $scriptPath" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Starting now..." -ForegroundColor Yellow

# Start the task immediately
Start-ScheduledTask -TaskName $taskName

Write-Host "Done! Auto-save is running in background." -ForegroundColor Green
