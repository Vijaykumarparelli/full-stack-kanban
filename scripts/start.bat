@echo off
cd /d "%~dp0\.."
echo Building and starting PM app...
docker-compose up --build -d
echo App running at http://localhost:8000
