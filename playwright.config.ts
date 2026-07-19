import { defineConfig, devices } from '@playwright/test'
import dotenv from 'dotenv'

// Carrega segredos/credenciais locais de dev (não versionados) para o E2E.
dotenv.config({ path: '.env.local' })

const PORT = process.env.E2E_PORT ?? '3100'
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Suite E2E compartilha a conta única do dono; roda serial para evitar que o logout de um arquivo derrube a sessão de outro.
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Sobe o próprio dev server numa porta dedicada (evita conflito com outros MTM na 3000/3001).
  // Precisa do Supabase local no ar e do usuário dono já criado (ver AGENTS.md).
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: `${BASE_URL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
