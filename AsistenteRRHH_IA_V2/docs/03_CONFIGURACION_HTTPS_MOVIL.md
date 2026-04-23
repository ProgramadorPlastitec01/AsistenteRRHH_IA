# 🔒 CONFIGURACIÓN HTTPS PARA PRUEBAS MÓVILES

## ⚠️ IMPORTANTE

El reconocimiento de voz en dispositivos móviles **SOLO funciona con HTTPS**. Esta es una restricción de seguridad del navegador.

---

## 🚀 OPCIÓN 1: ngrok (Más Fácil - Recomendado)

### Ventajas:
- ✅ No requiere configuración
- ✅ HTTPS automático
- ✅ Funciona inmediatamente
- ✅ Ideal para pruebas rápidas

### Pasos:

#### 1. Descargar ngrok
```bash
# Visita: https://ngrok.com/download
# O instala con chocolatey (Windows):
choco install ngrok
```

#### 2. Iniciar tu servidor local
```bash
npm run dev
# El servidor estará en http://localhost:5173
```

#### 3. Crear túnel HTTPS con ngrok
```bash
# En otra terminal:
ngrok http 5173
```

#### 4. Usar la URL HTTPS
```
ngrok te dará una URL como:
https://abc123.ngrok-free.app

Usa esta URL en tu dispositivo móvil
```

### Ejemplo Completo:
```bash
# Terminal 1: Servidor de desarrollo
cd c:\Users\Programador.ti1\Documents\NootebookLMTutorial
npm run dev

# Terminal 2: Túnel ngrok
ngrok http 5173

# Output de ngrok:
# Forwarding: https://abc123.ngrok-free.app -> http://localhost:5173
```

### Notas:
- 🔄 La URL cambia cada vez que reinicias ngrok
- ⏰ Sesión gratuita dura 2 horas
- 📱 Puedes usar la URL en cualquier dispositivo

---

## 🏠 OPCIÓN 2: HTTPS Local con Certificado Autofirmado

### Ventajas:
- ✅ No depende de servicios externos
- ✅ Funciona sin internet
- ✅ URL estable (tu IP local)

### Desventajas:
- ⚠️ Requiere aceptar certificado no confiable
- ⚠️ Configuración más compleja

### Pasos:

#### 1. Instalar plugin de SSL
```bash
npm install -D @vitejs/plugin-basic-ssl
```

#### 2. Modificar vite.config.js
```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'  // ← Agregar

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    basicSsl()  // ← Agregar
  ],
  server: {
    host: true,
    port: 5173,
    https: true,  // ← Agregar
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
```

#### 3. Obtener tu IP local
```bash
# Windows PowerShell:
ipconfig

# Busca "Dirección IPv4" en tu adaptador de red WiFi/Ethernet
# Ejemplo: 192.168.1.100
```

#### 4. Iniciar servidor
```bash
npm run dev

# El servidor estará en:
# https://localhost:5173 (local)
# https://192.168.1.100:5173 (red local)
```

#### 5. Acceder desde móvil
```
1. Conecta tu móvil a la MISMA red WiFi
2. Abre el navegador en el móvil
3. Visita: https://192.168.1.100:5173
4. Acepta el certificado no confiable
```

### Aceptar Certificado en Móviles:

**Android (Chrome):**
1. Aparecerá advertencia "Tu conexión no es privada"
2. Toca "Avanzado"
3. Toca "Continuar a [tu IP] (no seguro)"

**iOS (Safari):**
1. Aparecerá advertencia
2. Toca "Mostrar detalles"
3. Toca "Visitar este sitio web"
4. Confirma

---

## 🌐 OPCIÓN 3: Desplegar en Servicio con HTTPS

### Netlify (Recomendado para Demo)

#### 1. Crear cuenta en Netlify
```
https://www.netlify.com
```

#### 2. Instalar Netlify CLI
```bash
npm install -g netlify-cli
```

#### 3. Build del proyecto
```bash
npm run build
```

