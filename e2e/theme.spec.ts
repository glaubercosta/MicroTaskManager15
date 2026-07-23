import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Tema (GC-17)', () => {
  test('toggle persiste entre reloads e o SSR já entrega o tema (sem flash)', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')

    // Login (tema padrão: dark — sem data-theme explícito ou data-theme=dark)
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /Entrar/ }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', 'light')

    // Abrir menu da conta e mudar para claro → aplica na hora, sem navegação.
    await page.getByText(EMAIL).click()
    await page.getByRole('button', { name: 'Usar tema claro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Reload: persiste via cookie.
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')

    // Sem flash: o HTML do SERVIDOR já vem com data-theme="light"
    // (page.request compartilha os cookies do contexto).
    const ssrHtml = await (await page.request.get('/')).text()
    expect(ssrHtml).toContain('data-theme="light"')

    // Cleanup: voltar para dark (conta compartilhada entre specs).
    await page.getByText(EMAIL).click()
    await page.getByRole('button', { name: 'Usar tema escuro' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})
