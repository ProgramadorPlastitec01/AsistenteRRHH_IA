@echo off
setlocal
cd /d "%~dp0"
title Asistente RRHH IA - Control de Servicios

:menu
cls
echo ===================================================
echo   ASISTENTE RRHH IA - INICIO DE SERVICIOS
echo ===================================================
echo.
echo 1. Iniciar Servidor Backend (Recomendado)
echo 2. Renovar Sesion de IA (npx notebooklm-mcp-server auth)
echo 3. Iniciar Frontend para Desarrollo (Vite)
echo 4. REINICIAR TODOS LOS SERVICIOS (Limpia procesos previos)
echo 5. Salir
echo.
set /p opt="Selecciona una opcion (1-5): "

if "%opt%"=="1" goto start_backend
if "%opt%"=="2" goto auth_ia
if "%opt%"=="3" goto start_frontend
if "%opt%"=="4" goto full_restart
if "%opt%"=="5" goto end
goto menu

:start_backend
cls
echo [INFO] Iniciando Backend en puerto 3000...
echo [INFO] Acceso: http://localhost:3000/AsistenteRRHH
echo.
node server.js
pause
goto menu

:auth_ia
cls
echo [INFO] Iniciando proceso de autenticacion...
echo [INFO] Sigue las instrucciones en la ventana que se abrira.
echo.
call npx notebooklm-mcp-server auth
echo.
echo [OK] Proceso completado. Pulsa una tecla para volver.
pause
goto menu

:start_frontend
cls
echo [INFO] Iniciando servidor de desarrollo Vite...
echo [INFO] Se abrira en una nueva ventana.
echo.
start cmd /k "npm run dev"
echo [OK] Frontend iniciado.
pause
goto menu

:full_restart
cls
echo [INFO] Deteniendo procesos de Node.js existentes...
taskkill /f /im node.exe >nul 2>&1
echo [OK] Procesos limpiados.
echo [INFO] Iniciando Backend...
start cmd /k "node server.js"
echo [INFO] Iniciando Frontend...
start cmd /k "npm run dev"
echo.
echo [OK] Servicios reiniciados en nuevas ventanas.
pause
goto menu

:end
exit
