@echo off
title Renovación Manual de Sesión - NotebookLM
echo ================================================
echo   RENOVACIÓN MANUAL DE SESIÓN DE NOTEBOOKLM
echo ================================================
echo.
echo Este script te ayudará a renovar la sesión manualmente usando cookies.
echo.
cd /d "%~dp0"
node manual_auth.cjs
echo.
pause
