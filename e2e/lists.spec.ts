import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Listas (GC-15)', () => {
  test('criar lista → tarefa na lista aparece nela e some em outra aba', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')

    // Login
    await page.goto('/login')
    await page.fill('input[name="email"]', EMAIL)
    await page.fill('input[name="password"]', PASSWORD)
    await page.getByRole('button', { name: /Entrar/ }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)

    const stamp = Date.now()
    const listName = `Lista E2E ${stamp}`
    const taskInList = `Tarefa na lista ${stamp}`

    // Criar lista
    await page.getByLabel('Nome da nova lista').fill(listName)
    await page.getByRole('button', { name: 'Criar' }).click()
    const listTab = page.getByRole('link', { name: listName })
    await expect(listTab).toBeVisible()

    // Ir para a aba da lista e criar uma tarefa nela
    await listTab.click()
    await expect(page).toHaveURL(/\?list=/)
    await page.getByLabel('Título da tarefa').fill(taskInList)
    await page.getByRole('button', { name: 'Adicionar' }).click()
    await expect(page.getByText(taskInList)).toBeVisible()
    // Espera a action de criação assentar (botão sai de "Adicionando…"): clicar num Link
    // durante o commit da action deixava o router mudo e o POST do apagar nunca disparava.
    await expect(page.getByRole('button', { name: 'Adicionar' })).toBeEnabled()

    // Aba "Todas" também mostra a tarefa (tem lista, mas "Todas" mostra tudo)
    await page.getByRole('link', { name: 'Todas' }).click()
    await expect(page).toHaveURL(/localhost:\d+\/$/)
    await expect(page.getByText(taskInList)).toBeVisible()

    // Voltar à lista e apagar a tarefa (limpeza; a lista permanece — ver nota)
    await listTab.click()
    await expect(page).toHaveURL(/\?list=/)
    await page.getByRole('button', { name: `Apagar ${taskInList}` }).click()
    await expect(page.getByText(taskInList)).toHaveCount(0)
  })
})
