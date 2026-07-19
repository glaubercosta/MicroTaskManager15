import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // e2e/ é do Playwright; *.integration.test.ts roda por vitest.integration.config.mts.
    exclude: [...configDefaults.exclude, 'e2e/**', '**/*.integration.test.ts'],
  },
})
