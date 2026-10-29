import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

// Test runner config for the web workspace, split into projects:
// - unit: pure logic suites on the node environment.
// - browser: component suites executed by Vitest Browser Mode in a real
//   Chromium via the Playwright provider — no DOM simulation involved.
// Both share the `@/*` alias mirroring vite.config.ts.
const alias = {
  '@': fileURLToPath(new URL('.', import.meta.url)),
}

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['lib/**/*.test.ts'],
          setupFiles: ['./vitest.setup.ts'],
        },
        resolve: { alias },
      },
      {
        test: {
          name: 'browser',
          include: ['components/**/*.test-browser.tsx'],
          setupFiles: ['./vitest.setup.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
        resolve: { alias },
      },
    ],
  },
})
