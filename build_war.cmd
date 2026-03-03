@echo off
cd /d "%~dp0"
echo ===================================================
echo   2.0 Generador de Archivo WAR (Compatible)
echo ===================================================
echo Directorio de Trabajo: %CD%

echo 1. Compilando el proyecto (npm run build)...
rem Forzamos la base URL correcta para que los assets carguen desde /AsistenteRRHH/
call npm run build

if %errorLevel% neq 0 (
    echo Error en la compilacion. Abortando.
    pause
    exit /b
)

echo.
echo 2. Generando el archivo WAR...

rem Borrar versiones anteriores
if exist asistente-rrhh.zip del asistente-rrhh.zip
if exist asistente-rrhh.war del asistente-rrhh.war

rem Comprimir como .zip primero (PowerShell solo admite .zip de forma nativa)
powershell -ExecutionPolicy Bypass -Command "& { Compress-Archive -Path 'dist\*' -DestinationPath 'asistente-rrhh.zip' -Force }"

if not exist asistente-rrhh.zip (
    echo Error generando el ZIP.
    pause
    exit /b
)

rem Renombrar .zip a .war
ren asistente-rrhh.zip asistente-rrhh.war

echo.
echo ✅ EXITO: Archivo generado en: %CD%\asistente-rrhh.war
echo.
pause
