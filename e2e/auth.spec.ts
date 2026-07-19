import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Auth (GC-b)', () => {
  test('sem sessão, / redireciona para /login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  })

  test('senha errada mostra mensagem de erro', async ({ page }) => {
    test.skip(!EMAIL, 'defina E2E_OWNER_EMAIL no .env.local')
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', 'senha-obviamente-errada')
    await page.getByRole('button', { name: /Entrar/ }).click()
    // getByText evita o route-announcer do Next (que também tem role="alert").
    await expect(page.getByText(/incorretos/i)).toBeVisible()
  })

  test('login válido leva à home; logout volta ao login', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /Entrar/ }).click()

    // Redireciona para a home, que mostra o e-mail do dono.
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByText(EMAIL)).toBeVisible()

    // Logout volta para /login.
    await page.getByRole('button', { name: 'Sair' }).click()
    await expect(page).toHaveURL(/\/login$/)
  })
})
