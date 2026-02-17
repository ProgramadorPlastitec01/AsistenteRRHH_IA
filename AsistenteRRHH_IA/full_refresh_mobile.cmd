@echo off
cd /d "%~dp0"
echo ===================================================
echo   REPARACION COMPLETA DEL SISTEMA Y RECARGA
echo ===================================================
echo Directorio de trabajo: %CD%

echo.
echo 1. REPARANDO AUTENTICACION (Sigue las instrucciones)...
call node manual_auth.cjs
if %errorLevel% neq 0 (
    echo Error en autenticacion. Abortando.
    pause
    exit /b
)

echo.
echo 2. REINICIANDO SERVICIOS...

echo ... Backend Node.js
net stop "asistenterrhhiabackend.exe" >nul 2>&1
net start "asistenterrhhiabackend.exe" >nul 2>&1
echo    Backend Reiniciado.

echo ... Apache Tomcat
taskkill /F /IM java.exe /FI "WINDOWTITLE eq Tomcat" >nul 2>&1
start "Tomcat Server" cmd /c "start_tomcat.cmd"
echo    Tomcat Reiniciado (Nueva ventana abierta).

echo.
echo 3. INICIANDO NGROK (ACCESO MOVIL HTTPS)...
echo.
echo    [IMPORTANTE]:
echo    - Se abrira una ventana de ngrok.
echo    - Copia la URL que dice "Forwarding" (ej: https://xxxx.ngrok-free.app).
echo    - En tu movil, usa esa URL + /AsistenteRRHH/
echo      Ejemplo: https://xxxx.ngrok-free.app/AsistenteRRHH/
echo.
echo Presiona una tecla para lanzar ngrok...
pause >nul

ngrok http 3000
