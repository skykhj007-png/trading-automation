# 4시간 분석 스케줄러 설치 (Node.js)
$taskName = "Send4HAnalysis"
$scriptPath = "C:\Users\kim\send-4h-analysis.js"

Write-Host "Installing 4H Analysis Scheduler (Node.js)..." -ForegroundColor Cyan

# 기존 작업 삭제
Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

# 4시간마다 실행 (0시, 4시, 8시, 12시, 16시, 20시)
$action = New-ScheduledTaskAction -Execute "node" -Argument "`"$scriptPath`""

$triggers = @(
    New-ScheduledTaskTrigger -Daily -At "00:00"
    New-ScheduledTaskTrigger -Daily -At "04:00"
    New-ScheduledTaskTrigger -Daily -At "08:00"
    New-ScheduledTaskTrigger -Daily -At "12:00"
    New-ScheduledTaskTrigger -Daily -At "16:00"
    New-ScheduledTaskTrigger -Daily -At "20:00"
)

$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $triggers -Settings $settings -Description "4H BTC analysis to @V38_Signal" -Force | Out-Null

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "4H Analysis Scheduler Installed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Task: $taskName" -ForegroundColor Yellow
Write-Host "Schedule: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00" -ForegroundColor Yellow
Write-Host "Target: @V38_Signal" -ForegroundColor Yellow
Write-Host ""

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName, State | Format-Table -AutoSize
