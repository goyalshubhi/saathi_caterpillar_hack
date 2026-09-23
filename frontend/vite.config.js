import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // contracts/examples (one level up) are bundled as the offline fixture data.
  server: { port: 5173, strictPort: true, fs: { allow: ['..'] } },
  preview: { port: 5173, strictPort: true },
  test: {
    include: ['src/**/*.test.{js,jsx}'],
    setupFiles: ['src/test/setup.js'],
  },
});
