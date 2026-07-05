import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/sahyog/static/dist/volunteer_app/',
  build: {
    outDir: '../../dist/volunteer_app',
    emptyOutDir: true,
    // Emit .vite/manifest.json so the Odoo SPA controller can inject the
    // current content-hashed asset URLs (cache-busting — see controllers/spa.py).
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        // Split heavy, rarely-changing vendor code into cacheable chunks so an
        // app-code deploy doesn't force users to re-download Mantine/icons.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@mantine')) return 'mantine';
            if (id.includes('@tabler')) return 'icons';
            return 'vendor';
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
