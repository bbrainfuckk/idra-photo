@echo off
rem Double-click to connect Idra Photo to Codex. Options pass through, e.g. --workspace "D:\Idra".
call "%~dp0idra-photo.cmd" install-codex %*
set "IDRA_RC=%ERRORLEVEL%"
echo.
if "%~1"=="" pause
exit /b %IDRA_RC%
