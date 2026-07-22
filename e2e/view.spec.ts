import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Visualização e organização (GC-16)', () => {
  test('toggle "Ocultar concluídas" some com a seção de concluídas', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /Entrar/ }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)

    const unique = `E2E view ${Date.now()}`

    // Criar e concluir uma tarefa → ela vai para a seção "Concluídas".
    await page.getByLabel('Título da tarefa').fill(unique)
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText(unique)).toBeVisible()

    await page.getByLabel(`Status de ${unique}`, { exact: true }).selectOption('done')
    await page.getByRole('button', { name: `Aplicar status de ${unique}` }).click()

    const concluidas = page.getByRole('region', { name: 'Concluídas' })
    await expect(concluidas.getByText(unique)).toBeVisible()

    // Ocultar → a seção de concluídas some.
    await page.getByRole('link', { name: 'Ocultar concluídas' }).click()
    await expect(page.getByRole('region', { name: 'Concluídas' })).toHaveCount(0)

    // Mostrar de novo → a tarefa concluída reaparece.
    await page.getByRole('link', { name: 'Mostrar concluídas' }).click()
    await expect(
      page.getByRole('region', { name: 'Concluídas' }).getByText(unique),
    ).toBeVisible()

    // Limpar: apagar a tarefa criada (conta única compartilhada entre specs).
    await page.getByRole('button', { name: `Apagar ${unique}` }).click()
    await expect(page.getByText(unique)).toHaveCount(0)
  })
})
