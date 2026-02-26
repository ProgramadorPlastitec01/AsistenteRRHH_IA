$ErrorActionPreference = "Stop"

# Directorios
$rootDir = $PSScriptRoot
$distDir = Join-Path $rootDir "dist"
$tempDir = Join-Path $rootDir "asistente-war"
$warFile = Join-Path $rootDir "asistente.war"

# 1. Limpiar entorno anterior
Write-Host "Limpiando archivos temporales..." -ForegroundColor Cyan
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
if (Test-Path $warFile) { Remove-Item $warFile -Force }

# 2. Verificar build
if (-not (Test-Path $distDir)) {
    Write-Error "No se encontró la carpeta 'dist'. Ejecuta 'npm run build' primero."
    exit 1
}

# 3. Crear estructura temporal
Write-Host "Preparando estructura del WAR..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $tempDir | Out-Null
Copy-Item "$distDir\*" -Destination $tempDir -Recurse

# 4. Crear WEB-INF y web.xml mínimo
$webInfDir = Join-Path $tempDir "WEB-INF"
if (-not (Test-Path $webInfDir)) { New-Item -ItemType Directory -Path $webInfDir | Out-Null }

$webXmlContent = @"
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         version="3.1">
    <welcome-file-list>
        <welcome-file>index.html</welcome-file>
    </welcome-file-list>
</web-app>
"@
Set-Content -Path (Join-Path $webInfDir "web.xml") -Value $webXmlContent
Write-Host "web.xml creado con configuración mínima."

# 5. Generar WAR (ZIP)
Write-Host "Comprimiendo archivo WAR..." -ForegroundColor Cyan
$zipFile = Join-Path $rootDir "asistente.zip"
if (Test-Path $zipFile) { Remove-Item $zipFile -Force }

Compress-Archive -Path "$tempDir\*" -DestinationPath $zipFile -Force

# Renombrar a .war
Rename-Item -Path $zipFile -NewName "asistente.war"

Write-Host "✅ EXITO: Archivo generado en: $warFile" -ForegroundColor Green
Write-Host "Listoc para desplegar en Tomcat 9."
