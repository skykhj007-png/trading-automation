@echo off
chcp 65001 >nul
echo ============================================
echo  Auto Git Sync 제거
echo ============================================
echo.

set "TASK_NAME=TradingAutoSync"

:: 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] 관리자 권한이 필요합니다.
    pause
    exit /b 1
)

schtasks /delete /tn "%TASK_NAME%" /f

if %errorLevel% equ 0 (
    echo.
    echo [OK] 자동 동기화 제거 완료!
) else (
    echo.
    echo [!] 작업이 없거나 이미 제거됨
)

pause
