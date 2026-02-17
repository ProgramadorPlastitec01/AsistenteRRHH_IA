# Guía de Implementación en Apache Tomcat

Implementar esta aplicación (Desarrollada en Node.js + React) en un servidor Apache Tomcat requiere entender que **Tomcat es un servidor diseñado para Java**, mientras que nuestra aplicación utiliza **Node.js**.

Por lo tanto, la implementación se realiza de forma **híbrida**:
1.  **Backend (Node.js)**: Se ejecuta como un Servicio de Windows independiente (junto a Tomcat, pero no *dentro* de él).
2.  **Frontend (React)**: Se compila a archivos estáticos (HTML/JS/CSS) y estos SÍ se alojan dentro de Tomcat.
3.  **Conexión**: Se configura un "Proxy Inverso" o se ajusta la URL de la API.

---

## 1. Preparación del Backend (Servicio de Windows)
Dado que Tomcat no puede ejecutar código Node.js (`server.js`), debemos configurar el backend para que corra como un servicio automático en Windows.

### A. Instalar `node-windows`
En la carpeta de tu proyecto, instala esta librería para crear servicios:
```bash
npm install -g node-windows
npm link node-windows
```

### B. Crear script de instalación del servicio
Crea un archivo llamado `install_service.js` en la raíz del proyecto:
```javascript
var Service = require('node-windows').Service;

// Crear un nuevo objeto de servicio
var svc = new Service({
  name: 'Asistente RRHH IA Backend',
  description: 'Backend Node.js para el Kiosco de RRHH que gestiona NotebookLM y Google TTS.',
  script: 'C:\\AI\\AsistenteRRHH_IA\\server.js', // Asegúrate de que esta ruta sea absoluta y correcta
  env: [
    { name: "PORT", value: "3000" },
    // Agrega aquí tus otras variables de entorno si no usas .env global
    // { name: "OPENAI_API_KEY", value: "..." }
  ]
});

// Escuchar evento de instalación
svc.on('install', function(){
  svc.start();
  console.log('Servicio instalado y arrancado.');
});

svc.install();
```

Ejecuta este script con Node (como Administrador) para registrar el servicio. Ahora el backend correrá siempre en el puerto 3000, incluso si reinicias el servidor.

---

## 2. Preparación del Frontend (React/Vite) para Tomcat

### A. Definir la ruta de despliegue
Si vas a alojar la app en la raíz de Tomcat (`webapps/ROOT`), no necesitas cambios.
Si vas a alojarla en una subcarpeta (ej: `webapps/AsistenteRRHH`), debes editar `vite.config.js`:

```javascript
export default defineConfig({
  base: '/AsistenteRRHH/', // <--- Agrega esto si la app no estará en la raíz
  plugins: [react(), tailwindcss()],
  // ...
})
```

### B. Construir la versión de producción
Ejecuta el comando para generar los archivos optimizados:
```bash
npm run build
```
Esto creará una carpeta `dist`. Esta carpeta contiene todo tu frontend listo para Tomcat.

---

## 3. Despliegue en Tomcat

1.  Ve a tu directorio de Tomcat: `C:\Program Files\Apache Software Foundation\Tomcat X.X\webapps`.
2.  Crea una carpeta nueva, por ejemplo: `AsistenteRRHH`.
3.  Copia **todo el contenido** de tu carpeta `dist` (generada en el paso 2B) dentro de `webapps/AsistenteRRHH`.

### Configurar `WEB-INF/web.xml` (Para React Router)
Las aplicaciones React (Single Page Applications) necesitan que Tomcat redirija todas las rutas no encontradas a `index.html`.
1.  Dentro de `webapps/AsistenteRRHH`, crea una carpeta `WEB-INF`.
2.  Dentro de `WEB-INF`, crea un archivo `web.xml`:

```xml
<web-app xmlns="http://xmlns.jcp.org/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://xmlns.jcp.org/xml/ns/javaee
         http://xmlns.jcp.org/xml/ns/javaee/web-app_3_1.xsd"
         version="3.1">

    <display-name>Asistente RRHH</display-name>

    <error-page>
        <error-code>404</error-code>
        <location>/index.html</location>
    </error-page>
</web-app>
```

---

## 4. Conectar Frontend y Backend (El paso crítico)

El frontend en Tomcat intentará llamar a `/api/query`. Tomcat buscará esa ruta en sus carpetas y no la encontrará (porque la API la tiene Node.js en el puerto 3000, no Tomcat en el 8080).

Tienes dos opciones:

### Opción A (Recomendada): UrlRewriteFilter en Tomcat
Instalar un filtro en Tomcat para que reenvíe las peticiones `/api` al puerto 3000.
1.  Descarga `urlrewritefilter-4.0.3.jar` y ponlo en `webapps/AsistenteRRHH/WEB-INF/lib`.
2.  Configura el filtro en `web.xml` y crea un `urlrewrite.xml` para mapear las reglas.

### Opción B (Más fácil): Apuntar a URL absoluta
Modificar el código del frontend para que sepa exactamente dónde está el backend.
1.  Antes de hacer `npm run build`, edita tu configuración de API en React o crea un `.env.production`:
    ```
    VITE_API_URL=http://tuservidor.dominio.com:3000
    ```
2.  Asegúrate de que tus llamadas `fetch` usen esta url base:
    ```javascript
    const API_BASE = import.meta.env.VITE_API_URL || '';
    fetch(`${API_BASE}/api/query`, ...);
    ```
3.  Asegúrate que el puerto 3000 esté abierto en el Firewall de Windows del servidor.

---

## Resumen
1. Backend Node -> **Servicio de Windows** (Puerto 3000).
2. Frontend React -> **Archivos estáticos en Tomcat** (`webapps/tu-app`).
3. Configuración -> Ajustar la URL de la API o usar un Proxy.
