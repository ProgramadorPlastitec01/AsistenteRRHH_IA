// Configuración de la URL de la API
// Siempre se usan rutas relativas ('') para que el fetch vaya al mismo origen.
// - En desarrollo: el proxy de Vite (vite.config.js) redirige /api → localhost:3000
// - En producción: el servidor Express sirve tanto la SPA como la API
//   desde el mismo origen, por lo que rutas relativas funcionan en todos los entornos.
// ⚠️ NO usar `hostname:3000` explícito: rompe el acceso desde otros dispositivos y proxies.

export const API_BASE_URL = '';
