@echo off
setlocal
cd /d "%~dp0"
set "PYTHONUTF8=1"
set "BUNDLED=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"

if exist "%BUNDLED%" goto bundled
where py >nul 2>nul
if not errorlevel 1 goto py
where python >nul 2>nul
if not errorlevel 1 goto python

echo.
echo Python 3.9 or newer is required to start the local LINGUA proxy.
echo Install Python, or use the Python runtime bundled with this workspace.
echo.
pause
exit /b 1

:bundled
"%BUNDLED%" "%~dp0server.py"
set "ERR=%ERRORLEVEL%"
goto finish

:py
py -3 "%~dp0server.py"
set "ERR=%ERRORLEVEL%"
goto finish

:python
python "%~dp0server.py"
set "ERR=%ERRORLEVEL%"
goto finish

:finish
if not "%ERR%"=="0" (
  echo.
  echo LINGUA exited with code %ERR%.
  echo Check whether port 8787 is already in use.
  pause
)
endlocal
