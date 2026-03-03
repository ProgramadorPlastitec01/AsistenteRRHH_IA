# 🎙️ Asistente de RRHH - Quiosco Inteligente

Una aplicación de quiosco inteligente con interfaz de voz para el departamento de Recursos Humanos, integrada con NotebookLM.

## 🌟 Características

- **Interfaz de Voz Completa**: Reconocimiento de voz (Speech-to-Text) y síntesis de voz (Text-to-Speech)
- **Integración NotebookLM**: Consultas basadas en el cuaderno de RRHH
- **UI Profesional**: Diseño minimalista con efectos glassmorphism y Tailwind CSS
- **Estados Visuales**: Indicadores claros de "escuchando", "pensando" y "hablando"
- **Filtro de Seguridad**: Solo responde con información del cuaderno, redirige a RRHH para consultas fuera de alcance
- **Optimizado para Pantalla Táctil**: Diseñado para quioscos interactivos

## 📁 Estructura del Proyecto

```
NootebookLMTutorial/
├── src/
│   ├── components/
│   │   └── VoiceChat.jsx          # Componente principal del quiosco
│   ├── utils/
│   │   └── notebookLMClient.js    # Cliente MCP de NotebookLM
│   ├── App.jsx                     # Componente raíz
│   └── index.css                   # Estilos globales con Tailwind
├── mcp-config.json                 # Configuración del servidor MCP
├── tailwind.config.js              # Configuración de Tailwind CSS
└── package.json
```

## 🚀 Instalación

1. **Instalar dependencias**:
```bash
npm install
```

2. **Configurar NotebookLM MCP Server**:
   - Asegúrate de tener el servidor MCP de NotebookLM instalado y configurado
   - Verifica que el cuaderno 'RRHH' esté creado en NotebookLM
   - El archivo `mcp-config.json` ya está configurado

3. **Ejecutar en modo desarrollo**:
```bash
npm run dev
```

4. **Abrir en el navegador**:
   - Navega a `http://localhost:5173`
   - **Importante**: Usa Chrome o Edge para soporte completo de Web Speech API

## 🎯 Uso

1. **Presiona el botón del micrófono** (🎙️) para comenzar a hablar
2. **Haz tu pregunta** sobre temas de RRHH (vacaciones, nómina, horarios, beneficios, etc.)
3. **Escucha la respuesta** - La IA procesará tu consulta y responderá en voz alta
4. **Repite** según sea necesario

### Ejemplos de Preguntas:
- "¿Cuántos días de vacaciones tengo?"
- "¿Cuándo se paga la nómina?"
- "¿Cuál es el horario de oficina?"
- "¿Qué beneficios ofrece la empresa?"

## � Conexión y Ejecución (Implementado)

El proyecto ya cuenta con un servidor backend (`server.js`) configurado para manejar la conexión con NotebookLM.

### 1. Iniciar la Aplicación

Para usar el sistema, necesitas dos terminales abiertas:

**Terminal 1 (Backend):**
```bash
npm run server
```
*Esto inicia el servidor en el puerto 3000, busca automáticamente el cuaderno "RRHH" y establece la conexión.*

**Terminal 2 (Frontend):**
```bash
npm run dev
```
*Esto inicia la interfaz de usuario. Abre `http://localhost:5173` en tu navegador.*

**Nota:** No es necesario configurar IDs manualmente cada vez; el servidor lo hace automáticamente.

### 2. Mantenimiento y Re-autenticación

La conexión depende de las credenciales de Google, que pueden caducar por seguridad.

**Síntoma:**
Si el sistema deja de responder o el servidor indica que ha entrado en **"MODO DEMO"**.

**Solución:**
Ejecuta el siguiente comando en una terminal para renovar los permisos:

```bash
npx notebooklm-mcp-server auth
```

Sigue las instrucciones en pantalla para iniciar sesión nuevamente con tu cuenta de Google. Una vez completado, reinicia el servidor (`npm run server`) y todo volverá a funcionar.

## 🎨 Personalización

### Colores
Edita `tailwind.config.js` para cambiar la paleta de colores:

```javascript
colors: {
  primary: {
    // Tus colores personalizados
  }
}
```

### Voz
Modifica los parámetros de síntesis de voz en `VoiceChat.jsx`:

```javascript
utterance.rate = 0.9;  // Velocidad (0.1 - 10)
utterance.pitch = 1;   // Tono (0 - 2)
```

### Idioma
Cambia el idioma en `VoiceChat.jsx`:

```javascript
recognitionRef.current.lang = 'es-ES';  // Español
utterance.lang = 'es-ES';
```

## 🔒 Seguridad

- ✅ Solo responde con información del cuaderno NotebookLM
- ✅ Redirige a RRHH humano para consultas fuera de alcance
- ✅ No almacena datos personales del usuario
- ✅ Todas las consultas se procesan en tiempo real

## 🌐 Navegadores Compatibles

- ✅ Google Chrome (Recomendado)
- ✅ Microsoft Edge
- ⚠️ Firefox (Soporte limitado de Web Speech API)
- ❌ Safari (Sin soporte de Web Speech Recognition)

## 📱 Modo Quiosco

Para ejecutar en modo quiosco de pantalla completa:

**Chrome:**
```bash
chrome --kiosk --app=http://localhost:5173
```

**Edge:**
```bash
msedge --kiosk --app=http://localhost:5173
```

## 🛠️ Tecnologías

- **React 18** - Framework UI
- **Vite** - Build tool
- **Tailwind CSS** - Estilos
- **Web Speech API** - Reconocimiento y síntesis de voz
- **NotebookLM MCP** - Base de conocimientos

## 📝 Notas de Desarrollo

- El cliente MCP actual (`notebookLMClient.js`) incluye respuestas simuladas para desarrollo
- Para producción, implementa el backend API o usa una extensión de navegador
- La aplicación requiere permisos de micrófono del navegador
- Asegúrate de tener una conexión estable para consultas en tiempo real

## 🤝 Soporte

Para consultas técnicas o problemas con la aplicación, contacta al equipo de IT.
Para consultas de RRHH, visita la oficina en el piso 3 o llama a la extensión 1234.

## 📄 Licencia

Uso interno - Departamento de RRHH
