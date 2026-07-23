# GC-e · Visualização e organização — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Linear:** GC-16 (GC-e). Depende de GC-c (tarefas, done) e GC-d (listas, done).

**Goal:** Fechar a RF-4/RF-5 do PRD com lógica de domínio pura testada (classificação de vencimento, filtro "ocultar concluídas", contagem de abertas) e componentes de apresentação acessíveis (pontinho de prioridade, badge de vencimento, toggle), reusando `sortTasks`/`partitionByStatus` já existentes.

**Architecture:** Toda regra de negócio vive em `src/domain/task.ts` como funções puras (recebem `today` por parâmetro — sem relógio interno, testáveis por igualdade). A UI (`src/app/*.tsx`) consome essas funções. O estado do toggle "ocultar concluídas" fica na URL (`?done=hidden`), server-rendered e sobrevive a reload, coerente com o padrão de abas por `?list=` da GC-d (`next/link`, sem client component). Cores semânticas ficam inline nesta story; a consolidação em tokens é da GC-f.

**Tech Stack:** Next.js 16 (App Router, Server Components), TypeScript, Vitest 4 + @testing-library/react (jsdom), Playwright (E2E fora do gate `ci`).

---

## File Structure

- **Modify** `src/domain/task.ts` — adiciona `DueClass`, `DUE_CLASS_LABELS`, `classifyDueDate`, `TaskView`, `buildTaskView`, `HIDE_DONE_PARAM`, `parseHideDone`.
- **Modify** `src/domain/task.test.ts` — testes das funções puras novas.
- **Create** `src/app/priority-dot.tsx` — componente do pontinho de prioridade (extraído do inline de `page.tsx`).
- **Create** `src/app/priority-dot.test.tsx` — teste de componente.
- **Create** `src/app/due-badge.tsx` — badge de vencimento (hoje/atrasada/futura).
- **Create** `src/app/due-badge.test.tsx` — teste de componente.
- **Create** `src/app/hide-completed-toggle.tsx` — link `next/link` que alterna `?done=hidden` preservando `?list=`.
- **Modify** `src/app/page.tsx` — lê `done`, chama `buildTaskView`, renderiza toggle + `PriorityDot` + `DueBadge`, passa `today`.
- **Create** `e2e/view.spec.ts` — E2E do toggle "ocultar concluídas".

**Convenções (design §5):** valores internos em inglês, rótulos pt-BR; RLS/segurança não muda nesta story (sem tabela nova); TDD; commits frequentes com `GC-16` na mensagem.

---

## Task 1: Classificação de vencimento (RF-5)

**Files:**
- Modify: `src/domain/task.ts` (após `normalizeDueDate`, antes de `SortableTask`)
- Test: `src/domain/task.test.ts`

- [ ] **Step 1: Write the failing test**

Adicionar ao final de `src/domain/task.test.ts`. Primeiro, incluir os novos símbolos no `import` do topo (`classifyDueDate`, `DUE_CLASS_LABELS`, junto dos já importados):

```ts
describe('classifyDueDate (RF-5.1)', () => {
  const TODAY = '2026-07-21'

  it('sem prazo → null (sem indicação)', () => {
    expect(classifyDueDate(null, TODAY)).toBeNull()
  })

  it('prazo anterior a hoje → overdue', () => {
    expect(classifyDueDate('2026-07-20', TODAY)).toBe('overdue')
  })

  it('prazo igual a hoje → today', () => {
    expect(classifyDueDate('2026-07-21', TODAY)).toBe('today')
  })

  it('prazo posterior a hoje → future', () => {
    expect(classifyDueDate('2026-07-22', TODAY)).toBe('future')
  })

  it('compara por data de calendário, não por string ingênua entre meses', () => {
    // '2026-08-01' > '2026-07-31' cronologicamente e lexicograficamente
    expect(classifyDueDate('2026-08-01', '2026-07-31')).toBe('future')
    expect(classifyDueDate('2026-07-31', '2026-08-01')).toBe('overdue')
  })

  it('rótulos pt-BR cobrem todas as classes', () => {
    expect(DUE_CLASS_LABELS.overdue).toBe('Atrasada')
    expect(DUE_CLASS_LABELS.today).toBe('Hoje')
    expect(DUE_CLASS_LABELS.future).toBe('Futura')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: FAIL — `classifyDueDate is not a function` / `DUE_CLASS_LABELS` undefined.

- [ ] **Step 3: Write minimal implementation**

Em `src/domain/task.ts`, logo após `normalizeDueDate`:

```ts
export type DueClass = 'overdue' | 'today' | 'future'

