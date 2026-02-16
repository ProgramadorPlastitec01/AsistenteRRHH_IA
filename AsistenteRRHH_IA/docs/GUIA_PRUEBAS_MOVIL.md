# 📱 GUÍA DE PRUEBAS EN DISPOSITIVOS MÓVILES

## 🎯 Objetivo

Esta guía te ayudará a **validar** que el reconocimiento de voz funciona correctamente en tablets y dispositivos móviles después de las optimizaciones implementadas.

---

## 📋 REQUISITOS PREVIOS

### 1. ✅ HTTPS Obligatorio

**⚠️ CRÍTICO:** El reconocimiento de voz en móviles **SOLO funciona en HTTPS**.

#### Opciones para Probar:

**Opción A: Usar ngrok (Recomendado para pruebas rápidas)**
```bash
# 1. Instalar ngrok (si no lo tienes)
# Descargar de: https://ngrok.com/download

# 2. Iniciar tu servidor local
npm run dev

# 3. En otra terminal, crear túnel HTTPS
ngrok http 5173

# 4. Usar la URL HTTPS que te proporciona ngrok
# Ejemplo: https://abc123.ngrok.io
```

**Opción B: Usar Vite con HTTPS local**
```bash
# 1. Instalar certificado local
npm install -D @vitejs/plugin-basic-ssl

# 2. Modificar vite.config.js (ya configurado)
# 3. Iniciar servidor
npm run dev

# 4. Acceder desde móvil usando la IP local
# Ejemplo: https://192.168.1.100:5173
```

**Opción C: Desplegar en servidor con HTTPS**
- Netlify
- Vercel
- GitHub Pages
- Firebase Hosting

---

## 🧪 PROTOCOLO DE PRUEBAS

### PRUEBA 1: Verificar Permisos de Micrófono

#### Pasos:
1. Abre la aplicación en tu dispositivo móvil
2. Toca el botón de micrófono 🎙️
3. **Verifica que aparezca el diálogo de permisos del navegador**

#### Resultados Esperados:
- ✅ Aparece diálogo solicitando permiso de micrófono
- ✅ Al aceptar, el botón cambia a rojo con animación de pulso
- ✅ Aparece el mensaje "Escuchando... Habla ahora"

#### Si Falla:
- ❌ Verifica que estés usando HTTPS
- ❌ Revisa la configuración de permisos del navegador
- ❌ Intenta en modo incógnito/privado

---

### PRUEBA 2: Captura de Voz Básica

#### Pasos:
1. Activa el micrófono
2. Espera a ver el indicador "Escuchando..."
3. Di claramente: **"Vacaciones"**
4. Espera 1-2 segundos en silencio

#### Resultados Esperados:
- ✅ El texto "Vacaciones" aparece en el indicador de estado
- ✅ El botón deja de estar rojo
- ✅ El sistema cambia a estado "Procesando..."
- ✅ Aparece una respuesta del backend
- ✅ El micrófono se cierra automáticamente

#### Logs en Consola (Abre DevTools en móvil):
```
🎤 INICIANDO RECONOCIMIENTO DE VOZ
   - Dispositivo: MÓVIL
📱 Solicitando permiso de micrófono...
✅ Permiso de micrófono concedido
🔧 Configuración de reconocimiento:
   - continuous: false
   - interimResults: false
   - maxAlternatives: 1
   - lang: es-ES
🎬 Iniciando reconocimiento...
✅ start() ejecutado correctamente
✅ Reconocimiento INICIADO
📝 EVENTO onresult DISPARADO
   - Número de resultados: 1
   - Resultado [0]: { transcript: "Vacaciones", confidence: 0.95, isFinal: true }
✅ RESULTADO FINAL DETECTADO
   - Texto: Vacaciones
   - Confianza: 0.95
🚀 Enviando al backend: Vacaciones
🏁 Reconocimiento FINALIZADO
```

---

### PRUEBA 3: Frases Largas

#### Pasos:
1. Activa el micrófono
2. Di: **"¿Cuántos días de vacaciones tengo al año?"**
3. Espera en silencio

#### Resultados Esperados:
- ✅ Captura la frase completa
- ✅ Procesa correctamente
- ✅ Envía al backend
- ✅ Recibe respuesta coherente

---

### PRUEBA 4: Timeout de Seguridad

