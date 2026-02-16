@echo off
echo ================================================
echo       REINICIO TOTAL DEL SISTEMA KIOSCO
echo ================================================

echo.
echo [1/4] Deteniendo servidores antiguos (Node.js)...
taskkill /F /IM node.exe >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo    - Procesos Node.js detenidos.
) else (
    echo    - No habia procesos Node.js activos.
)

echo.
echo [2/4] Deteniendo Ngrok...
taskkill /F /IM ngrok.exe >nul 2>&1

echo.
echo [3/4] Verificando autenticacion de NotebookLM...
echo    - Se abrira un navegador si necesitas loguearte.
call npx notebooklm-mcp-server auth

echo.
echo [4/4] Iniciando servicios en nuevas ventanas...

:: Iniciar Backend (Puerto 3000)
start "1. Backend API (Server)" cmd /k "npm run server"

:: Esperar 5 segundos para que el backend arranque
timeout /t 5 /nobreak >nul

:: Iniciar Frontend (Puerto 5173)
start "2. Frontend React (Client)" cmd /k "npm run dev"

:: Iniciar Ngrok (Puerto 5173 -> Publico)
start "3. Ngrok Tunnel" cmd /k "ngrok http 5173"

echo.
echo ================================================
echo    SISTEMA REINICIADO EXITOSAMENTE
echo ================================================
echo.
echo Por favor, espera unos segundos y recarga tu navegador en:
echo    http://localhost:5173
echo.
pause
