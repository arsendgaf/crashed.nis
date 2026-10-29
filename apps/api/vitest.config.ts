import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Resolve the `@/*` alias from tsconfig.json for the test runner.
// The URL's href stays a plain string so `fileURLToPath` avoids the
// node-URL/Workers-URL type clash.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('src', import.meta.url).href),
    },
  },
})
