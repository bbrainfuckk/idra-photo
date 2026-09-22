@echo off
rem Idra Photo launcher for Windows. Finds Node 22.13+ at every start (so Codex or Node updates
rem never break it), then runs idra-photo.mjs. It prints nothing on stdout itself.
setlocal EnableExtensions
set "IDRA_ENTRY=%~dp0idra-photo.mjs"
set "IDRA_NODE="
set "CAND="
if defined IDRA_NODE_EXE set "CAND=%IDRA_NODE_EXE%"
if defined CAND call :try
if defined IDRA_NODE goto run
set "CAND="
for %%N in (node.exe) do set "CAND=%%~$PATH:N"
if defined CAND call :try
if defined IDRA_NODE goto run
for /f "delims=" %%D in ('dir /b /ad /o-d "%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node" 2^>nul') do call :tryruntime "%%D"
if defined IDRA_NODE goto run
set "CAND=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
call :try
if defined IDRA_NODE goto run
>&2 echo Idra Photo needs Node.js 22.13 or newer. Install it from https://nodejs.org and try again.
exit /b 1

:run
"%IDRA_NODE%" "%IDRA_ENTRY%" %*
exit /b %ERRORLEVEL%

:tryruntime
if defined IDRA_NODE exit /b 0
set "CAND=%LOCALAPPDATA%\OpenAI\Codex\runtimes\cua_node\%~1\bin\node.exe"
call :try
exit /b 0

:try
if not exist "%CAND%" exit /b 0
"%CAND%" -e "const[a,b]=process.versions.node.split('.').map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)" <nul >nul 2>nul
if not errorlevel 1 set "IDRA_NODE=%CAND%"
exit /b 0
