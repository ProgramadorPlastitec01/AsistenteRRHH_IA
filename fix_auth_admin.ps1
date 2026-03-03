
$ErrorActionPreference = "Stop"

# Ruta del usuario actual (donde se generó el arquivo funciona)
$UserAuthPath = "$env:USERPROFILE\.notebooklm-mcp\auth.json"

if (-not (Test-Path $UserAuthPath)) {
    Write-Host "❌ ERROR: No encuentro el archivo de credenciales en tu usuario." -ForegroundColor Red
    Write-Host "   Ejecuta primero 'node manual_auth.cjs' y completa los pasos."
    exit
}

# Rutas de Sistema (donde lo busca el servicio)
$SystemPaths = @(
    "C:\Windows\System32\config\systemprofile\.notebooklm-mcp",
    "C:\Windows\SysWOW64\config\systemprofile\.notebooklm-mcp"
)

Write-Host "=== COPIANDO CREDENCIALES AL SISTEMA ===" -ForegroundColor Cyan

foreach ($Path in $SystemPaths) {
    try {
        if (-not (Test-Path $Path)) {
            New-Item -ItemType Directory -Force -Path $Path | Out-Null
        }
        Copy-Item -Path $UserAuthPath -Destination "$Path\auth.json" -Force
        Write-Host "✅ Copiado a: $Path" -ForegroundColor Green
    } catch {
        Write-Host "❌ ERROR copiando a $Path" -ForegroundColor Red
        Write-Host "   $_"
        Write-Host "⚠️  IMPORTANTE: ESTE SCRIPT DEBE CORRERSE COMO ADMINISTRADOR." -ForegroundColor Yellow
    }
}

Write-Host "`n=== REINICIANDO SERVICIO ===" -ForegroundColor Cyan
try {
    Restart-Service -Name "asistenterrhhiabackend.exe" -Force
    Write-Host "✅ Servicio reiniciado correctamente." -ForegroundColor Green
} catch {
    Write-Host "❌ No se pudo reiniciar el servicio. Inténtalo manualmente desde 'Servicios'." -ForegroundColor Red
}

Write-Host "`n✅ PROCESO FINALIZADO. PRUEBA AHORA EL ASISTENTE." -ForegroundColor Green
Pause
