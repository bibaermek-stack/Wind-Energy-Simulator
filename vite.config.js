import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5178, open: false },
  build: {
    // three + drei + recharts are all large; splitting them keeps the app
    // chunk small enough to iterate on without re-shipping the vendors.
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          charts: ['recharts'],
        },
      },
    },
    chunkSizeWarningLimit: 1400,
  },
});
