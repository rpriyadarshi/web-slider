@echo off
setlocal
cd /d "%~dp0"

if not exist "runtime\server-windows-amd64.exe" (
  echo The presenter program is missing. Unpack the whole folder, then start again.
  pause
  exit /b 1
)

runtime\server-windows-amd64.exe --root app --open
if errorlevel 1 (
  echo The presenter stopped with an error.
  pause
  exit /b 1
)
