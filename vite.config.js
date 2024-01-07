// vite.config.js
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // No need to specify 'root' if it's the same as the project root
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      // 'index.html' should be at the project root
      input: path.resolve(__dirname, 'index.html'),
    },
  },
  server: {
    port: 3000, // Vite development server port
    cors: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // Your API server's address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
    },
  },
});