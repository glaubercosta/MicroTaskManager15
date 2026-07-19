import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Tarefas CRUD (GC-14)', () => {
  test('criar → editar título → concluir → apagar', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /Entrar/ }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)

    const unique = `E2E ${Date.now()}`

    // Criar
    await page.getByLabel('Título da tarefa').fill(unique)
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText(unique)).toBeVisible()

    // Editar título (alvo estável via aria-label com o título atual)
    const edited = `${unique} editada`
    await page.getByLabel(`Editar título de ${unique}`).fill(edited)
    await page.getByRole('button', { name: `Salvar título de ${unique}` }).click()
    await expect(page.getByText(edited)).toBeVisible()

    // Concluir → cai na seção "Concluídas"
    await page.getByLabel(`Status de ${edited}`, { exact: true }).selectOption('done')
    await page.getByRole('button', { name: `Aplicar status de ${edited}` }).click()
    await expect(page.getByRole('region', { name: 'Concluídas' }).getByText(edited)).toBeVisible()

    // Apagar
    await page.getByRole('button', { name: `Apagar ${edited}` }).click()
    await expect(page.getByText(edited)).toHaveCount(0)
  })
})
