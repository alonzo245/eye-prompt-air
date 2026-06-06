import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    host: true, // listen on 0.0.0.0 so phone on same network can reach it
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
