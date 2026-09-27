@echo off
setlocal
title Gemini-use installer

echo Gemini-use installer
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1" %*
set "install_status=%ERRORLEVEL%"
if defined CI exit /b %install_status%
if not "%install_status%"=="0" goto failed

echo.
echo One-time Chrome/Chromium setup (same profile where you use Gemini):
echo 1. Open chrome://extensions and enable Developer mode.
echo 2. Click Load unpacked and choose each folder below:
echo    %USERPROFILE%\.gemini-use\vendor\MCP-SuperAssistant\dist
echo    %USERPROFILE%\.gemini-use\vendor\mcp-chrome\app\chrome-extension\.output\chrome-mv3
echo 3. Open Gemini, start a chat, hover MCP, and click Insert once. Follow-up requests work without reinserting.
echo.
echo See README.md for screenshots, prerequisites, and troubleshooting.
pause
exit /b 0

:failed
echo.
echo Installation failed with exit code %install_status%. Fix the message above, then double-click this file again.
pause
exit /b %install_status%
