# 🎯 ARQUITECTURA HÍBRIDA DE RECONOCIMIENTO DE VOZ

**Fecha:** 2026-02-12  
**Tipo:** Sistema Híbrido Inteligente  
**Objetivo:** Reconocimiento de voz robusto en todos los dispositivos

---

## 📊 ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                     │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────┐           │
│  │   Detección Automática de Dispositivo   │           │
│  └─────────────────┬───────────────────────┘           │
│                    │                                    │
│         ┌──────────┴──────────┐                        │
│         ▼                     ▼                        │
│  ┌─────────────┐      ┌──────────────┐                │
│  │  DESKTOP    │      │   MÓVIL      │                │
│  │             │      │              │                │
│  │ Web Speech  │      │ MediaRecorder│                │
│  │    API      │      │   + Blob     │                │
│  │             │      │              │                │
│  │ (Gratuito)  │      │ (Robusto)    │                │
│  └──────┬──────┘      └──────┬───────┘                │
│         │                    │                         │
│         │                    │ POST /api/transcribe    │
│         │                    │ (audio file)            │
│         │                    ▼                         │
│         │            ┌───────────────┐                 │
│         │            │   BACKEND     │                 │
│         │            │   (Node.js)   │                 │
│         │            └───────┬───────┘                 │
│         │                    │                         │
│         │                    │ OpenAI Whisper API      │
│         │                    ▼                         │
│         │            ┌───────────────┐                 │
│         │            │  Transcripción│                 │
│         │            └───────┬───────┘                 │
│         │                    │                         │
│         └────────────────────┘                         │
│                      │                                 │
│                      ▼                                 │
│              ┌───────────────┐                         │
│              │  handleQuery  │                         │
│              │  (NotebookLM) │                         │
│              └───────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 COMPONENTES

### 1. **Detección de Dispositivo**

```javascript
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

if (isMobile) {
    // Usar MediaRecorder + Whisper
} else {
    // Usar Web Speech API
}
```

### 2. **Desktop: Web Speech API**

**Ventajas:**
- ✅ Gratuito
- ✅ Rápido (procesamiento local)
- ✅ Sin latencia de red
- ✅ Ya implementado y funcional

**Desventajas:**
- ❌ Problemas en móviles
- ❌ Dependiente del navegador

### 3. **Móvil: MediaRecorder + Whisper**

**Ventajas:**
- ✅ Funciona en todos los móviles
- ✅ Robusto y confiable
- ✅ Alta precisión (Whisper)
- ✅ Soporte de múltiples idiomas

**Desventajas:**
- ❌ Costo por uso (~$0.006/minuto)
- ❌ Requiere conexión a internet
- ❌ Latencia de red

---

## 📱 FLUJO MÓVIL (MediaRecorder + Whisper)

```
1. Usuario toca botón de micrófono
   ↓
2. Solicitar permiso de micrófono
   ↓
3. getUserMedia({ audio: true })
   ↓
4. Crear MediaRecorder
   ↓
5. Iniciar grabación
   ↓
6. Usuario habla
   ↓
7. Acumular chunks de audio
   ↓
8. Usuario detiene o timeout (10s)
   ↓
9. Detener MediaRecorder
   ↓
10. Crear Blob de audio
    ↓
11. Convertir a FormData
    ↓
12. POST /api/transcribe
    ↓
13. Backend recibe audio
    ↓
14. Enviar a OpenAI Whisper
    ↓
15. Recibir transcripción
    ↓
16. Devolver al frontend
    ↓
17. handleQuery(transcript)
    ↓
18. Mostrar respuesta
```

---

## 🖥️ FLUJO DESKTOP (Web Speech API)

```
1. Usuario toca botón de micrófono
   ↓
2. Solicitar permiso de micrófono
   ↓
3. Crear SpeechRecognition
   ↓
4. Configurar (continuous: false, interimResults: false)
   ↓
5. Iniciar reconocimiento
   ↓
6. Usuario habla
   ↓
7. onresult se dispara
   ↓
8. Extraer transcript
   ↓
9. handleQuery(transcript)
   ↓
10. Mostrar respuesta
```

---

## 🔑 CONFIGURACIÓN REQUERIDA

### **OpenAI API Key:**

1. Crear cuenta en: https://platform.openai.com
2. Generar API key
3. Agregar al archivo `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```

### **Variables de Entorno:**

```bash
# .env
OPENAI_API_KEY=sk-proj-...
WHISPER_MODEL=whisper-1
WHISPER_LANGUAGE=es
```

---

## 💰 COSTOS ESTIMADOS

### **OpenAI Whisper API:**

- **Precio:** $0.006 por minuto de audio
- **Ejemplo:** 
  - 100 consultas/día × 30 segundos promedio = 50 minutos/día
  - 50 minutos × $0.006 = $0.30/día
  - $0.30 × 30 días = **$9/mes**

### **Optimización de Costos:**

1. **Timeout de 10 segundos:** Limita duración de grabación
2. **Solo móviles:** Desktop usa Speech API gratuito
3. **Caché de respuestas:** Evita transcripciones duplicadas

---

## 🛠️ IMPLEMENTACIÓN

### **Frontend:**

```javascript
// VoiceChat.jsx
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

const startListening = async () => {
    if (isMobile) {
        await startRecording(); // MediaRecorder
    } else {
        await startSpeechRecognition(); // Web Speech API
    }
};
```

### **Backend:**

```javascript
// server.js
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    const audioFile = req.file;
    
    // Enviar a OpenAI Whisper
    const transcript = await transcribeWithWhisper(audioFile);
    
    res.json({ transcript });
});
```

---

## ✅ VENTAJAS DEL SISTEMA HÍBRIDO

1. **Costo Optimizado:**
   - Desktop: Gratuito (Web Speech API)
   - Móvil: De pago pero garantizado

2. **Máxima Compatibilidad:**
   - Funciona en todos los dispositivos
   - Fallback automático

3. **Mejor Experiencia:**
   - Desktop: Rápido y sin latencia
   - Móvil: Robusto y confiable

4. **Escalable:**
   - Fácil de mantener
   - Fácil de extender

---

## 🔒 SEGURIDAD

1. **API Key:**
   - Nunca exponer en frontend
   - Solo en backend (.env)

2. **Validación:**
   - Validar formato de audio
   - Limitar tamaño de archivo
   - Rate limiting

3. **HTTPS:**
   - Requerido para getUserMedia
   - Ya configurado con ngrok

---

## 📊 MONITOREO

### **Métricas a Rastrear:**

1. **Uso de Whisper:**
   - Número de transcripciones/día
   - Minutos de audio procesados
   - Costo acumulado

2. **Tasa de Éxito:**
   - Transcripciones exitosas
   - Errores de Whisper
   - Timeouts

3. **Dispositivos:**
   - % Desktop vs Móvil
   - Navegadores más usados

---

## 🚀 PRÓXIMOS PASOS

1. ✅ Crear endpoint `/api/transcribe`
2. ✅ Implementar MediaRecorder en frontend
3. ✅ Integrar OpenAI Whisper
4. ✅ Agregar detección de dispositivo
5. ✅ Probar en móviles
6. ✅ Documentar configuración

---

**Arquitectura:** Sistema Híbrido Inteligente  
**Estado:** En Implementación  
**Compatibilidad:** Desktop + Móvil (Android/iOS)  
**Costo Estimado:** ~$9/mes (solo móviles)

**¡Mejor solución para producción! 🎉**
