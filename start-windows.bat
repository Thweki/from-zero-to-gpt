@echo off
setlocal DisableDelayedExpansion
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS ^(22.18+^): https://nodejs.org/
  if not defined CI if not defined FROM_ZERO_NO_PAUSE pause
  exit /b 1
)
node -e "var v=process.versions.node.split('.').map(Number);if(v[0]<22||(v[0]===22&&v[1]<18)){console.error('Requires Node.js 22.18+; install Node 24 LTS: https://nodejs.org/');process.exit(1);}"
if errorlevel 1 (
  if not defined CI if not defined FROM_ZERO_NO_PAUSE pause
  exit /b 1
)
node "%~dp0scripts\launch.mjs" %*
set "FROM_ZERO_LAUNCH_EXIT=%errorlevel%"
if not "%FROM_ZERO_LAUNCH_EXIT%"=="0" if not defined CI if not defined FROM_ZERO_NO_PAUSE pause
exit /b %FROM_ZERO_LAUNCH_EXIT%
