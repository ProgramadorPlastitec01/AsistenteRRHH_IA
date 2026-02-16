# 🧪 GUÍA RÁPIDA DE TESTING MANUAL

## ✅ ESTADO DE SERVIDORES

### Verificado:
- ✅ **Frontend:** Corriendo en http://localhost:5173
- ✅ **Backend:** Corriendo en http://localhost:3000

---

## 🚀 INSTRUCCIONES DE TESTING

### PRUEBA 1: Carga Inicial (2 minutos)

**Pasos:**
1. Abre tu navegador (Chrome o Edge recomendado)
2. Navega a: `http://localhost:5173`
3. Observa la pantalla de bienvenida

**✅ Verificar:**
- [ ] Aparece logo de Plastitec
- [ ] Badge "Versión Demo" visible
- [ ] Texto "Asistente RRHH"
- [ ] Mensaje "TOCAR PARA INICIAR"
- [ ] Animación de fondo (NexusCore)
- [ ] No hay errores en consola (F12)

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 2: Activación del Sistema (1 minuto)

**Pasos:**
1. Haz clic en cualquier parte de la pantalla de bienvenida
2. Observa la transición

**✅ Verificar:**
- [ ] Transición suave a pantalla principal
- [ ] Aparece header con logo pequeño
- [ ] Botón de micrófono 🎙️ visible (azul)
- [ ] Input de texto visible
- [ ] Botón de información ℹ️ visible
- [ ] Disclaimer visible en la parte inferior

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 3: Reconocimiento de Voz (3 minutos)

**Pasos:**
1. Haz clic en el botón de micrófono 🎙️
2. Acepta el permiso de micrófono cuando aparezca
3. Di claramente: **"Vacaciones"**
4. Espera 1-2 segundos en silencio

**✅ Verificar:**
- [ ] Aparece diálogo de permiso de micrófono
- [ ] Botón cambia a rojo con animación de pulso
- [ ] Aparece tarjeta verde: "Escuchando... Habla ahora"
- [ ] El texto "Vacaciones" aparece en la tarjeta
- [ ] Botón vuelve a azul
- [ ] Aparece tarjeta azul: "Procesando tu consulta..."
- [ ] Aparece tarjeta grande con la respuesta
- [ ] Se escucha la respuesta en voz alta
- [ ] Sistema vuelve a estado idle

**Logs en Consola (F12):**
```
Busca estos mensajes:
🎤 INICIANDO RECONOCIMIENTO DE VOZ
✅ Permiso de micrófono concedido
📝 EVENTO onresult DISPARADO
✅ RESULTADO FINAL DETECTADO
🚀 Enviando al backend: Vacaciones
```

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 4: Input Manual (2 minutos)

**Pasos:**
1. Haz clic en el campo de texto
2. Escribe: **"Horarios"**
3. Presiona Enter

**✅ Verificar:**
- [ ] Texto se escribe correctamente
- [ ] Al presionar Enter, se procesa la consulta
- [ ] Aparece "Procesando..."
- [ ] Muestra respuesta
- [ ] Lee respuesta en voz alta

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 5: Modal de Ejemplos (2 minutos)

**Pasos:**
1. Haz clic en el botón ℹ️ (información)
2. Observa el modal
3. Haz clic en "Seguro Médico"

**✅ Verificar:**
- [ ] Modal aparece con animación
- [ ] Muestra título "Ejemplos de Preguntas"
- [ ] Muestra 4 botones: Vacaciones, Seguro Médico, Horarios, Permisos
- [ ] Al hacer clic en "Seguro Médico":
  - Modal se cierra
  - Procesa la consulta
  - Muestra respuesta

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 6: Timeout de Seguridad (15 segundos)

**Pasos:**
1. Haz clic en el botón de micrófono 🎙️
2. **NO hables** (mantén silencio)
3. Espera 10 segundos

**✅ Verificar:**
- [ ] Botón está rojo y pulsando
- [ ] Tarjeta verde "Escuchando..." visible
- [ ] Después de ~10 segundos:
  - Aparece tarjeta roja con error
  - Mensaje: "No se detectó voz. Por favor intenta de nuevo."
  - Botón vuelve a azul
  - Micrófono se cierra automáticamente

**Logs en Consola:**
```
⏱️ TIMEOUT: No se detectó resultado final en 10 segundos
```

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 7: Manejo de Errores - Permiso Denegado (2 minutos)

**Pasos:**
1. Bloquea el permiso de micrófono en tu navegador:
   - Chrome: Configuración → Privacidad → Configuración de sitios → Micrófono
   - O haz clic en el candado en la barra de direcciones
2. Recarga la página (F5)
3. Haz clic en el botón de micrófono

**✅ Verificar:**
- [ ] Aparece tarjeta roja con error
- [ ] Mensaje claro: "Permiso de micrófono denegado..."
- [ ] Sistema vuelve a estado idle
- [ ] No se queda "colgado"

**Resultado:** ⬜ PASS / ⬜ FAIL

**Nota:** Después de esta prueba, vuelve a permitir el micrófono para continuar.

---

### PRUEBA 8: Múltiples Consultas Consecutivas (3 minutos)

**Pasos:**
1. Realiza consulta por voz: "Vacaciones"
2. Espera a que termine completamente
3. Realiza consulta por voz: "Horarios"
4. Espera a que termine
5. Realiza consulta por texto: "Permisos"

