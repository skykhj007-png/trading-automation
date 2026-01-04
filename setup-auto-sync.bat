@echo off
chcp 65001 >nul
echo ============================================
echo  Auto Git Sync 설치 (1시간마다 자동 저장)
echo ============================================
echo.

:: 현재 폴더 경로
set "REPO_PATH=%~dp0"
set "SCRIPT_PATH=%REPO_PATH%auto-git-sync.ps1"
set "TASK_NAME=TradingAutoSync"

:: 관리자 권한 확인
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [!] 관리자 권한이 필요합니다.
    echo [!] 이 파일을 우클릭 → "관리자 권한으로 실행" 해주세요.
    pause
    exit /b 1
)

:: 기존 작업 삭제 (있으면)
schtasks /delete /tn "%TASK_NAME%" /f >nul 2>&1

:: 새 작업 등록 (1시간마다)
schtasks /create /tn "%TASK_NAME%" /tr "powershell.exe -ExecutionPolicy Bypass -File \"%SCRIPT_PATH%\"" /sc hourly /mo 1 /f

if %errorLevel% equ 0 (
    echo.
    echo [OK] 설치 완료!
    echo.
    echo  - 작업 이름: %TASK_NAME%
    echo  - 실행 주기: 1시간마다
    echo  - 스크립트: %SCRIPT_PATH%
    echo.
    echo [TIP] 작업 스케줄러에서 확인 가능:
    echo       Win+R → taskschd.msc → TradingAutoSync 검색
    echo.
) else (
    echo.
    echo [ERROR] 설치 실패!
    echo.
)

pause
