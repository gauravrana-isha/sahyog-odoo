import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/isha_pr/static/dist/pr_app/',
  build: {
    outDir: '../../dist/pr_app',
    emptyOutDir: true,
    manifest: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Charting stack is heavy and only used by the (lazy) dashboard —
            // its own chunk loads with that route, not on first paint.
            if (id.includes('recharts') || id.includes('@mantine/charts')
                || id.includes('d3-') || id.includes('victory-vendor')) {
              return 'charts';
            }
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
