@echo off
echo ========================================
echo V39 Trading Bot - 자동 백업
echo ========================================

cd /d C:\Users\skykh\trading-automation

:: 현재 시간
for /f "tokens=1-4 delims=/ " %%a in ('date /t') do set DATE=%%a-%%b-%%c
for /f "tokens=1-2 delims=: " %%a in ('time /t') do set TIME=%%a%%b

:: Git 상태 확인 및 커밋
git add -A
git commit -m "자동 백업: %DATE% %TIME%"

echo.
echo 백업 완료!
echo.
pause