#### Pasos:
1. Activa el micrófono
2. **NO hables** (mantén silencio)
3. Espera 10 segundos

#### Resultados Esperados:
- ✅ Después de 10 segundos, aparece mensaje de error
- ✅ "No se detectó voz. Por favor intenta de nuevo."
- ✅ El botón vuelve a azul
- ✅ El micrófono se cierra automáticamente

#### Log Esperado:
```
⏱️ TIMEOUT: No se detectó resultado final en 10 segundos
🏁 Reconocimiento FINALIZADO
```

---

### PRUEBA 5: Múltiples Consultas Consecutivas

#### Pasos:
1. Realiza consulta: "Vacaciones"
2. Espera a que termine
3. Realiza consulta: "Horarios"
4. Espera a que termine
5. Realiza consulta: "Seguro médico"

#### Resultados Esperados:
- ✅ Cada consulta se procesa correctamente
- ✅ No hay interferencias entre consultas
- ✅ El micrófono se cierra y abre correctamente
- ✅ No hay fugas de memoria

---

### PRUEBA 6: Manejo de Errores

#### PRUEBA 6A: Permiso Denegado
**Pasos:**
1. Deniega el permiso de micrófono
2. Intenta activar el micrófono

**Resultado Esperado:**
- ✅ Mensaje: "Permiso de micrófono denegado. Por favor permite el acceso en la configuración de tu navegador."

#### PRUEBA 6B: Sin Conexión a Internet
**Pasos:**
1. Desactiva WiFi/datos móviles
2. Intenta usar el reconocimiento de voz

**Resultado Esperado:**
- ✅ Mensaje: "Error de red. Verifica tu conexión a internet."

---

### PRUEBA 7: UI/UX Responsive

#### Elementos a Verificar:

**Botón de Micrófono:**
- ✅ Tamaño mínimo de 64px × 64px (fácil de tocar)
- ✅ Cambia a rojo cuando está grabando
- ✅ Animación de pulso visible
- ✅ Feedback táctil al presionar (se reduce ligeramente)

**Indicadores de Estado:**
- ✅ "Escuchando..." visible en verde
- ✅ "Procesando..." visible en azul
- ✅ Errores visibles en rojo
- ✅ Texto legible en pantallas pequeñas

**Layout General:**
- ✅ No hay elementos superpuestos
- ✅ Todo el contenido es visible sin scroll horizontal
- ✅ Botones accesibles con el pulgar
- ✅ Texto escalable y legible

---

## 📊 MATRIZ DE COMPATIBILIDAD

### Dispositivos a Probar:

| Dispositivo | OS | Navegador | Estado | Notas |
|-------------|-----|-----------|--------|-------|
| **Android Phone** | Android 10+ | Chrome | ⬜ | Navegador recomendado |
| **Android Phone** | Android 10+ | Firefox | ⬜ | Compatible |
| **Android Tablet** | Android 10+ | Chrome | ⬜ | Navegador recomendado |
| **iPhone** | iOS 14+ | Safari | ⬜ | Navegador recomendado |
| **iPad** | iOS 14+ | Safari | ⬜ | Navegador recomendado |
| **iPad** | iOS 14+ | Chrome | ⬜ | Usa motor de Safari |

**Leyenda:**
- ⬜ Pendiente de prueba
- ✅ Funciona correctamente
- ⚠️ Funciona con limitaciones
- ❌ No funciona

---

## 🔍 DEBUGGING EN DISPOSITIVOS MÓVILES

### Android (Chrome)

#### Opción 1: Chrome DevTools Remoto
1. Conecta tu Android al PC con USB
2. Habilita "Depuración USB" en Opciones de Desarrollador
3. Abre Chrome en PC: `chrome://inspect`
4. Selecciona tu dispositivo
5. Inspecciona la página

#### Opción 2: Eruda (Console en Móvil)
```javascript
// Agregar temporalmente en index.html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
```

### iOS (Safari)

#### Safari Web Inspector:
1. En iPhone/iPad: Ajustes → Safari → Avanzado → Activar "Web Inspector"
2. Conecta el dispositivo al Mac
3. Abre Safari en Mac → Desarrollar → [Tu dispositivo] → [Tu página]

---

## 🐛 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: "No se detecta el micrófono"

**Posibles Causas:**
- ❌ No estás usando HTTPS
- ❌ Permisos denegados
- ❌ Micrófono bloqueado por otra app

