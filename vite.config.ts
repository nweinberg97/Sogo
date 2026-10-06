import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` keeps the build portable (GitHub Pages, any static host).
// Routing is hash-based, so deep links like /#/c/nike-hoops work without server rewrites.
export default defineConfig({
  base: './',
  plugins: [react()],
});
