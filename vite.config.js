import { defineConfig } from 'vite';

export default defineConfig({
  root: 'frontend',

  base: process.env.GITHUB_PAGES === 'true'
    ? '/toadstool-atelier/'
    : '/',

  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },

  server: {
    host: '127.0.0.1',
  },
});