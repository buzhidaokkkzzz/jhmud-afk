@echo off
chcp 936 >nul
title 江湖行挂机
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto nonode
if not exist config-multi.json goto firstrun

:start
echo ============================================
echo    江湖行 - 挂机
echo    运行中不要关这个窗口；关掉即停止
echo ============================================
echo.
node multi.js

echo.
echo 程序已退出。按任意键关闭窗口...
pause >nul
exit /b 0

:firstrun
echo 还没有配置账号，先运行配置向导...
echo.
node setup.js
if not exist config-multi.json goto nocfg
goto start

:nonode
echo [错误] 没有找到 Node.js，请先安装 https://nodejs.org
pause
exit /b 1

:nocfg
echo [取消] 没有保存配置，已退出。
pause
exit /b 1
