import path from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.PORT ?? '3000');
const basePath = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      { find: '@/lib/utils', replacement: path.resolve(__dirname, 'src/lib/utils.ts') },
      { find: '@/lib',        replacement: path.resolve(__dirname, 'src/lib') },
      { find: '@/hooks',      replacement: path.resolve(__dirname, 'src/hooks') },
      { find: '@/components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@/pages',      replacement: path.resolve(__dirname, 'src/pages') },
      { find: '@',            replacement: path.resolve(__dirname, 'src') },
    ],
    dedupe: ['react', 'react-dom'],
  },
  root: __dirname,
  build: {
    outDir: path.resolve(__dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    port,
    strictPort: true,
    host: '0.0.0.0',
  },
  preview: {
    port,
    host: '0.0.0.0',
  },
});
