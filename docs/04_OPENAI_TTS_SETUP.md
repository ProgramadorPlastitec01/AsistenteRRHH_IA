# 🎙️ CONFIGURACIÓN RÁPIDA: OpenAI TTS

## ⚡ INICIO RÁPIDO (5 minutos)

### 1. Obtener API Key
1. Ve a: https://platform.openai.com/api-keys
2. Crea una nueva API key
3. Cópiala (empieza con `sk-proj-...`)

### 2. Configurar .env
Abre el archivo `.env` y agrega:

```bash
OPENAI_API_KEY=sk-proj-TU-API-KEY-AQUI
```

### 3. Reiniciar Servidor
```bash
# Detener el servidor actual (Ctrl+C)
# Luego ejecutar:
npm run server
```

### 4. Verificar
Deberías ver en la consola:
```
POST /api/tts - OpenAI Text-to-Speech (premium voice) ✅
```

## ✅ ¡Listo!

Ahora la voz del kiosco es **calidad 10/10** tipo ChatGPT Voice.

---

## 📊 Costo Estimado

- **~$3-5 USD/mes** para uso típico de kiosco RRHH
- Modelo: `tts-1-hd` (alta definición)
- Voz: `nova` (femenina, cálida, profesional)

---

## 🔧 Troubleshooting

**Error: "OpenAI TTS not configured"**
- Verifica que agregaste `OPENAI_API_KEY` en `.env`
- Reinicia el servidor

**Error: "Invalid OpenAI API key"**
- Verifica que la key sea correcta
- Genera una nueva en https://platform.openai.com/api-keys

---

## 📖 Documentación Completa

Ver: `.agent/OPENAI_TTS_IMPLEMENTATION_GUIDE.md`
