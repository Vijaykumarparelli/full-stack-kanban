@echo off
cd /d "%~dp0\.."
echo Stopping PM app...
docker-compose down
echo Stopped.
