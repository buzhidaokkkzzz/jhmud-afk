@echo off
chcp 936 >nul
title 江湖行 - 配置账号
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

node setup.js

echo.
pause
exit /b 0

:nonode
echo [错误] 没有找到 Node.js，请先安装 https://nodejs.org
pause
exit /b 1
