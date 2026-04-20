@echo off
echo ============================================
echo   TruthTrace — AI Evidence Investigator
echo   Team F - AI Detective - April 2026
echo ============================================
echo.
echo Starting backend server on http://localhost:5001
echo.
cd /d "%~dp0backend"
python app.py
