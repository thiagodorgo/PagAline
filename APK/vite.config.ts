import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@capacitor/core': path.resolve(__dirname, './src/capacitor/core.ts'),
      '@capacitor/camera': path.resolve(__dirname, './src/capacitor/camera.ts'),
      '@capacitor/dialog': path.resolve(__dirname, './src/capacitor/dialog.ts'),
      '@capacitor/haptics': path.resolve(__dirname, './src/capacitor/haptics.ts'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
