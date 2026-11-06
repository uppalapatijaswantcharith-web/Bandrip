import { defineConfig } from 'vite';

// Django serves pages; Vite bundles frontend/ into static/dist with a manifest.
export default defineConfig({
  base: '/static/dist/',
  publicDir: false,
  server: { port: 5173, strictPort: true, cors: true, origin: 'http://localhost:5173' },
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    manifest: true,
    target: 'es2020',
    assetsInlineLimit: 0,
    rollupOptions: {
      input: { main: 'frontend/main.js' },
      output: {
        manualChunks: { three: ['three'], gsap: ['gsap', 'gsap/ScrollTrigger'] },
      },
    },
  },
});
