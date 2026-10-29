import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

// The global renderer cleanup is manual under explicit vitest imports:
// without this every rendered component would leak into the next test.
afterEach(() => {
  cleanup()
})
