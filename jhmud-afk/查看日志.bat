@echo off
chcp 936 >nul
title 江湖行挂机 - 日志
cd /d "%~dp0"
powershell -NoProfile -Command "Get-Content -Path 'afk.log' -Encoding UTF8 -Tail 30 -Wait"
