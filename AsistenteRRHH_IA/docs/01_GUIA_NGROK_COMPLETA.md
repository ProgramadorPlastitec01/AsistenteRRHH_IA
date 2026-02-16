# 🚀 GUÍA COMPLETA: ngrok para Pruebas Móviles con HTTPS

**Fecha:** 2026-02-12  
**Propósito:** Exponer servidor local con HTTPS para probar reconocimiento de voz en móviles  
**Puerto de la aplicación:** 5173 (Vite Dev Server)

---

## 📋 TABLA DE CONTENIDOS

1. [Instalación de ngrok](#instalación)
2. [Configuración del Authtoken](#configuración)
3. [Iniciar el Túnel HTTPS](#túnel)
4. [Probar en Dispositivos Móviles](#pruebas)
5. [Troubleshooting](#troubleshooting)
6. [Checklist Final](#checklist)

---

## 🔧 INSTALACIÓN DE NGROK

### OPCIÓN 1: Descarga Directa (Windows) - RECOMENDADO

#### Paso 1: Descargar ngrok
```powershell
# Opción A: Descargar manualmente
# 1. Visita: https://ngrok.com/download
# 2. Descarga la versión para Windows (64-bit)
# 3. Extrae el archivo ZIP

# Opción B: Descargar con PowerShell
Invoke-WebRequest -Uri "https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-windows-amd64.zip" -OutFile "$env:USERPROFILE\Downloads\ngrok.zip"
```

#### Paso 2: Extraer y Mover ngrok
```powershell
# Extraer el ZIP
Expand-Archive -Path "$env:USERPROFILE\Downloads\ngrok.zip" -DestinationPath "$env:USERPROFILE\Downloads\ngrok" -Force

# Crear directorio para ngrok (si no existe)
New-Item -ItemType Directory -Path "C:\ngrok" -Force

# Mover ngrok.exe
Move-Item -Path "$env:USERPROFILE\Downloads\ngrok\ngrok.exe" -Destination "C:\ngrok\ngrok.exe" -Force
```

#### Paso 3: Agregar ngrok al PATH
```powershell
# Agregar C:\ngrok al PATH del sistema
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*C:\ngrok*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;C:\ngrok", "User")
    Write-Host "✅ ngrok agregado al PATH" -ForegroundColor Green
} else {
    Write-Host "✅ ngrok ya está en el PATH" -ForegroundColor Yellow
}

# Refrescar PATH en la sesión actual
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","User")
```

#### Paso 4: Verificar Instalación
```powershell
# Cerrar y reabrir PowerShell, luego:
ngrok version

# Deberías ver algo como:
# ngrok version 3.x.x
```

---

### OPCIÓN 2: Chocolatey (Windows)

```powershell
# Si tienes Chocolatey instalado:
choco install ngrok -y

# Verificar:
ngrok version
```

---

### OPCIÓN 3: macOS

```bash
# Con Homebrew:
brew install ngrok/ngrok/ngrok

# Verificar:
ngrok version
```

---

### OPCIÓN 4: Linux

```bash
# Descargar:
curl -s https://ngrok-agent.s3.amazonaws.com/ngrok.asc | sudo tee /etc/apt/trusted.gpg.d/ngrok.asc >/dev/null
echo "deb https://ngrok-agent.s3.amazonaws.com buster main" | sudo tee /etc/apt/sources.list.d/ngrok.list

# Instalar:
sudo apt update
sudo apt install ngrok

# Verificar:
ngrok version
```

---

## 🔑 CONFIGURACIÓN DEL AUTHTOKEN

### Paso 1: Tu Authtoken
```
39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW
```

### Paso 2: Configurar el Authtoken

```powershell
# Ejecuta este comando EXACTAMENTE como está:
ngrok config add-authtoken 39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW
```

**Salida esperada:**
```
Authtoken saved to configuration file: C:\Users\[TU_USUARIO]\.ngrok2\ngrok.yml
```

### Paso 3: Verificar Configuración

```powershell
# Ver la configuración:
ngrok config check

# O ver el archivo directamente:
Get-Content "$env:USERPROFILE\.ngrok2\ngrok.yml"
```

**Deberías ver:**
```yaml
version: "2"
authtoken: 39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW
```

---

## 🌐 INICIAR EL TÚNEL HTTPS

### Comando Principal

```powershell
# Asegúrate de que tu servidor local esté corriendo primero
# npm run dev debe estar activo en el puerto 5173

# Luego, en una NUEVA terminal:
ngrok http 5173
```

### Salida Esperada

```
ngrok                                                                   

Session Status                online
Account                       [Tu cuenta]
Version                       3.x.x
Region                        United States (us)
Latency                       -
Web Interface                 http://127.0.0.1:4040
Forwarding                    https://abc123.ngrok-free.app -> http://localhost:5173

Connections                   ttl     opn     rt1     rt5     p50     p90
                              0       0       0.00    0.00    0.00    0.00
```

### 🎯 URL HTTPS Generada

La línea más importante es:
```
Forwarding    https://abc123.ngrok-free.app -> http://localhost:5173
```

**Esta es tu URL HTTPS pública** que usarás en tu móvil.

---

## 📱 PROBAR EN DISPOSITIVOS MÓVILES

### Paso 1: Obtener la URL HTTPS

De la salida de ngrok, copia la URL que empieza con `https://`:
```
https://abc123.ngrok-free.app
```

### Paso 2: Abrir en Móvil

#### Android (Chrome):
1. Abre Chrome en tu Android
2. Escribe o escanea la URL: `https://abc123.ngrok-free.app`
3. **IMPORTANTE:** Aparecerá una pantalla de ngrok
4. Haz clic en "Visit Site" o "Visitar sitio"
5. Tu aplicación debería cargar

#### iOS (Safari):
1. Abre Safari en tu iPhone/iPad
2. Escribe o escanea la URL: `https://abc123.ngrok-free.app`
3. **IMPORTANTE:** Aparecerá una pantalla de ngrok
4. Toca "Visit Site" o "Visitar sitio"
5. Tu aplicación debería cargar

### Paso 3: Verificar HTTPS

1. Busca el **candado 🔒** en la barra de direcciones
2. Debe estar cerrado (verde o gris)
3. La URL debe empezar con `https://`

**Si ves el candado, ¡HTTPS está funcionando!**

---

## 🎤 VERIFICAR RECONOCIMIENTO DE VOZ

### Paso 1: Probar Permisos de Micrófono

1. En tu móvil, abre la aplicación
2. Toca el botón de micrófono 🎙️
3. **Debe aparecer el diálogo de permisos del navegador**
4. Acepta el permiso

### Paso 2: Probar Reconocimiento

1. Di claramente: **"Vacaciones"**
2. Espera 1-2 segundos en silencio

**✅ Resultado Esperado:**
- El texto "Vacaciones" aparece en pantalla
- El sistema procesa la consulta
- Muestra una respuesta
- Lee la respuesta en voz alta

### Paso 3: Verificar Logs (Opcional)

Si tienes debugging remoto configurado:

**Android:**
1. Conecta el móvil al PC con USB
2. Abre Chrome en PC: `chrome://inspect`
3. Selecciona tu dispositivo
4. Busca los logs con emojis:
```
🎤 INICIANDO RECONOCIMIENTO DE VOZ
   - Dispositivo: MÓVIL
✅ Permiso de micrófono concedido
📝 EVENTO onresult DISPARADO
✅ RESULTADO FINAL DETECTADO
🚀 Enviando al backend: Vacaciones
```

---

## 🔍 INTERFAZ WEB DE NGROK

ngrok incluye una interfaz web para monitorear las conexiones:

```
http://127.0.0.1:4040
```

Abre esta URL en tu navegador de escritorio para ver:
- Todas las peticiones HTTP
- Respuestas del servidor
- Tiempos de respuesta
- Errores

**Muy útil para debugging!**

---

## 🛠️ TROUBLESHOOTING

### Problema 1: "ngrok: command not found"

**Causa:** ngrok no está en el PATH

**Solución:**
```powershell
# Opción A: Ejecutar desde la ubicación directa
C:\ngrok\ngrok.exe http 5173

# Opción B: Agregar al PATH (ver sección de instalación)
```

---

### Problema 2: "ERROR: authentication failed"

**Causa:** Authtoken no configurado o incorrecto

**Solución:**
```powershell
# Reconfigurar authtoken:
ngrok config add-authtoken 39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW

# Verificar:
ngrok config check
```

---

### Problema 3: "ERR_NGROK_108: Tunnel not found"

**Causa:** El túnel se desconectó

**Solución:**
```powershell
# Detener ngrok (Ctrl+C)
# Reiniciar:
ngrok http 5173

# Obtendrás una NUEVA URL (la anterior ya no funciona)
```

---

### Problema 4: "Failed to complete tunnel connection"

**Causa:** Puerto incorrecto o servidor no está corriendo

**Solución:**
```powershell
# 1. Verifica que tu servidor esté corriendo:
# Debe estar activo: npm run dev

# 2. Verifica el puerto correcto:
# En tu caso es 5173

# 3. Reinicia ngrok:
ngrok http 5173
```

---

### Problema 5: "Pantalla de ngrok en móvil"

**Causa:** Es normal, ngrok muestra una página intermedia

**Solución:**
1. Haz clic en "Visit Site"
2. Si aparece de nuevo, haz clic otra vez
3. Tu aplicación debería cargar

**Nota:** Con cuenta gratuita, esta pantalla siempre aparece.

---

### Problema 6: "El micrófono no funciona en móvil"

**Causa:** Posibles razones

**Diagnóstico:**
```
1. ✅ ¿Ves el candado 🔒 en la URL?
   ❌ No → Verifica que la URL sea https://
   
2. ✅ ¿Aparece el diálogo de permisos?
   ❌ No → Revisa permisos del navegador
   
3. ✅ ¿El botón cambia a rojo?
   ❌ No → Verifica que el servidor esté corriendo
   
4. ✅ ¿Aparece "Escuchando..."?
   ❌ No → Revisa logs en consola
```

**Solución:**
```powershell
# 1. Verifica HTTPS:
# La URL DEBE empezar con https://

# 2. Recarga la página en el móvil

# 3. Limpia caché del navegador móvil

# 4. Reinicia ngrok y obtén nueva URL
```

---

## 🔒 BUENAS PRÁCTICAS DE SEGURIDAD

### 1. No Expongas Datos Sensibles

```powershell
# ❌ NUNCA hagas esto si tienes datos sensibles:
ngrok http 5173

# ✅ Usa autenticación básica si es necesario:
ngrok http 5173 --basic-auth="usuario:contraseña"
```

### 2. Cierra el Túnel Cuando No lo Uses

```powershell
# Para detener ngrok:
# Presiona Ctrl+C en la terminal donde está corriendo

# Verifica que se detuvo:
# La URL ya no debería funcionar
```

### 3. No Compartas la URL Públicamente

- ❌ No la publiques en redes sociales
- ❌ No la compartas en foros públicos
- ✅ Solo compártela con personas de confianza
- ✅ Usa solo para pruebas

### 4. Monitorea las Conexiones

```
# Abre la interfaz web:
http://127.0.0.1:4040

# Revisa quién está accediendo
```

---

## 🔄 MANTENER SESIÓN ACTIVA

### Problema: ngrok se desconecta

**Causa:** Cuenta gratuita tiene límites de tiempo

**Solución:**
```powershell
# Opción 1: Reiniciar manualmente cuando se desconecte
ngrok http 5173

# Opción 2: Usar un script de auto-reinicio (avanzado)
# Crear archivo: restart-ngrok.ps1
while ($true) {
    ngrok http 5173
    Start-Sleep -Seconds 5
}

# Ejecutar:
.\restart-ngrok.ps1
```

### Límites de Cuenta Gratuita

- ⏰ Sesión: ~2 horas
- 🔗 Túneles simultáneos: 1
- 📊 Conexiones/minuto: 40
- 🌐 URL: Cambia cada vez que reinicias

---

## 📊 COMANDOS ÚTILES

### Comandos Básicos

```powershell
# Iniciar túnel HTTP → HTTPS
ngrok http 5173

# Iniciar con región específica
ngrok http 5173 --region=us

# Iniciar con subdominio personalizado (requiere cuenta paga)
ngrok http 5173 --subdomain=mi-app

# Ver ayuda
ngrok help

# Ver versión
ngrok version

# Ver configuración
ngrok config check
```

### Comandos Avanzados

```powershell
# Túnel con autenticación básica
ngrok http 5173 --basic-auth="usuario:contraseña"

# Túnel con inspección deshabilitada
ngrok http 5173 --inspect=false

# Túnel con host header personalizado
ngrok http 5173 --host-header="localhost:5173"

# Ver logs detallados
ngrok http 5173 --log=stdout --log-level=debug
```

---

## ✅ CHECKLIST FINAL

### Instalación y Configuración
- [ ] ngrok instalado (`ngrok version` funciona)
- [ ] Authtoken configurado (`ngrok config check`)
- [ ] PATH configurado correctamente

### Servidor Local
- [ ] `npm run dev` corriendo en puerto 5173
- [ ] `node server.js` corriendo en puerto 3000
- [ ] Aplicación funciona en http://localhost:5173

### Túnel ngrok
- [ ] ngrok iniciado (`ngrok http 5173`)
- [ ] URL HTTPS obtenida (https://xxx.ngrok-free.app)
- [ ] Interfaz web accesible (http://127.0.0.1:4040)

### Pruebas en Móvil
- [ ] URL HTTPS abierta en móvil
- [ ] Pantalla de ngrok pasada ("Visit Site")
- [ ] Aplicación carga correctamente
- [ ] Candado 🔒 visible en la URL

### Reconocimiento de Voz
- [ ] Botón de micrófono visible
- [ ] Diálogo de permisos aparece
- [ ] Permiso de micrófono aceptado
- [ ] Botón cambia a rojo al activar
- [ ] Aparece "Escuchando..."
- [ ] Texto se captura correctamente
- [ ] Consulta se procesa
- [ ] Respuesta se muestra
- [ ] Respuesta se lee en voz alta

### Validación Final
- [ ] Múltiples consultas funcionan
- [ ] Timeout de 10s funciona
- [ ] Errores se manejan correctamente
- [ ] UI es responsive en móvil

---

## 🎯 FLUJO COMPLETO DE TRABAJO

### 1. Preparación (Una sola vez)
```powershell
# Terminal 1: Instalar ngrok
# (Seguir pasos de instalación)

# Configurar authtoken
ngrok config add-authtoken 39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW
```

### 2. Cada Sesión de Pruebas
```powershell
# Terminal 1: Servidor Frontend
cd c:\Users\Programador.ti1\Documents\NootebookLMTutorial
npm run dev

# Terminal 2: Servidor Backend
cd c:\Users\Programador.ti1\Documents\NootebookLMTutorial
node server.js

# Terminal 3: ngrok
ngrok http 5173
```

### 3. Probar en Móvil
```
1. Copiar URL HTTPS de ngrok
2. Abrir en navegador móvil
3. Hacer clic en "Visit Site"
4. Probar reconocimiento de voz
5. Verificar que funciona
```

### 4. Finalizar
```powershell
# Detener ngrok: Ctrl+C en Terminal 3
# Detener backend: Ctrl+C en Terminal 2
# Detener frontend: Ctrl+C en Terminal 1
```

---

## 📞 SOPORTE Y RECURSOS

### Documentación Oficial
- ngrok Docs: https://ngrok.com/docs
- ngrok Dashboard: https://dashboard.ngrok.com

### Recursos del Proyecto
- **GUIA_PRUEBAS_MOVIL.md** - Protocolo de pruebas móviles
- **OPTIMIZACION_MOVIL_COMPLETA.md** - Detalles técnicos
- **GUIA_TESTING_MANUAL.md** - Testing manual

### Comandos de Diagnóstico
```powershell
# Verificar instalación
ngrok version

# Verificar configuración
ngrok config check

# Ver archivo de configuración
Get-Content "$env:USERPROFILE\.ngrok2\ngrok.yml"

# Probar conexión
ngrok http 5173 --log=stdout
```

---

## 🚀 QUICK START (Resumen)

```powershell
# 1. Instalar ngrok (descargar de https://ngrok.com/download)
# 2. Extraer y mover a C:\ngrok
# 3. Agregar al PATH

# 4. Configurar authtoken
ngrok config add-authtoken 39aYVSMeg79neGE5jbDeApl8PM7_4nekoZr3Uzu5WircDNRVW

# 5. Iniciar servidores
npm run dev          # Terminal 1
node server.js       # Terminal 2

# 6. Iniciar ngrok
ngrok http 5173      # Terminal 3

# 7. Copiar URL HTTPS y abrir en móvil
# Ejemplo: https://abc123.ngrok-free.app

# 8. Probar reconocimiento de voz
# ✅ Debe funcionar perfectamente
```

---

**Guía creada:** 2026-02-12  
**Autor:** Antigravity (DevOps Senior)  
**Propósito:** Facilitar pruebas de reconocimiento de voz en móviles  
**Estado:** ✅ Lista para usar

**¡Buena suerte con las pruebas! 🎉**
