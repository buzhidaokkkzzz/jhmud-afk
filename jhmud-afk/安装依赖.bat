@echo off
chcp 936 >nul
title 江湖行挂机 - 安装依赖
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode

set PLAYWRIGHT_DOWNLOAD_HOST=https://cdn.npmmirror.com/binaries/playwright

echo ============================================
echo    安装运行环境（需要联网，首次约 150 MB）
echo ============================================
echo.
echo [1/2] 安装 npm 依赖...
call npm i --no-audit --no-fund
echo.
echo [2/2] 下载浏览器内核...
call npx playwright install chromium
echo.
echo 完成。现在双击「启动挂机.bat」即可。
echo 按任意键关闭...
pause >nul
exit /b 0

:nonode
echo [错误] 没有找到 Node.js
echo 请先安装 LTS 版本：https://nodejs.org
pause
exit /b 1
