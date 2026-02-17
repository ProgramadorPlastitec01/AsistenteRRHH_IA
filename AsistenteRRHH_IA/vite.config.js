import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // Cuando se compila para Tomcat, usa '/AsistenteRRHH/' como base. Sino, usa raíz.
  base: process.env.TOMCAT === '1' ? '/AsistenteRRHH/' : '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // Esto habilita el acceso desde la red local
    port: 5173,  // Puerto por defecto
    allowedHosts: [
      '.ngrok-free.dev',  // Permitir todos los subdominios de ngrok
      '.ngrok.io',        // Permitir subdominios antiguos de ngrok
      'localhost'         // Permitir localhost
    ],
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  }
})
