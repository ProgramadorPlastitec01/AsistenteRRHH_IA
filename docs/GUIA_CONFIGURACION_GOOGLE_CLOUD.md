# 📋 GUÍA PASO A PASO: CONFIGURAR GOOGLE CLOUD TTS

**Fecha:** 12/02/2026  
**Tiempo estimado:** 10-15 minutos  
**Nivel:** Principiante

---

## ✅ ESTADO ACTUAL

- ✅ Código backend actualizado
- ✅ Código frontend actualizado
- ✅ Dependencias instaladas
- ✅ `.env.example` actualizado
- ✅ `.gitignore` actualizado
- ⏳ **PENDIENTE:** Configurar credenciales de Google Cloud

---

## 🎯 OBJETIVO

Configurar Google Cloud Text-to-Speech para que el kiosco de RRHH use voz neural premium tipo Google Assistant.

---

## 📋 PASO 1: CREAR PROYECTO EN GOOGLE CLOUD

### 1.1 Ir a Google Cloud Console

🔗 **URL:** https://console.cloud.google.com/

### 1.2 Crear nuevo proyecto

1. Click en el selector de proyectos (arriba a la izquierda)
2. Click en "Nuevo proyecto"
3. **Nombre del proyecto:** `rrhh-kiosk-tts`
4. **Organización:** (dejar por defecto)
5. Click en "Crear"
6. Esperar 10-20 segundos

### 1.3 Seleccionar el proyecto

1. Click en el selector de proyectos
2. Seleccionar `rrhh-kiosk-tts`
3. Verificar que aparece arriba: "rrhh-kiosk-tts"

✅ **Proyecto creado**

---

## 📋 PASO 2: HABILITAR API DE TEXT-TO-SPEECH

### 2.1 Ir a la biblioteca de APIs

🔗 **URL:** https://console.cloud.google.com/apis/library

O bien:
1. Menú hamburguesa (☰)
2. "APIs y servicios"
3. "Biblioteca"

### 2.2 Buscar y habilitar la API

1. En el buscador, escribir: `text to speech`
2. Click en "Cloud Text-to-Speech API"
3. Click en el botón azul "HABILITAR"
4. Esperar 10-20 segundos

✅ **API habilitada**

---

## 📋 PASO 3: CREAR CUENTA DE SERVICIO

### 3.1 Ir a Cuentas de servicio

🔗 **URL:** https://console.cloud.google.com/iam-admin/serviceaccounts

O bien:
1. Menú hamburguesa (☰)
2. "IAM y administración"
3. "Cuentas de servicio"

### 3.2 Crear nueva cuenta de servicio

1. Click en "+ CREAR CUENTA DE SERVICIO" (arriba)

2. **Paso 1 - Detalles de la cuenta de servicio:**
   - **Nombre:** `tts-service-account`
   - **ID:** (se genera automáticamente)
   - **Descripción:** `Cuenta para Text-to-Speech del kiosco RRHH`
   - Click en "CREAR Y CONTINUAR"

3. **Paso 2 - Otorgar acceso:**
   - **Seleccionar un rol:** Buscar y seleccionar:
     - `Cloud Text-to-Speech` → `Cloud Text-to-Speech User`
   - Click en "CONTINUAR"

4. **Paso 3 - Otorgar acceso a usuarios:**
   - (Dejar en blanco)
   - Click en "LISTO"

✅ **Cuenta de servicio creada**

---

## 📋 PASO 4: CREAR Y DESCARGAR CLAVE JSON

### 4.1 Acceder a la cuenta de servicio

1. En la lista de cuentas de servicio, buscar: `tts-service-account`
2. Click en el email de la cuenta (ej: `tts-service-account@rrhh-kiosk-tts.iam.gserviceaccount.com`)

### 4.2 Crear clave

1. Click en la pestaña "CLAVES" (arriba)
2. Click en "AGREGAR CLAVE"
3. Seleccionar "Crear clave nueva"
4. **Tipo de clave:** JSON (seleccionado por defecto)
5. Click en "CREAR"

### 4.3 Descargar archivo

- Se descargará automáticamente un archivo JSON
- **Nombre típico:** `rrhh-kiosk-tts-1234567890ab.json`

⚠️ **IMPORTANTE:** Este archivo contiene credenciales sensibles. Guárdalo de forma segura.

✅ **Clave JSON descargada**

---

## 📋 PASO 5: CONFIGURAR PROYECTO

### 5.1 Mover archivo JSON al proyecto

1. **Renombrar archivo** descargado a: `google-credentials.json`

2. **Mover** a la raíz del proyecto:
   ```
   c:\Users\Programador.ti1\Documents\NootebookLMTutorial\google-credentials.json
   ```

**Estructura esperada:**
```
NootebookLMTutorial/
├── google-credentials.json  ← AQUÍ
├── server.js
├── package.json
├── .env
└── ...
```

### 5.2 Actualizar archivo .env

1. **Abrir:** `c:\Users\Programador.ti1\Documents\NootebookLMTutorial\.env`

2. **Agregar al final:**
   ```bash
   # Google Cloud TTS Configuration
   GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
   ```

3. **Guardar archivo**

**Ejemplo completo de `.env`:**
```bash
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
NOTEBOOK_NAME=RRHH

# Google Cloud TTS Configuration
GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
```

✅ **Proyecto configurado**

---

## 📋 PASO 6: REINICIAR SERVIDOR

### 6.1 Detener servidor actual

En la terminal donde corre `npm run server`:
- Presionar `Ctrl + C`

### 6.2 Iniciar servidor nuevamente

```bash
npm run server
```

