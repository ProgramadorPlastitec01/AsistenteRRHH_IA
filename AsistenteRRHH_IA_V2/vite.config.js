import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // Use relative base for production so it works in any subpath (e.g. /AsistenteRRHH/, /App/, etc.)
  // This is the standard for legacy Tomcat deployments
  base: mode === 'production' ? './' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Esto habilita el acceso desde la red local
    port: 5173,  // Puerto por defecto
    allowedHosts: [
      'localhost'         // Permitir localhost
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, res) => {
            // Backend not running or crashed — send a proper JSON error instead of hanging
            console.warn('[Vite Proxy] Backend no disponible:', err.code, err.message);
            if (res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                error: 'Servidor backend no disponible. Asegúrate de que node server.js esté corriendo.',
                code: err.code
              }));
            }
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            if (process.env.NODE_ENV !== 'production') {
              console.log('[Proxy →]', req.method, req.url);
            }
          });
        }
      }
    }
  }
}))
