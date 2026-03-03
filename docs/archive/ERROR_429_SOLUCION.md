# ⚠️ ERROR 429: GOOGLE CLOUD NO CONFIGURADO

**Fecha:** 12/02/2026 - 15:06  
**Error:** 429 Too Many Requests  
**Causa:** Google Cloud TTS no está configurado

---

## 🔴 PROBLEMA ACTUAL

El código está intentando usar **Google Cloud TTS** pero:

❌ **No tienes credenciales de Google Cloud configuradas**  
❌ **El archivo `google-credentials.json` no existe**  
❌ **La variable `GOOGLE_APPLICATION_CREDENTIALS` no está en `.env`**

**Resultado:** Error 429 (el servidor no puede procesar la solicitud)

---

## ✅ SOLUCIONES

### OPCIÓN 1: Volver Temporalmente a OpenAI TTS ⚡

**Ventajas:**
- ✅ Funciona INMEDIATAMENTE (2 minutos)
- ✅ Ya tienes la API key configurada
- ✅ No requiere configuración adicional

**Desventajas:**
- ⚠️ Límite de 3 solicitudes por minuto
- ⚠️ Puede dar error 429 si haces muchas consultas

**Pasos:**
1. Revertir código a OpenAI TTS
2. Reiniciar servidor
3. Probar

---

### OPCIÓN 2: Configurar Google Cloud TTS ⭐ (Recomendado)

**Ventajas:**
- ✅ Límite generoso: 1M caracteres/mes
- ✅ Mejor estabilidad
- ✅ Más voces disponibles
- ✅ Sistema de caché integrado
- ✅ SSML para pausas naturales
- ✅ Costo: $0/mes (free tier)

**Desventajas:**
- ⏱️ Requiere 10-15 minutos de configuración inicial

**Pasos:**
1. Crear proyecto en Google Cloud
2. Habilitar API de Text-to-Speech
3. Crear cuenta de servicio
4. Descargar credenciales JSON
5. Configurar `.env`
6. Reiniciar servidor

**Guía completa:** `GUIA_CONFIGURACION_GOOGLE_CLOUD.md`

---

## 🚀 OPCIÓN 1: VOLVER A OPENAI (RÁPIDO)

Si eliges esta opción, necesito:

1. Revertir `server.js` a OpenAI TTS
2. Revertir `VoiceChat.jsx` a voz `nova`
3. Reiniciar servidor

**Tiempo:** 2 minutos  
**Resultado:** Voz funcionando inmediatamente

---

## 🌟 OPCIÓN 2: CONFIGURAR GOOGLE CLOUD (RECOMENDADO)

### Paso 1: Crear Proyecto

1. Ir a: https://console.cloud.google.com/
2. Crear proyecto: `rrhh-kiosk-tts`

### Paso 2: Habilitar API

1. Ir a: https://console.cloud.google.com/apis/library
2. Buscar: "Cloud Text-to-Speech API"
3. Click en "Habilitar"

### Paso 3: Crear Cuenta de Servicio

1. Ir a: https://console.cloud.google.com/iam-admin/serviceaccounts
2. Crear cuenta: `tts-service-account`
3. Rol: `Cloud Text-to-Speech User`
4. Crear clave JSON
5. Descargar

### Paso 4: Configurar

1. Renombrar archivo a: `google-credentials.json`
2. Mover a: `c:\Users\Programador.ti1\Documents\NootebookLMTutorial\`
3. Agregar a `.env`:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=./google-credentials.json
   ```
4. Reiniciar servidor

**Tiempo:** 10-15 minutos  
**Resultado:** Voz premium tipo Google Assistant

---

## 📊 COMPARATIVA

| Aspecto | OpenAI TTS | Google Cloud TTS |
|---------|------------|------------------|
| **Tiempo de setup** | ✅ 2 min | ⏱️ 15 min |
| **Límite** | ⚠️ 3 RPM | ✅ 1M chars/mes |
| **Costo** | $30/1M | ✅ $16/1M |
| **Estabilidad** | Buena | ✅ Excelente |
| **SSML** | ❌ No | ✅ Sí |
| **Caché** | Manual | ✅ Integrado |

---

## 🎯 RECOMENDACIÓN

**Para producción:** Google Cloud TTS ⭐  
**Para prueba rápida:** OpenAI TTS ⚡

---

## 💬 ¿QUÉ PREFIERES?

**Responde con:**
- `1` = Volver a OpenAI (rápido)
- `2` = Configurar Google Cloud (recomendado)

---

**Estoy listo para ayudarte con cualquiera de las dos opciones.**
