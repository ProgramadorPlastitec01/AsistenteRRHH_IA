# 🚀 APPSERVER DEPLOYMENT GUIDE (Apache + React + Node.js)

Este documento detalla el procedimiento estándar para desplegar la aplicación "Kiosco RRHH" en un servidor de producción Apache (Linux/Windows).

---

## 🏗️ Arquitectura de Producción

1.  **Frontend (React):** Archivos estáticos (`/dist`) servidos directamente por Apache.
2.  **Backend (Node.js):** Proceso ejecutado con PM2 en puerto `3000`.
3.  **Apache:** Actúa como:
    *   **Servidor Web:** Para el frontend.
    *   **Reverse Proxy:** Redirige peticiones `/api/*` al backend.
    *   **SSL Terminator:** Maneja HTTPS/Certificados.

---

## 🛠️ Paso 1: Preparación del Servidor

### Requisitos Previos
*   Node.js (LTS v20+)
*   Apache HTTP Server 2.4+
*   Módulos de Apache requeridos:
    *   `mod_rewrite` (Para SPA Routing)
    *   `mod_proxy` (Para Backend)
    *   `mod_proxy_http`
    *   `mod_headers` (Seguridad/Caché)
    *   `mod_ssl` (HTTPS)

---

## 📦 Paso 2: Despliegue del Frontend (React)

1.  **Generar Build:**
    En tu máquina de desarrollo, ejecuta:
    ```bash
    npm run build
    ```
    Esto creará la carpeta `dist/`.

2.  **Transferir Archivos:**
    Copia el contenido de `dist/` a la carpeta pública de tu servidor (ej: `/var/www/rrhh-kiosk/html`).

---

## ⚙️ Paso 3: Configuración de Apache (VirtualHost)

Crea o edita el archivo de configuración del sitio (ej: `/etc/apache2/sites-available/rrhh-kiosk.conf`).

```apache
<VirtualHost *:80>
    ServerName rrhh.tuempresa.com
    DocumentRoot /var/www/rrhh-kiosk/html

    # Logs de acceso y errores
    ErrorLog ${APACHE_LOG_DIR}/rrhh-error.log
    CustomLog ${APACHE_LOG_DIR}/rrhh-access.log combined

    # 🔄 CONFIGURACIÓN REVERSE PROXY (Backend Node.js)
    # Todo lo que empiece por /api se manda al puerto 3000 interno
    ProxyPreserveHost On
    ProxyPass /api http://localhost:3000/api
    ProxyPassReverse /api http://localhost:3000/api

    # 🛡️ CABECERAS DE SEGURIDAD
    Header always set X-Frame-Options "SAMEORIGIN"
    Header always set X-XSS-Protection "1; mode=block"
    Header always set X-Content-Type-Options "nosniff"

    # ⚡ COMPRESIÓN (GZIP)
    <IfModule mod_deflate.c>
        AddOutputFilterByType DEFLATE text/html text/plain text/xml text/css application/javascript application/json
    </IfModule>

    # 📂 CONFIGURACIÓN DE DIRECTORIO Y SPA ROUTING
    <Directory /var/www/rrhh-kiosk/html>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted

        # REGLAS REWRITE PARA REACT ROUTER (SPA)
        # Si el archivo/carpeta no existe, servir index.html
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>
```

---

## 🚀 Paso 4: Despliegue del Backend (Node.js con PM2)

No debemos correr `npm run server` directamente en producción. Usaremos **PM2**, un gestor de procesos profesional.

1.  **Instalar PM2 Globalmente:**
    ```bash
    npm install pm2 -g
    ```

2.  **Preparar Backend:**
    Copia los archivos del servidor (`server.js`, `package.json`, `.env`) a una carpeta fuera del alcance público (ej: `/var/www/rrhh-kiosk/api`).

3.  **Instalar Dependencias de Producción:**
    ```bash
    cd /var/www/rrhh-kiosk/api
    npm install --production
    ```

4.  **Iniciar con PM2:**
    ```bash
    pm2 start server.js --name "rrhh-api"
    # Guardar la lista de procesos para que revivan al reiniciar el servidor
    pm2 save
    pm2 startup
    ```

---

## 🔒 Paso 5: HTTPS (SSL con Let's Encrypt)

Para producción, HTTPS es **obligatorio** (el micrófono no funciona en HTTP inseguro fuera de localhost).

1.  **Instalar Certbot:**
    ```bash
    sudo apt install certbot python3-certbot-apache
    ```

2.  **Obtener Certificado:**
    ```bash
    sudo certbot --apache -d rrhh.tuempresa.com
    ```
    Sigue las instrucciones y selecciona "Redirect" para forzar HTTPS.

---

## ✅ Checklist Final de Producción

| Ítem | Verificación |
| :--- | :--- |
| **Microfono** | Funciona solo en HTTPS (o localhost). |
| **API** | `/api/health` devuelve `{"status":"ready"}`. |
| **Rutas** | Recargar `F5` en una subpágina no da error 404. |
| **Logs** | `pm2 logs rrhh-api` no muestra errores. |
| **Seguridad** | `.env` NO está accesible públicamente. |

---

## 🆘 Troubleshooting Común

*   **Error 502 Bad Gateway:** Apache no puede conectar con Node.js. Verifica que PM2 esté corriendo (`pm2 status`) y que el backend escuche en el puerto 3000.
*   **Error 404 en Recarga:** La regla `RewriteRule` del `.htaccess` o VirtualHost está mal configurada. React necesita que siempre se sirva `index.html` si la ruta no es un archivo real.
*   **Mixed Content Error:** Estás cargando recursos HTTP en una página HTTPS. Revisa tu código.

---
**Generado por el Equipo DevOps**