### 6.3 Verificar logs

Deberías ver:
```
🔑 Verificando credenciales de Google Cloud...
✅ Google Cloud TTS configurado correctamente

🚀 Server running on http://localhost:3000

Endpoints:
  POST /api/tts - Google Cloud Text-to-Speech Neural (premium voice)
```

✅ **Servidor reiniciado**

---

## 📋 PASO 7: PROBAR FUNCIONAMIENTO

### 7.1 Abrir aplicación

🔗 **URL:** http://localhost:5173

### 7.2 Hacer una consulta de voz

1. Click en el botón de micrófono
2. Decir: "Hola, ¿cómo estás?"
3. Esperar respuesta

### 7.3 Verificar logs del servidor

**Deberías ver:**
```
🎙️ ========================================
📝 Nueva solicitud TTS (Google Cloud):
   - Texto: "Soy tu asistente virtual..."
   - Voz: es-US-Neural2-A
========================================

🚀 Configuración:
   - Motor: Google Cloud Text-to-Speech
   - Voz: es-US-Neural2-A (Neural Premium)
   - Sample Rate: 24kHz
   - SSML: Activado

🔄 Intento 1/3 - Llamando a Google Cloud TTS API...
✅ Google Cloud TTS respondió exitosamente

🎉 AUDIO GENERADO EXITOSAMENTE POR GOOGLE
   - Tamaño: 51.11 KB
   - Calidad: 10/10 Premium (tipo Google Assistant)

💾 Audio guardado en caché (1/100)
```

### 7.4 Verificar logs del navegador

**Abrir consola (F12) y deberías ver:**
```
🎙️ ========================================
🚀 INICIANDO SÍNTESIS DE VOZ PREMIUM
   - Motor: Google Cloud TTS API
   - Modelo: Neural2 (Alta Definición)
   - Voz: es-US-Neural2-A
========================================

✅ Fuente del audio: google-cloud-neural

🎉 AUDIO RECIBIDO DE GOOGLE CLOUD
   - Tamaño: 51.11 KB
   - Fuente confirmada: Google Cloud TTS Neural

🔊 REPRODUCIENDO VOZ NEURAL PREMIUM
   - Calidad: 10/10 tipo Google Assistant

✅ Reproducción completada exitosamente
```

✅ **¡FUNCIONANDO!**

---

## 🎉 RESULTADO ESPERADO

Deberías escuchar una voz:

✅ **Completamente natural** (tipo Google Assistant)  
✅ **Sin tono robótico**  
✅ **Con pausas naturales**  
✅ **Femenina, cálida y profesional**  
✅ **En español latino**  

---

## 🔧 SOLUCIÓN DE PROBLEMAS

### Error: "GOOGLE_APPLICATION_CREDENTIALS not configured"

**Solución:**
1. Verificar que el archivo `google-credentials.json` existe en la raíz
2. Verificar que `.env` tiene la línea: `GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json`
3. Reiniciar el servidor

---

### Error: "Invalid Google Cloud credentials"

**Solución:**
1. Verificar que el archivo JSON no está corrupto
2. Verificar que la cuenta de servicio tiene el rol "Cloud Text-to-Speech User"
3. Verificar que la API está habilitada en el proyecto correcto

---

### Error: "Google Cloud quota exceeded"

**Solución:**
1. Verificar uso en: https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/quotas
2. Esperar 1 minuto (límite por minuto)
3. O esperar hasta el siguiente mes (límite mensual)

---

### No se escucha audio

**Solución:**
1. Verificar que el navegador tiene permisos de audio
2. Verificar volumen del sistema
3. Abrir consola del navegador (F12) y buscar errores
4. Verificar logs del servidor

---

## 💰 MONITOREO DE COSTOS

### Ver uso actual

🔗 **URL:** https://console.cloud.google.com/apis/api/texttospeech.googleapis.com/quotas

**Límite gratuito:** 1,000,000 caracteres/mes

**Uso estimado del kiosco:** ~110,000 caracteres/mes

**Costo:** $0 USD/mes (dentro del free tier)

---

## 🔒 SEGURIDAD

✅ **Archivo JSON en `.gitignore`** (no se versiona)  
✅ **Variable de entorno** (no en código)  
✅ **Rol mínimo necesario** (Text-to-Speech User)  
✅ **Nunca expuesto en frontend**  

⚠️ **NUNCA compartir el archivo `google-credentials.json`**

---

## 📚 RECURSOS ADICIONALES

- **Documentación oficial:** https://cloud.google.com/text-to-speech/docs
- **Voces disponibles:** https://cloud.google.com/text-to-speech/docs/voices
- **Precios:** https://cloud.google.com/text-to-speech/pricing
- **SSML:** https://cloud.google.com/text-to-speech/docs/ssml

---

## ✅ CHECKLIST FINAL

- [ ] Proyecto creado en Google Cloud
- [ ] API de Text-to-Speech habilitada
- [ ] Cuenta de servicio creada
- [ ] Clave JSON descargada
- [ ] Archivo `google-credentials.json` en la raíz del proyecto
- [ ] `.env` actualizado con `GOOGLE_APPLICATION_CREDENTIALS`
- [ ] Servidor reiniciado
- [ ] Aplicación probada
- [ ] Voz neural funcionando
- [ ] Logs confirmando Google Cloud TTS

---

**¡Listo! Ahora tienes voz neural premium tipo Google Assistant en tu kiosco de RRHH.**

---

**Soporte:**  
📧 Consultas técnicas: Ver documentación en `MIGRACION_GOOGLE_CLOUD_TTS.md`  
📅 12/02/2026
