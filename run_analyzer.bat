@echo off
cd /d "C:\Users\0319a\OneDrive - 한국교원대학교\바탕 화면\이독성 분석 프로그램"

REM Start Flask server in a new window and keep it open (/k)
start "Flask Server" cmd /k "set FLASK_APP=app.py && flask run"

REM Give the server a moment to start up (optional, but good practice)
timeout /t 3 >nul

REM Open the web browser
start http://127.0.0.1:5000

REM The original batch file can now exit or pause if needed.
REM Removing 'pause' here as the server will be in its own window.
exit