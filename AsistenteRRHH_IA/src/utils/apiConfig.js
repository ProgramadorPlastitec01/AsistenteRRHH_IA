// Configuración de la URL de la API
// En desarrollo (Vite): Usa rutas relativas (proxy)
// En producción (Tomcat/Node): 
// - Si es localhost: Usa puerto 3000 explícito (para CORS desde puerto 8080)
// - Si es remoto (ngrok/mobile): Usa ruta relativa (para evitar errores mixtos y de puerto)

const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

export const API_BASE_URL = import.meta.env.PROD
    ? (isLocalhost ? 'http://localhost:3000' : '')
    : '';
