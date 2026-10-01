@echo off
where node >nul 2>nul
if errorlevel 1 (
  echo MRZ Studio needs Node.js 22 or newer. Install Node.js LTS and open a new Command Prompt.
  exit /b 1
)
node "%~dp0scripts\mrz.cjs" %*
exit /b %errorlevel%
