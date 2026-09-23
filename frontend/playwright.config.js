// E2E: the scripted demo in the Stage View (e2e/demo.spec.js). Starts the API (stand-ins) and Vite.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Module from 'node:module';
import { defineConfig, devices } from '@playwright/test';

// Specs live in ../e2e (outside this package): let them resolve @playwright/test from here.
process.env.NODE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'node_modules');
Module._initPaths();

export default defineConfig({
  testDir: '../e2e',
  timeout: 120000,
  reporter: 'list',
  use: { baseURL: 'http://localhost:5173', ...devices['Desktop Chrome'], viewport: { width: 1600, height: 900 } },
  webServer: [
    { command: 'python -m uvicorn backend.api.main:app --port 8000', cwd: '..', url: 'http://localhost:8000/health', reuseExistingServer: true, timeout: 60000 },
    { command: 'npx vite --port 5173', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 60000 },
  ],
});
