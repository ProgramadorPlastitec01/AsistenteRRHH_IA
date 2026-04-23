@echo off
cd /d "%~dp0"
echo ===================================================
echo   Generador de WAR para Produccion (Tomcat 9)
echo ===================================================
echo.

echo 1. Validando configuracion Vite...
findstr "base" vite.config.js >nul
if %errorLevel% neq 0 (
    echo [ADVERTENCIA] Verifica que 'base' este configurado en vite.config.js
) else (
    echo [OK] Configuracion base encontrada.
)

echo.
echo 2. Generando Build de Produccion...
call npm run build

if %errorLevel% neq 0 (
    echo [ERROR] Fallo al compilar el proyecto.
    pause
    exit /b
)

echo.
echo 3. Empaquetando WAR...
powershell -ExecutionPolicy Bypass -File "%~dp0package_war.ps1"

if %errorLevel% neq 0 (
    echo [ERROR] Fallo al generar el WAR.
    pause
    exit /b
)

echo.
echo ===================================================
echo   PROCESO COMPLETADO EXITOSAMENTE
echo ===================================================
echo Archivo listo: asistente.war
echo.
pause