**✅ Verificar:**
- [ ] Cada consulta se procesa correctamente
- [ ] No hay interferencias entre consultas
- [ ] El micrófono se cierra y abre correctamente
- [ ] Las respuestas son coherentes
- [ ] No hay errores en consola

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 9: Responsive Design (3 minutos)

**Pasos:**
1. Abre DevTools (F12)
2. Activa el modo responsive (Ctrl+Shift+M)
3. Prueba estos tamaños:
   - Móvil: 375px × 667px (iPhone SE)
   - Tablet: 768px × 1024px (iPad)
   - Desktop: 1920px × 1080px

**✅ Verificar en cada tamaño:**
- [ ] Todo el contenido es visible
- [ ] No hay scroll horizontal
- [ ] Botones son accesibles
- [ ] Texto es legible
- [ ] Layout se adapta correctamente
- [ ] Botón de micrófono tiene tamaño adecuado:
  - Móvil: ~64px
  - Desktop: ~80px

**Resultado:** ⬜ PASS / ⬜ FAIL

---

### PRUEBA 10: Inactividad (35 segundos)

**Pasos:**
1. Activa el sistema (haz clic en pantalla de bienvenida)
2. **NO interactúes** con la aplicación
3. Espera 30 segundos

**✅ Verificar:**
- [ ] Después de ~30 segundos:
  - Sistema vuelve a pantalla de bienvenida
  - Estado se resetea
  - Mensaje "TOCAR PARA INICIAR" visible

**Logs en Consola:**
```
Inactivity detected. Resetting to standby mode.
```

**Resultado:** ⬜ PASS / ⬜ FAIL

---

## 📊 RESUMEN DE RESULTADOS

### Pruebas Funcionales
- [ ] Prueba 1: Carga Inicial
- [ ] Prueba 2: Activación del Sistema
- [ ] Prueba 3: Reconocimiento de Voz
- [ ] Prueba 4: Input Manual
- [ ] Prueba 5: Modal de Ejemplos
- [ ] Prueba 6: Timeout de Seguridad
- [ ] Prueba 7: Manejo de Errores
- [ ] Prueba 8: Múltiples Consultas
- [ ] Prueba 9: Responsive Design
- [ ] Prueba 10: Inactividad

### Resultado General
- **Total de Pruebas:** 10
- **Pasadas:** ___
- **Fallidas:** ___
- **Porcentaje de Éxito:** ___%

---

## 🐛 PROBLEMAS ENCONTRADOS

### Problema 1:
- **Prueba:** ___
- **Descripción:** ___
- **Severidad:** ⬜ Crítico / ⬜ Alto / ⬜ Medio / ⬜ Bajo
- **Logs:** ___

### Problema 2:
- **Prueba:** ___
- **Descripción:** ___
- **Severidad:** ⬜ Crítico / ⬜ Alto / ⬜ Medio / ⬜ Bajo
- **Logs:** ___

---

## 💡 CONSEJOS PARA TESTING

### Antes de Empezar:
1. ✅ Verifica que ambos servidores estén corriendo
2. ✅ Usa Chrome o Edge (mejor compatibilidad)
3. ✅ Abre DevTools (F12) para ver logs
4. ✅ Asegúrate de tener micrófono funcional

### Durante las Pruebas:
1. 📝 Documenta cualquier comportamiento inesperado
2. 📸 Toma screenshots de errores
3. 📋 Copia los logs de consola si hay problemas
4. ⏱️ Respeta los tiempos de espera (timeouts)

### Si Algo Falla:
1. 🔄 Recarga la página (F5)
2. 🧹 Limpia caché (Ctrl+Shift+Delete)
3. 🔍 Revisa logs en consola
4. 📖 Consulta REPORTE_TESTING_COMPLETO.md

---

## 🚀 PRÓXIMOS PASOS

### Si Todas las Pruebas Pasan:
1. ✅ Marcar como "Listo para pruebas móviles"
2. ✅ Configurar HTTPS (ver CONFIGURACION_HTTPS_MOVIL.md)
3. ✅ Probar en dispositivos móviles reales
4. ✅ Seguir GUIA_PRUEBAS_MOVIL.md

### Si Hay Problemas:
1. ❌ Documentar problemas encontrados
2. 🔍 Revisar logs de consola
3. 📖 Consultar documentación técnica
4. 🛠️ Corregir y volver a probar

---

## 📞 SOPORTE

### Si necesitas ayuda:
1. Revisa **REPORTE_TESTING_COMPLETO.md** - Análisis completo
2. Revisa **OPTIMIZACION_MOVIL_COMPLETA.md** - Detalles técnicos
3. Revisa **GUIA_PRUEBAS_MOVIL.md** - Troubleshooting

### Logs Importantes:
Busca estos emojis en la consola:
- 🎤 - Inicio de reconocimiento
- ✅ - Operación exitosa
- ❌ - Error
- ⏱️ - Timeout
- 🚀 - Envío al backend

---

**Tiempo Total Estimado:** 25-30 minutos  
**Dificultad:** ⭐⭐ Intermedio  
**Prerequisitos:** Navegador moderno, micrófono funcional

**¡Buena suerte con las pruebas! 🎯**
