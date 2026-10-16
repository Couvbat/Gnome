import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';

// Check if local SSL certificates exist for HTTPS
const certPath = path.resolve(__dirname, 'certs');
const hasLocalCerts = fs.existsSync(path.join(certPath, 'localhost.pem')) && 
                      fs.existsSync(path.join(certPath, 'localhost-key.pem'));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    vue()
  ],
  server: {
    port: 3000,
    // Enable HTTPS for Discord Activity (Discord requires https://localhost:*)
    https: hasLocalCerts ? {
      key: fs.readFileSync(path.join(certPath, 'localhost-key.pem')),
      cert: fs.readFileSync(path.join(certPath, 'localhost.pem')),
    } : undefined,
    // Allow embedding in Discord iframe - CSP handles the security
    headers: {
      // Allow Discord to embed this app in an iframe
      'Content-Security-Policy': "frame-ancestors 'self' https://discord.com https://*.discord.com https://*.discordsays.com",
      // Required for Discord SDK
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      // The client connects on /socket, as it does through the Discord proxy's
      // URL mapping; the backend serves Socket.io on its default /socket.io.
      // A regex key, because a plain '/socket' prefix would also match
      // '/socket.io'.
      '^/socket/': {
        target: 'http://localhost:3001',
        ws: true,
        rewrite: (path) => path.replace(/^\/socket\//, '/socket.io/'),
      },
    },
    // Allow external access (needed for Discord Activity local development)
    host: true,
  },
  // For Discord Activity builds
  build: {
    target: 'esnext',
    sourcemap: true,
  },
  // Environment variables prefix
  envPrefix: 'VITE_',
});
