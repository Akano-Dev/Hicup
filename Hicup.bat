@echo off
title Hicup
rem ---------------------------------------------------------------------------
rem  Hicup - your private vertical video player.
rem
rem  Double-click this file to start watching. The server runs in the
rem  background and keeps running after you close this window or VS Code.
rem
rem    Hicup.bat            start and open in your browser (default)
rem    Hicup.bat stop       stop the background server
rem    Hicup.bat restart    stop, then start again
rem    Hicup.bat status     check whether it is running
rem    Hicup.bat rebuild    rebuild from source, then restart
rem    Hicup.bat autostart  launch Hicup whenever Windows starts
rem    Hicup.bat autostop   undo autostart
rem ---------------------------------------------------------------------------
cd /d "%~dp0"

set "ACTION=%~1"
if "%ACTION%"=="" set "ACTION=start"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\hicup.ps1" -Action %ACTION%
set "CODE=%ERRORLEVEL%"

if not "%CODE%"=="0" pause
exit /b %CODE%
