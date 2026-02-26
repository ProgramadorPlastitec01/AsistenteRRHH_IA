$ErrorActionPreference = "Stop"
$distPath = Join-Path $PSScriptRoot "dist"
$warFile = Join-Path $PSScriptRoot "AsistenteRRHH.war"

Write-Host "Generando archivo WAR para Tomcat..." -ForegroundColor Cyan

# Verificar si existe la carpeta dist
if (-not (Test-Path $distPath)) {
    Write-Error "La carpeta 'dist' no existe. Ejecuta 'npm run build' primero."
    exit 1
}

# Borrar WAR anterior si existe
if (Test-Path $warFile) {
    Remove-Item $warFile -Force
    Write-Host "Archivo anterior eliminado."
}

# Comprimir contenido de dist en un archivo .war (formato ZIP)
Compress-Archive -Path "$distPath\*" -DestinationPath $warFile -Force

Write-Host "✅ Archivo WAR generado exitosamente:" -ForegroundColor Green
Write-Host "   $warFile"
Write-Host "`nPuedes subir este archivo a través del Tomcat Manager o copiarlo a la carpeta webapps."
