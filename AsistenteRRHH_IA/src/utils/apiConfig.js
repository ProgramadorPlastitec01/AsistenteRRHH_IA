
// Configuración de la URL de la API
// En desarrollo (Vite): Usa rutas relativas (proxy)
// En producción (Tomcat): Usa URL absoluta (localhost:3000 por defecto o config externa)

export const API_BASE_URL = import.meta.env.PROD
    ? (window.APP_CONFIG?.ApiUrl || 'http://localhost:3000')
    : '';