/** Rótulos pt-BR das classes de vencimento (RNF-4). */
export const DUE_CLASS_LABELS: Record<DueClass, string> = {
  overdue: 'Atrasada',
  today: 'Hoje',
  future: 'Futura',
}

/**
 * RF-5.1: classifica um prazo relativo a `today` (ambos AAAA-MM-DD).
 * `today` é injetado (função pura, sem relógio interno). Sem prazo → null.
 * A comparação lexicográfica de datas ISO coincide com a ordem cronológica.
 */
export function classifyDueDate(dueDate: string | null, today: string): DueClass | null {
  if (dueDate === null) return null
  if (dueDate < today) return 'overdue'
  if (dueDate === today) return 'today'
  return 'future'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: PASS (todos os `describe`, inclusive os antigos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-16 classificacao de vencimento (RF-5) como funcao pura"
```

---

## Task 2: View model — buildTaskView (RF-4.3, RF-4.4, RF-4.5)

**Files:**
- Modify: `src/domain/task.ts` (após `partitionByStatus`)
- Test: `src/domain/task.test.ts`

- [ ] **Step 1: Write the failing test**

Adicionar `buildTaskView` ao import do topo. Novo bloco ao final de `src/domain/task.test.ts` (o helper `t` já existe no arquivo):

```ts
describe('buildTaskView (RF-4.3/4.4/4.5)', () => {
  const sample = () => [
    t('low', null, 'new'),
    t('high', '2026-08-01', 'done'),
    t('medium', null, 'working'),
  ]

  it('ordena e particiona: abertas ordenadas por prioridade, concluídas ao final', () => {
    const view = buildTaskView(sample(), { hideCompleted: false })
    expect(view.open.map((x) => x.priority)).toEqual(['medium', 'low'])
    expect(view.closed.map((x) => x.status)).toEqual(['done'])
  })

  it('openCount conta só as abertas (RF-4.5)', () => {
    const view = buildTaskView(sample(), { hideCompleted: false })
    expect(view.openCount).toBe(2)
  })

  it('hideCompleted=true zera a seção de concluídas mas mantém a contagem de abertas (RF-4.4)', () => {
    const view = buildTaskView(sample(), { hideCompleted: true })
    expect(view.closed).toEqual([])
    expect(view.open).toHaveLength(2)
    expect(view.openCount).toBe(2)
  })

  it('lista vazia → tudo vazio e contagem zero', () => {
    const view = buildTaskView([], { hideCompleted: false })
    expect(view).toEqual({ open: [], closed: [], openCount: 0 })
  })

  it('não muta o array de entrada', () => {
    const input = sample()
    const copy = [...input]
    buildTaskView(input, { hideCompleted: true })
    expect(input).toEqual(copy)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: FAIL — `buildTaskView is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `src/domain/task.ts`, após `partitionByStatus`:

```ts
export interface TaskView<T> {
  open: T[]
  /** Concluídas/canceladas; vazio quando `hideCompleted` (RF-4.4). */
  closed: T[]
  /** Contagem de abertas para o cabeçalho (RF-4.5). */
  openCount: number
}

/**
 * Monta a visão da lista: ordena (RF-4.1), agrupa por status (RF-4.3), conta
 * abertas (RF-4.5) e aplica o toggle "ocultar concluídas" (RF-4.4). Função pura.
 */
export function buildTaskView<T extends SortableTask & { status: Status }>(
  tasks: readonly T[],
  opts: { hideCompleted: boolean },
): TaskView<T> {
  const { open, closed } = partitionByStatus(sortTasks(tasks))
  return {
    open,
    closed: opts.hideCompleted ? [] : closed,
    openCount: open.length,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-16 buildTaskView: ordena/agrupa/conta/oculta concluidas (RF-4)"
```

---

## Task 3: Parser do param do toggle (RF-4.4)

**Files:**
- Modify: `src/domain/task.ts` (após `buildTaskView`)
- Test: `src/domain/task.test.ts`

Regra: manter o parsing do query param fora dos componentes, puro e testável (o componente `next/link` não entra em teste unitário).

- [ ] **Step 1: Write the failing test**

Adicionar `HIDE_DONE_PARAM`, `parseHideDone` ao import. Novo bloco:

```ts
describe('parseHideDone (RF-4.4)', () => {
  it('o nome do param é estável', () => {
    expect(HIDE_DONE_PARAM).toBe('done')
  })

  it('"hidden" → true', () => {
    expect(parseHideDone('hidden')).toBe(true)
  })

  it('ausente/undefined ou qualquer outro valor → false (mostrar concluídas por padrão)', () => {
    expect(parseHideDone(undefined)).toBe(false)
    expect(parseHideDone('')).toBe(false)
    expect(parseHideDone('shown')).toBe(false)
  })

  it('aceita array de query params usando o primeiro valor', () => {
    expect(parseHideDone(['hidden', 'shown'])).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: FAIL — `parseHideDone is not a function`.

- [ ] **Step 3: Write minimal implementation**

Em `src/domain/task.ts`, após `buildTaskView`:

```ts
/** Query param do toggle "ocultar concluídas" (RF-4.4). */
export const HIDE_DONE_PARAM = 'done'

/** Interpreta o valor do query param `?done=`. Só `"hidden"` oculta; padrão mostra. */
export function parseHideDone(value: string | string[] | undefined): boolean {
  const first = Array.isArray(value) ? value[0] : value
  return first === 'hidden'
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/task.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-16 parseHideDone: estado do toggle via query param"
```

---

## Task 4: Componente PriorityDot (RF-4.2, aria-label textual)

**Files:**
- Create: `src/app/priority-dot.tsx`
- Test: `src/app/priority-dot.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PriorityDot } from './priority-dot'

describe('PriorityDot (RF-4.2)', () => {
  it('expõe a prioridade por texto no aria-label (não depende de cor)', () => {
    render(<PriorityDot priority="high" />)
    // Acessível por nome textual em pt-BR, independente da cor do pontinho.
    expect(screen.getByLabelText('Prioridade: Alta')).toBeInTheDocument()
  })

  it('traduz cada prioridade para o rótulo pt-BR', () => {
    const { rerender } = render(<PriorityDot priority="low" />)
    expect(screen.getByLabelText('Prioridade: Baixa')).toBeInTheDocument()
    rerender(<PriorityDot priority="medium" />)
    expect(screen.getByLabelText('Prioridade: Média')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/priority-dot.test.tsx`
Expected: FAIL — não encontra o módulo `./priority-dot`.

- [ ] **Step 3: Write minimal implementation**

`src/app/priority-dot.tsx`:

```tsx
import { PRIORITY_LABELS, type Priority } from '@/domain/task'

/** Pontinho de prioridade com rótulo textual (RF-4.2): acessível sem depender de cor. */
export function PriorityDot({ priority }: { priority: Priority }) {
  const label = PRIORITY_LABELS[priority]
  return (
    <span aria-label={`Prioridade: ${label}`} title={label}>
      ●
    </span>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/app/priority-dot.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/priority-dot.tsx src/app/priority-dot.test.tsx
git commit -m "GC-16 PriorityDot: pontinho com aria-label textual (RF-4.2)"
```

---

## Task 5: Componente DueBadge (RF-4.2, RF-5.2)

**Files:**
- Create: `src/app/due-badge.tsx`
- Test: `src/app/due-badge.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DueBadge } from './due-badge'

const TODAY = '2026-07-21'

describe('DueBadge (RF-4.2/RF-5.2)', () => {
  it('sem prazo → não renderiza nada', () => {
    const { container } = render(<DueBadge dueDate={null} today={TODAY} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('prazo de hoje → destaca "Hoje" por texto (não só cor)', () => {
    render(<DueBadge dueDate="2026-07-21" today={TODAY} />)
    expect(screen.getByText(/Hoje/)).toBeInTheDocument()
  })

  it('prazo passado → destaca "Atrasada" por texto', () => {
    render(<DueBadge dueDate="2026-07-20" today={TODAY} />)
    expect(screen.getByText(/Atrasada/)).toBeInTheDocument()
  })

  it('prazo futuro → mostra a data sem rótulo de urgência', () => {
    render(<DueBadge dueDate="2026-07-30" today={TODAY} />)
    expect(screen.getByText(/2026-07-30/)).toBeInTheDocument()
    expect(screen.queryByText(/Hoje|Atrasada/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/due-badge.test.tsx`
Expected: FAIL — não encontra o módulo `./due-badge`.

- [ ] **Step 3: Write minimal implementation**

`src/app/due-badge.tsx`:

```tsx
import { classifyDueDate, DUE_CLASS_LABELS } from '@/domain/task'

/**
 * Badge de vencimento (RF-4.2/RF-5.2). Hoje/Atrasada recebem cor semântica
 * dessaturada E rótulo textual (acessível sem cor); futuras em texto secundário.
 * Sem prazo → nada.
 */
export function DueBadge({ dueDate, today }: { dueDate: string | null; today: string }) {
  const cls = classifyDueDate(dueDate, today)
  if (cls === null) return null

  const color =
    cls === 'overdue' ? '#e06c75' : cls === 'today' ? '#d19a66' : '#8a8a8a'
  const prefix = cls === 'future' ? '' : `${DUE_CLASS_LABELS[cls]} · `

  return (
    <small style={{ color }}>
      ({prefix}
      {dueDate})
    </small>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/app/due-badge.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/due-badge.tsx src/app/due-badge.test.tsx
git commit -m "GC-16 DueBadge: vencimento hoje/atrasada/futura (RF-5.2)"
```

---

## Task 6: Toggle "Ocultar concluídas" (RF-4.4)

**Files:**
- Create: `src/app/hide-completed-toggle.tsx`

Sem teste unitário (usa `next/link`, coberto por E2E na Task 8). É uma casca fina sobre `HIDE_DONE_PARAM`/`parseHideDone` já testados (Task 3).

- [ ] **Step 1: Write the component**

`src/app/hide-completed-toggle.tsx`:

```tsx
import Link from 'next/link'
import { HIDE_DONE_PARAM } from '@/domain/task'

/**
 * Alterna `?done=hidden` preservando `?list=` (RF-4.4). Estado na URL: server-rendered
 * e sobrevive a reload, coerente com as abas por `?list=` (GC-d).
 */
export function HideCompletedToggle({
  hideCompleted,
  activeListId,
}: {
  hideCompleted: boolean
  activeListId: string | null
}) {
  // `resolveActiveListId` já devolve `null` (aba "Todas") ou um id real — nunca o
  // sentinela "all". Só propagamos `?list=` quando há um id real.
  const query: Record<string, string> = {}
  if (activeListId !== null) query.list = activeListId
  if (!hideCompleted) query[HIDE_DONE_PARAM] = 'hidden'
  // quando já está oculto, o link volta a mostrar (sem o param `done`).

  return (
    <Link href={{ pathname: '/', query }} aria-pressed={hideCompleted}>
      {hideCompleted ? 'Mostrar concluídas' : 'Ocultar concluídas'}
    </Link>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/hide-completed-toggle.tsx
git commit -m "GC-16 HideCompletedToggle: toggle via ?done=hidden preservando ?list="
```

---

## Task 7: Integrar tudo em page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Ler o arquivo atual e confirmar os pontos de mudança**

Confirmar imports e o bloco de montagem (`sortTasks(filterTasksByList(...))` → `buildTaskView`), e o `TaskRow` inline (pontinho + prazo → `PriorityDot` + `DueBadge`).

- [ ] **Step 2: Aplicar as mudanças**

Substituir os imports de domínio e o corpo, mantendo os forms de ação intactos:

Imports (topo):
```tsx
import {
  buildTaskView,
  parseHideDone,
  HIDE_DONE_PARAM,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Task,
} from '@/domain/task'
import {
  filterTasksByList,
  resolveActiveListId,
  ALL_LISTS,
  type List,
} from '@/domain/list'
import { TaskQuickAdd } from './task-quick-add'
import { ListTabs } from './list-tabs'
import { PriorityDot } from './priority-dot'
import { DueBadge } from './due-badge'
import { HideCompletedToggle } from './hide-completed-toggle'
```

Assinatura de `searchParams` (aceitar `done` além de `list`):
```tsx
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ list?: string | string[]; done?: string | string[] }>
}) {
```

Montagem da visão (substitui o bloco `const { list: rawParam } ... partitionByStatus(sortTasks(tasks))`):
```tsx
  const { list: rawParam, [HIDE_DONE_PARAM]: rawDone } = await searchParams
  const listParam = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const activeListId = resolveActiveListId(lists, listParam)
  const hideCompleted = parseHideDone(rawDone)

  const { data } = await supabase
    .from('tasks')
    .select('id,title,priority,due_date,status,list_id,created_at')
  const allTasks = (data ?? []) as Task[]
  const tasks = filterTasksByList(allTasks, activeListId)
  const { open, closed, openCount } = buildTaskView(tasks, { hideCompleted })

  const today = new Date().toISOString().slice(0, 10)
```

Cabeçalho de "Abertas" usa `openCount` e o toggle aparece acima das seções:
```tsx
      <HideCompletedToggle hideCompleted={hideCompleted} activeListId={activeListId} />

      <section aria-label="Tarefas abertas">
        <h2>Abertas ({openCount})</h2>
        <ul>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} today={today} />
          ))}
        </ul>
      </section>

      {closed.length > 0 ? (
        <section aria-label="Concluídas">
          <h2>Concluídas</h2>
          <ul>
            {closed.map((task) => (
              <TaskRow key={task.id} task={task} today={today} />
            ))}
          </ul>
        </section>
      ) : null}
```

`TaskRow` recebe `today` e usa os componentes novos (substitui o `<span aria-label={...}>●</span>` e o `<small>({task.due_date})</small>`):
```tsx
function TaskRow({ task, today }: { task: Task; today: string }) {
  const done = task.status === 'done' || task.status === 'canceled'

  return (
    <li style={{ marginBottom: 12 }}>
      <PriorityDot priority={task.priority} />{' '}
      <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
        {task.title}
      </span>{' '}
      <DueBadge dueDate={task.due_date} today={today} />

      {/* ...os <form> de ação permanecem exatamente como estão... */}
```

Manter todo o bloco `<div>` com os forms (`updateTaskTitle`, `setTaskPriority`, `setTaskStatus`, `setTaskDueDate`, `deleteTask`) sem alteração.

- [ ] **Step 3: Typecheck + lint + testes**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: tudo verde. (Corrigir `ALL_LISTS` não usado no import se o lint reclamar — só importar o que for usado.)

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "GC-16 page: consome buildTaskView, PriorityDot, DueBadge e toggle"
```

---

## Task 8: E2E do toggle "ocultar concluídas"

**Files:**
- Create: `e2e/view.spec.ts`

Fora do gate `ci` (`npm run e2e`, precisa de Supabase local + `.env.local`). Conta única → `workers:1` já configurado; usar rótulos com `{ exact: true }` (lição GC-14, ver memória).

- [ ] **Step 1: Write the E2E test**

`e2e/view.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const EMAIL = process.env.E2E_OWNER_EMAIL ?? ''
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? ''

test.describe('Visualização e organização (GC-16)', () => {
  test('toggle "Ocultar concluídas" some com a seção de concluídas', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'defina E2E_OWNER_EMAIL/E2E_OWNER_PASSWORD no .env.local')

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
```

- [ ] **Step 2: Run E2E (se o ambiente local estiver de pé)**

Run: `npm run e2e -- e2e/view.spec.ts`
Expected: PASS (ou SKIP se `.env.local` não tiver credenciais — aceitável; o gate real é `ci`, que não roda E2E).

- [ ] **Step 3: Commit**

```bash
git add e2e/view.spec.ts
git commit -m "GC-16 E2E: toggle ocultar/mostrar concluidas"
```

---

## Task 9: Verificação final + PR

- [ ] **Step 1: Suíte completa do gate `ci`**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: tudo verde. Este é exatamente o gate `ci`.

- [ ] **Step 2: Push da branch**

```bash
git push -u origin glaubercosta/gc-16-gc-e-visualizacao-e-organizacao
```

- [ ] **Step 3: Abrir o PR (convenções CLAUDE.md)**

Título com o ID; descrição com a magic word `Fixes GC-16`. **Não** referenciar issues já concluídas (GC-14/GC-15) com `Ref`/`Part of` (reabriria pela automação — lição GC-5).

```bash
gh pr create --base main \
  --title "GC-16 Visualização e organização (GC-e)" \
  --body "$(cat <<'EOF'
Fixes GC-16

## Escopo (RF-4/RF-5)
- `classifyDueDate` (hoje/atrasada/futura, RF-5) — função pura.
- `buildTaskView` (ordena/agrupa/conta abertas/oculta concluídas, RF-4.3/4.4/4.5).
- `parseHideDone` + toggle `?done=hidden` (RF-4.4), estado na URL (server-rendered).
- Componentes `PriorityDot` (aria-label textual, RF-4.2) e `DueBadge` (RF-5.2).

## Testes
- Unit (no gate `ci`): domínio (vencimento, view, parser) + componentes (`.tsx`, primeiros do repo).
- E2E (fora do `ci`): toggle ocultar/mostrar concluídas.

Reusa `sortTasks`/`partitionByStatus` da GC-c (antecipados em 2026-07-19).
EOF
)"
```

- [ ] **Step 4: Aguardar o check `ci`**

Run: `gh pr checks --watch`
Expected: `ci` verde → issue GC-16 vai para In Progress/Ready pela automação Linear. O merge é do usuário.

---

## Self-Review (feita ao escrever o plano)

**Cobertura do escopo GC-e (design §4 / issue GC-16):**
- Classificação de vencimento hoje/atrasada/futura (RF-5) → Task 1. ✅
- Toggle "ocultar concluídas" (RF-4.4) → Task 3 (parser) + Task 6 (UI) + Task 8 (E2E). ✅
- Contagem de abertas (RF-4.5) → Task 2 (`openCount`). ✅
- Estados vazios (RF-4.6) → "sem listas" já entregue na GC-d; "lista sem tarefas" é a seção "Abertas (0)" sem itens (coberto pelo render atual + Task 2 com lista vazia). ⚠️ Ver nota abaixo.
- Componentes: badges de prioridade/vencimento (Task 4/5), item concluído esmaecido/riscado (mantido em `page.tsx`), toggle (Task 6). ✅
- DoD: funções puras testadas (Task 1/2/3), componentes testados (Task 4/5), prioridade com aria-label textual (Task 4). ✅

**Nota sobre RF-4.6 (estado vazio da lista):** a issue foca o vazio em RF-4.6 e a parte "sem listas" já foi feita na GC-d. Se, ao executar, a lista ativa sem tarefas não tiver um convite explícito ("adicione a primeira tarefa"), adicionar um `role="note"` na seção "Abertas" quando `openCount === 0 && closed.length === 0`. Decisão deixada para a execução por depender do texto atual do render.

**Placeholders:** nenhum — todo passo tem código/comando concreto.

**Consistência de tipos:** `DueClass`, `TaskView<T>`, `buildTaskView`, `classifyDueDate(dueDate, today)`, `parseHideDone(value)`, `HIDE_DONE_PARAM='done'`, `PriorityDot({priority})`, `DueBadge({dueDate, today})`, `HideCompletedToggle({hideCompleted, activeListId})` — nomes idênticos entre definição e uso em todas as tasks.