#### 4. Desplegar
```bash
netlify deploy --prod

# Sigue las instrucciones
# Te dará una URL HTTPS permanente
```

### Vercel

#### 1. Instalar Vercel CLI
```bash
npm install -g vercel
```

#### 2. Desplegar
```bash
vercel

# Sigue las instrucciones
# Te dará una URL HTTPS permanente
```

---

## 🔍 VERIFICAR QUE HTTPS ESTÁ FUNCIONANDO

### 1. Abre la aplicación en el móvil
### 2. Verifica el candado 🔒 en la barra de direcciones
### 3. La URL debe empezar con `https://`

### Si no ves el candado:
- ❌ El reconocimiento de voz NO funcionará
- ❌ Verifica que estés usando una de las opciones anteriores

---

## 🧪 PROBAR EL RECONOCIMIENTO DE VOZ

Una vez que tengas HTTPS funcionando:

1. Abre la aplicación en tu móvil
2. Toca el botón de micrófono 🎙️
3. Debe aparecer el diálogo de permisos
4. Acepta el permiso
5. Di "Vacaciones"
6. Debe procesar y enviar al backend

### Si no funciona:
1. Abre la consola del navegador (DevTools remoto)
2. Busca errores en rojo
3. Verifica que aparezcan los logs con emojis (🎤, ✅, ❌)
4. Revisa la guía: `GUIA_PRUEBAS_MOVIL.md`

---

## 📱 DEBUGGING REMOTO

### Android (Chrome)

#### En el móvil:
1. Ajustes → Opciones de desarrollador
2. Activar "Depuración USB"
3. Conectar al PC con cable USB

#### En el PC:
1. Abrir Chrome
2. Ir a: `chrome://inspect`
3. Seleccionar tu dispositivo
4. Click en "Inspect"

### iOS (Safari)

#### En el iPhone/iPad:
1. Ajustes → Safari → Avanzado
2. Activar "Web Inspector"

#### En el Mac:
1. Conectar dispositivo con cable
2. Abrir Safari
3. Menú Desarrollar → [Tu dispositivo] → [Tu página]

---

## ⚡ RESUMEN RÁPIDO

### Para Pruebas Rápidas:
```bash
# Opción más fácil: ngrok
npm run dev          # Terminal 1
ngrok http 5173      # Terminal 2
# Usar URL https://xxx.ngrok-free.app en móvil
```

### Para Desarrollo Local:
```bash
# Instalar SSL
npm install -D @vitejs/plugin-basic-ssl

# Modificar vite.config.js (agregar basicSsl())

# Iniciar servidor
npm run dev

# Acceder desde móvil
# https://[TU_IP_LOCAL]:5173
```

### Para Demo Permanente:
```bash
# Build y deploy
npm run build
netlify deploy --prod
# O: vercel
```

---

## 🎯 RECOMENDACIÓN

**Para pruebas rápidas:** Usa **ngrok** (Opción 1)  
**Para desarrollo continuo:** Usa **HTTPS local** (Opción 2)  
**Para demo a clientes:** Usa **Netlify/Vercel** (Opción 3)

---

## ❓ PREGUNTAS FRECUENTES

### ¿Por qué necesito HTTPS?
Los navegadores móviles requieren HTTPS para acceder al micrófono por razones de seguridad.

### ¿Funciona en localhost sin HTTPS?
Solo en escritorio. En móviles, **siempre** necesitas HTTPS.

### ¿Puedo usar HTTP en red local?
No. Incluso en red local, los móviles requieren HTTPS.

### ¿ngrok es gratis?
Sí, pero con limitaciones (2 horas por sesión, URL cambia cada vez).

### ¿Necesito cuenta en ngrok?
No para uso básico, pero con cuenta tienes más beneficios.

---

**Documento creado:** 2026-02-12  
**Propósito:** Facilitar pruebas en dispositivos móviles  
**Próximo paso:** Elegir una opción e implementarla
