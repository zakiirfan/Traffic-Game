import { defineConfig } from 'vite';

export default defineConfig({
  // Path relatif supaya dist/ bisa di-host di subfolder (itch.io, GitHub Pages).
  base: './',
  build: {
    chunkSizeWarningLimit: 1600,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
