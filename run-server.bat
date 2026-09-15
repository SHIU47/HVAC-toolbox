@echo off
cd /d "%~dp0"
echo Starting HVAC Pro Local Server...
node local-server.js
echo.
echo Server stopped.
pause
