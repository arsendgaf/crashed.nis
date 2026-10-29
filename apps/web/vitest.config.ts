import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Test runner config for the web workspace: happy-dom for UI components,
// the `@/*` alias mirroring vite.config.ts, and jest-dom matchers via setup.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.ts'],
  },
})