**Soluciones:**
1. Verifica que la URL sea HTTPS
2. Revisa permisos en configuración del navegador
3. Cierra otras apps que usen el micrófono
4. Reinicia el navegador

---

### Problema 2: "Se queda escuchando indefinidamente"

**Posibles Causas:**
- ❌ Timeout no está funcionando
- ❌ Evento `onend` no se dispara

**Soluciones:**
1. Verifica los logs en consola
2. Asegúrate de que `interimResults = false`
3. Verifica que el timeout esté configurado
4. Recarga la página

---

### Problema 3: "No procesa el texto"

**Posibles Causas:**
- ❌ `isFinal` nunca llega en `true`
- ❌ `interimResults` está en `true`

**Soluciones:**
1. Verifica configuración: `interimResults: false`
2. Revisa logs: debe aparecer "RESULTADO FINAL DETECTADO"
3. Habla más claro y espera 1-2 segundos en silencio
4. Verifica conexión a internet

---

### Problema 4: "Error de red"

**Posibles Causas:**
- ❌ Sin conexión a internet
- ❌ Backend no responde
- ❌ CORS bloqueado

**Soluciones:**
1. Verifica conexión WiFi/datos
2. Verifica que el backend esté corriendo
3. Revisa configuración CORS en `server.js`
4. Verifica logs del servidor

---

## ✅ CHECKLIST DE VALIDACIÓN FINAL

### Funcionalidad Core:
- [ ] Permiso de micrófono se solicita correctamente
- [ ] Captura de voz funciona en móviles
- [ ] Texto se procesa correctamente
- [ ] Envío al backend funciona
- [ ] Respuesta se muestra correctamente
- [ ] Micrófono se cierra automáticamente
- [ ] Timeout de 10s funciona
- [ ] Múltiples consultas funcionan

### UI/UX:
- [ ] Botón de micrófono es táctil (≥48px)
- [ ] Feedback visual es claro
- [ ] Animaciones son visibles
- [ ] Estados se muestran correctamente
- [ ] Layout es responsive
- [ ] Texto es legible
- [ ] No hay elementos superpuestos
- [ ] Modal funciona en móvil

### Errores:
- [ ] Permiso denegado se maneja correctamente
- [ ] Error de red se muestra
- [ ] No-speech se maneja
- [ ] Timeout se muestra
- [ ] Mensajes son claros

### Compatibilidad:
- [ ] Funciona en Android Chrome
- [ ] Funciona en iOS Safari
- [ ] Funciona en tablets
- [ ] Funciona en diferentes tamaños de pantalla

---

## 📝 REPORTE DE PRUEBAS

### Plantilla de Reporte:

```markdown
## Prueba en [Dispositivo]

**Fecha:** [YYYY-MM-DD]
**Dispositivo:** [Marca y Modelo]
**OS:** [Android/iOS] [Versión]
**Navegador:** [Chrome/Safari] [Versión]
**URL de Prueba:** [https://...]

### Resultados:

#### Prueba 1: Permisos
- Estado: ✅/❌
- Notas: 

#### Prueba 2: Captura Básica
- Estado: ✅/❌
- Texto capturado: 
- Notas:

#### Prueba 3: Frases Largas
- Estado: ✅/❌
- Texto capturado:
- Notas:

#### Prueba 4: Timeout
- Estado: ✅/❌
- Notas:

#### Prueba 5: Múltiples Consultas
- Estado: ✅/❌
- Notas:

#### Prueba 6: Manejo de Errores
- Estado: ✅/❌
- Notas:

#### Prueba 7: UI/UX
- Estado: ✅/❌
- Notas:

### Problemas Encontrados:
1. 
2. 
3. 

### Conclusión:
- [ ] Aprobado
- [ ] Aprobado con observaciones
- [ ] Rechazado
```

---

## 🚀 PRÓXIMOS PASOS

Una vez completadas las pruebas:

1. ✅ Completa el checklist de validación
2. ✅ Llena el reporte de pruebas
3. ✅ Documenta cualquier problema encontrado
4. ✅ Si todo funciona, marca como "Listo para producción"
5. ✅ Si hay problemas, reporta con logs detallados

---

**Documento creado:** 2026-02-12  
**Versión:** 1.0  
**Propósito:** Validación de optimizaciones móviles
