@echo off
set "SOURCE_DIR=%~dp0dist"
set "DEST_DIR=C:\Program Files\Apache Software Foundation\Apache Tomcat 8.0.27\webapps\AsistenteRRHH"

echo Desplegando Asistente RRHH a Tomcat...
echo Origen: %SOURCE_DIR%
echo Destino: %DEST_DIR%

REM Verificar permisos de administrador
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Permisos de administrador confirmados.
) else (
    echo ERROR: Este script debe ejecutarse como Administrador pare escribir en Program Files.
    pause
    exit /b 1
)

REM Copiar archivos
robocopy "%SOURCE_DIR%" "%DEST_DIR%" /E /IS /IT

if %errorLevel% geq 8 (
    echo Hubo errores durante la copia.
) else (
    echo Despliegue completado exitosamente. Relanza la pagina en el navegador.
)
pause
