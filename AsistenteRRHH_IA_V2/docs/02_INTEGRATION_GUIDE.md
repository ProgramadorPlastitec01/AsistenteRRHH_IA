# 🔌 Guía de Integración con NotebookLM MCP - Producción

Esta guía te ayudará a conectar la aplicación del quiosco con el servidor MCP de NotebookLM real.

## 📋 Prerrequisitos

1. ✅ NotebookLM MCP Server instalado y configurado
2. ✅ Cuaderno 'RRHH' creado en NotebookLM con fuentes de información
3. ✅ Node.js 18+ instalado
4. ✅ Autenticación de NotebookLM configurada

## 🚀 Opción 1: Backend API (Recomendado)

### Paso 1: Instalar Dependencias del Backend

```bash
npm install express cors @modelcontextprotocol/sdk
```

### Paso 2: Verificar el Servidor MCP

Primero, verifica que el servidor MCP funciona correctamente:

```bash
nlm notebook list
```

Deberías ver tu cuaderno 'RRHH' en la lista.

### Paso 3: Iniciar el Backend

En una terminal:

```bash
npm run server
```

Deberías ver:
```
✅ HR Kiosk Backend Server running on http://localhost:3000
📚 Connected to NotebookLM notebook: [notebook-id]
```

### Paso 4: Actualizar el Cliente Frontend

Edita `src/utils/notebookLMClient.js` y reemplaza el método `query`:

```javascript
async query(query) {
  try {
    const response = await fetch('http://localhost:3000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        query: query,
        conversation_id: this.conversationId 
      })
    });

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }

    const data = await response.json();
    
    // Update conversation ID for context
    if (data.conversationId) {
      this.conversationId = data.conversationId;
    }

    return data.response;
  } catch (error) {
    console.error('Query failed:', error);
    throw new Error('No pude procesar tu consulta. Por favor, contacta con un representante de RRHH.');
  }
}
```

### Paso 5: Iniciar el Frontend

En otra terminal:

```bash
npm run dev
```

### Paso 6: Probar la Integración

1. Abre `http://localhost:5173` en Chrome o Edge
2. Permite el acceso al micrófono
3. Haz clic en el botón del micrófono
4. Haz una pregunta sobre RRHH
5. Verifica que la respuesta proviene del cuaderno NotebookLM

## 🔧 Opción 2: Proxy de Desarrollo Vite

Si prefieres no ejecutar un servidor separado durante el desarrollo:

### Paso 1: Actualizar `vite.config.js`

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      }
    }
  }
})
```

### Paso 2: Usar Rutas Relativas

En `notebookLMClient.js`, usa rutas relativas:

```javascript
const response = await fetch('/api/query', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query })
});
```

## 🐛 Solución de Problemas

### Error: "RRHH notebook not found"

**Causa**: El cuaderno no existe o tiene un nombre diferente.

**Solución**:
```bash
# Listar todos los cuadernos
nlm notebook list

# Verificar el nombre exacto del cuaderno
# Actualizar server.js línea 54 con el nombre correcto
```

### Error: "Service not initialized"

**Causa**: El backend no pudo conectarse al MCP server.

**Solución**:
1. Verifica que el comando `nlm` funciona:
   ```bash
   nlm --version
   ```
2. Verifica la autenticación:
   ```bash
   nlm auth status
   ```
3. Si es necesario, re-autentica:
   ```bash
   nlm auth login
   ```

### Error: "No speech detected"

**Causa**: Problemas con el micrófono o permisos.

**Solución**:
1. Verifica que el navegador tiene permiso para usar el micrófono
2. Prueba con otro navegador (Chrome o Edge recomendados)
3. Verifica que el micrófono funciona en otras aplicaciones

### Error: CORS

**Causa**: Política de CORS bloqueando las peticiones.

**Solución**:
El servidor ya incluye `cors()` middleware. Si persiste:
```javascript
// En server.js, especifica el origen exacto:
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
```

## 📊 Monitoreo y Logs

### Backend Logs

El servidor backend registra todas las consultas:

```bash
Processing query: "¿Cuántos días de vacaciones tengo?"
```

### Frontend Console

Abre las DevTools del navegador (F12) para ver:
- Estado de inicialización
- Consultas enviadas
- Respuestas recibidas
- Errores de Web Speech API

## 🔒 Seguridad en Producción

### 1. Variables de Entorno

Crea un archivo `.env`:

```env
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=http://localhost:5173,https://tu-dominio.com
```

Actualiza `server.js`:

```javascript
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS.split(','),
  credentials: true
}));
```

### 2. Rate Limiting

Instala y configura rate limiting:

```bash
npm install express-rate-limit
```

```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100 // límite de 100 peticiones por ventana
});

app.use('/api/', limiter);
```

### 3. HTTPS

Para producción, usa HTTPS:

```javascript
import https from 'https';
import fs from 'fs';

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, app).listen(443);
```

## 🚀 Despliegue

### Opción A: Servidor Local (Quiosco)

Para un quiosco físico:

1. **Build del frontend**:
   ```bash
   npm run build
   ```

2. **Servir archivos estáticos desde el backend**:
   ```javascript
   // En server.js
   import path from 'path';
   
   app.use(express.static(path.join(__dirname, 'dist')));
   
   app.get('*', (req, res) => {
     res.sendFile(path.join(__dirname, 'dist', 'index.html'));
   });
   ```

3. **Ejecutar en modo producción**:
   ```bash
   NODE_ENV=production node server.js
   ```

4. **Configurar inicio automático** (Windows):
   - Crear un archivo `start-kiosk.bat`:
     ```batch
     @echo off
     cd C:\path\to\NootebookLMTutorial
     node server.js
     ```
   - Agregar a Inicio de Windows

### Opción B: Servidor Cloud

Si el cuaderno está en la nube:

1. Despliega el backend en un servicio como:
   - Heroku
   - Railway
   - DigitalOcean
   - AWS EC2

2. Actualiza las URLs en el frontend

3. Configura variables de entorno en el servicio

## 📝 Checklist de Producción

- [ ] Cuaderno RRHH creado y poblado con información
- [ ] Backend instalado y funcionando
- [ ] Frontend conectado al backend
- [ ] Pruebas de voz funcionando
- [ ] Filtro de seguridad verificado (respuestas solo del cuaderno)
- [ ] Rate limiting configurado
- [ ] HTTPS habilitado
- [ ] Logs configurados
- [ ] Monitoreo activo
- [ ] Plan de backup del cuaderno

## 🆘 Soporte

Si encuentras problemas:

1. Revisa los logs del backend
2. Verifica la consola del navegador
3. Prueba el MCP server directamente con `nlm`
4. Consulta la documentación de NotebookLM MCP

## 📚 Recursos Adicionales

- [Documentación NotebookLM MCP](https://github.com/your-repo/notebooklm-mcp)
- [Web Speech API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Express.js](https://expressjs.com/)
- [Vite](https://vitejs.dev/)
