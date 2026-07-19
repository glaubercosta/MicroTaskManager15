# GC-c — Tarefas (CRUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** CRUD de tarefas ponta a ponta (tabela `tasks` + RLS por dono, server actions, render mínimo já ordenado/agrupado), com unit tests puros, teste de integração provando isolamento por RLS e E2E do fluxo básico.

**Architecture:** Lógica de domínio pura em `src/domain/task.ts` (validação, guards de enum, `sortTasks`/`partitionByStatus`). Escrita via **Server Actions** (`src/app/actions.ts`); leitura via **Server Component** (`src/app/page.tsx`) direto do Supabase (RLS escopa por usuário). Segurança real no banco: RLS `for all` com `using` + `with check` por `auth.uid() = user_id`. Testes Supabase-dependentes (integração RLS via Vitest; E2E via Playwright) ficam **fora do gate `ci`** (que roda só typecheck+lint+test puros).

**Tech Stack:** Next.js 16.2.10 (App Router, Server Actions), React 19 (`useActionState`), `@supabase/ssr` + `@supabase/supabase-js`, Supabase local (CLI via `npx supabase`, migrations SQL), Vitest 4, Playwright.

> **Base:** implementa a story **GC-c / GC-14** do design [`2026-07-18-microtaskmanager-v1-design.md`](../specs/2026-07-18-microtaskmanager-v1-design.md) (§4) e do PRD (§6 RF-3, §8 modelo de dados, §12 testes). Depende de GC-b (auth), já na `main`.
>
> **Convenções de ambiente (herdadas de GC-b):**
> - Supabase CLI **não está no PATH** → sempre `npx supabase ...`.
> - MTM15 usa **portas próprias** (`supabase/config.toml`, range 553xx) para coexistir com o V14. NÃO pare/reset o stack de forma que apague o dono.
> - **`npx supabase migration up`** para aplicar migrations (preserva dados). **NÃO** usar `db reset` (apagaria o usuário dono criado por Admin API na GC-b, que o E2E precisa).
> - Regra de versão (PRD §9): confirme as APIs do Next 16 / `@supabase/ssr` na versão instalada antes de codar; se divergir, siga a versão instalada e reporte.
> - **Segredos:** `.env.local` NUNCA é commitado (`.gitignore` já cobre `.env*` com `!.env.example`). As chaves locais do Supabase são de dev (demo), não segredos de produção.

---

## File Structure (ao fim da GC-c)

- Create: `supabase/migrations/<timestamp>_create_tasks.sql` — tabela `tasks`, RLS, política por dono, grants
- Modify: `src/domain/task.ts` — + tipos (`Priority`/`Status`/`Task`), guards, labels pt-BR, `normalizeDueDate`, `sortTasks`, `partitionByStatus`
- Modify: `src/domain/task.test.ts` — + testes dos guards, `normalizeDueDate`, `sortTasks`, `partitionByStatus`
- Create: `src/app/actions.ts` — Server Actions: `createTask`, `updateTaskTitle`, `setTaskPriority`, `setTaskDueDate`, `setTaskStatus`, `deleteTask`
- Create: `src/app/task-quick-add.tsx` — client component do quick-add (`useActionState`)
- Modify: `src/app/page.tsx` — lê tarefas do dono, ordena/agrupa, render mínimo com controles de CRUD
- Create: `src/lib/supabase/tasks-rls.integration.test.ts` — isolamento por RLS entre 2 usuários
- Create: `vitest.integration.config.mts` — config Vitest para `*.integration.test.ts` (env node)
- Create: `vitest.integration.setup.ts` — carrega `.env.local` via dotenv
- Modify: `vitest.config.mts` — exclui `*.integration.test.ts` do run padrão (CI)
- Modify: `package.json` — script `test:integration`
- Modify: `.env.local` (NÃO commit) e `.env.example` (commit) — + `SUPABASE_SERVICE_ROLE_KEY`
- Create: `e2e/tasks.spec.ts` — E2E do fluxo básico de CRUD
- Modify: `AGENTS.md` — documenta `npm run test:integration` e pré-requisitos

---

## Task 1: Migration `tasks` + RLS + grants

**Files:**
- Create: `supabase/migrations/<timestamp>_create_tasks.sql`

- [ ] **Step 1: Confirmar Supabase local no ar**

Run: `npx supabase status`
Expected: imprime `API_URL: http://127.0.0.1:55321` e as chaves (`PUBLISHABLE_KEY`, `SERVICE_ROLE_KEY`). Se não estiver no ar: `npx supabase start`.

- [ ] **Step 2: Criar o arquivo de migration**

Run: `npx supabase migration new create_tasks`
Expected: cria `supabase/migrations/<timestamp>_create_tasks.sql` (vazio). Anote o caminho impresso.

- [ ] **Step 3: Escrever o SQL da migration**

Substitua o conteúdo do arquivo criado no Step 2 por:
```sql
-- Tabela de tarefas (GC-c / GC-14). Modelo: PRD §8.
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- list_id: coluna já criada aqui (nullable, sem FK); a FK para public.lists
  -- é adicionada na GC-d, quando a tabela lists existir.
  list_id uuid,
  title text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  status text not null default 'new' check (status in ('new', 'working', 'done', 'canceled')),
  created_at timestamptz not null default now()
);

-- RLS: cada linha só é acessível pelo dono (RNF-1). O banco é a fronteira.
alter table public.tasks enable row level security;

create policy "tasks_owner_all" on public.tasks
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Data API não auto-expõe tabelas novas (ver supabase/config.toml). Conceder DML
-- explicitamente; a RLS acima continua escopando por usuário para anon/authenticated.
grant select, insert, update, delete on public.tasks to anon, authenticated, service_role;
```

- [ ] **Step 4: Aplicar a migration (sem reset)**

Run: `npx supabase migration up`
Expected: aplica `<timestamp>_create_tasks` sem erro. (NÃO usar `db reset`.)

- [ ] **Step 5: Verificar que a migration consta como aplicada**

Run: `npx supabase migration list`
Expected: a linha do `create_tasks` mostra timestamp na coluna **Local** (aplicada localmente).

- [ ] **Step 6: Verificar a tabela via REST (RLS ativa ⇒ anon vê 0 linhas, sem erro)**

Run (use a `PUBLISHABLE_KEY` do Step 1):
```bash
curl -s "http://127.0.0.1:55321/rest/v1/tasks?select=id" \
  -H "apikey: <PUBLISHABLE_KEY>" -w "\nHTTP %{http_code}\n"
```
Expected: `HTTP 200` com corpo `[]` (tabela existe, exposta, RLS bloqueia anon sem sessão). Se vier `401`/`404` de "relation does not exist" ou permissão, revise grants/policy.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations
git commit -m "GC-14 migration tasks + RLS por dono + grants"
```

---

## Task 2: Domínio puro — tipos, guards de enum, labels e `normalizeDueDate` (TDD)

**Files:**
- Modify: `src/domain/task.ts`
- Modify: `src/domain/task.test.ts`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

Adicione ao final de `src/domain/task.test.ts`:
```ts
import {
  isPriority,
  isStatus,
  normalizeDueDate,
  PRIORITIES,
  STATUSES,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from './task'

describe('guards de enum', () => {
  it('isPriority aceita valores válidos e rejeita inválidos', () => {
    expect(PRIORITIES).toEqual(['low', 'medium', 'high'])
    expect(isPriority('high')).toBe(true)
    expect(isPriority('urgent')).toBe(false)
  })

  it('isStatus aceita valores válidos e rejeita inválidos', () => {
    expect(STATUSES).toEqual(['new', 'working', 'done', 'canceled'])
    expect(isStatus('working')).toBe(true)
    expect(isStatus('pending')).toBe(false)
  })

  it('rótulos pt-BR cobrem todos os valores internos (RNF-4)', () => {
    expect(PRIORITY_LABELS.high).toBe('Alta')
    expect(STATUS_LABELS.working).toBe('Trabalhando')
    expect(STATUS_LABELS.done).toBe('Concluída')
  })
})

describe('normalizeDueDate', () => {
  it('string vazia ou só espaços vira null (limpar prazo)', () => {
    expect(normalizeDueDate('')).toBeNull()
    expect(normalizeDueDate('   ')).toBeNull()
  })

  it('aceita AAAA-MM-DD válido', () => {
    expect(normalizeDueDate('2026-07-19')).toBe('2026-07-19')
  })

  it('rejeita formato inválido', () => {
    expect(() => normalizeDueDate('19/07/2026')).toThrow('inválido')
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: FAIL (exports inexistentes).

- [ ] **Step 3: Implementar em `src/domain/task.ts`**

Adicione ao final de `src/domain/task.ts` (mantenha o `validateTitle` existente):
```ts
export type Priority = 'low' | 'medium' | 'high'
export type Status = 'new' | 'working' | 'done' | 'canceled'

export const PRIORITIES: readonly Priority[] = ['low', 'medium', 'high']
export const STATUSES: readonly Status[] = ['new', 'working', 'done', 'canceled']

/** Rótulos pt-BR (RNF-4): valores internos em inglês, exibição em português. */
export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}
export const STATUS_LABELS: Record<Status, string> = {
  new: 'Nova',
  working: 'Trabalhando',
  done: 'Concluída',
  canceled: 'Cancelada',
}

export function isPriority(value: string): value is Priority {
  return (PRIORITIES as readonly string[]).includes(value)
}

export function isStatus(value: string): value is Status {
  return (STATUSES as readonly string[]).includes(value)
}

/** Normaliza um prazo vindo de formulário. Vazio → null (limpar). Valida AAAA-MM-DD (RF-3.4). */
export function normalizeDueDate(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('Prazo inválido (use AAAA-MM-DD).')
  }
  return trimmed
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: PASS (todos os describes, incluindo os antigos de `validateTitle`).

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-14 dominio: tipos, guards de enum, rotulos pt-BR e normalizeDueDate"
```

---

## Task 3: Domínio puro — `sortTasks` (RF-4.1) e `partitionByStatus` (RF-4.3) (TDD)

**Files:**
- Modify: `src/domain/task.ts`
- Modify: `src/domain/task.test.ts`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

Adicione ao final de `src/domain/task.test.ts`:
```ts
import { sortTasks, partitionByStatus, type Priority, type Status } from './task'

const t = (priority: Priority, due_date: string | null, status: Status = 'new') => ({
  priority,
  due_date,
  status,
})

describe('sortTasks (RF-4.1)', () => {
  it('ordena por prioridade alta→baixa', () => {
    const out = sortTasks([t('low', null), t('high', null), t('medium', null)])
    expect(out.map((x) => x.priority)).toEqual(['high', 'medium', 'low'])
  })

  it('no empate de prioridade, prazo mais próximo primeiro', () => {
    const out = sortTasks([t('high', '2026-08-10'), t('high', '2026-08-01')])
    expect(out.map((x) => x.due_date)).toEqual(['2026-08-01', '2026-08-10'])
  })

  it('sem prazo vai depois das com prazo, na mesma prioridade', () => {
    const out = sortTasks([t('high', null), t('high', '2026-08-01')])
    expect(out.map((x) => x.due_date)).toEqual(['2026-08-01', null])
  })

  it('não muta o array de entrada', () => {
    const input = [t('low', null), t('high', null)]
    const copy = [...input]
    sortTasks(input)
    expect(input).toEqual(copy)
  })
})

describe('partitionByStatus (RF-4.3)', () => {
  it('separa abertas (new/working) das encerradas (done/canceled) preservando a ordem', () => {
    const list = [
      t('high', null, 'new'),
      t('high', null, 'done'),
      t('high', null, 'working'),
      t('high', null, 'canceled'),
    ]
    const { open, closed } = partitionByStatus(list)
    expect(open.map((x) => x.status)).toEqual(['new', 'working'])
    expect(closed.map((x) => x.status)).toEqual(['done', 'canceled'])
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: FAIL (`sortTasks`/`partitionByStatus` inexistentes).

- [ ] **Step 3: Implementar em `src/domain/task.ts`**

Adicione ao final de `src/domain/task.ts`:
```ts
export interface SortableTask {
  priority: Priority
  due_date: string | null
}

/** Linha de tarefa como vem do banco (para o render). */
export interface Task extends SortableTask {
  id: string
  title: string
  status: Status
  list_id: string | null
  created_at: string
}

const PRIORITY_RANK: Record<Priority, number> = { high: 3, medium: 2, low: 1 }
const OPEN_STATUSES: readonly Status[] = ['new', 'working']

/** RF-4.1: prioridade alta→baixa; empate por prazo mais próximo; sem prazo por último. Cópia (não muta). */
export function sortTasks<T extends SortableTask>(tasks: readonly T[]): T[] {
  return [...tasks].sort((a, b) => {
    const byPriority = PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority]
    if (byPriority !== 0) return byPriority
    if (a.due_date === b.due_date) return 0
    if (a.due_date === null) return 1
    if (b.due_date === null) return -1
    return a.due_date < b.due_date ? -1 : 1
  })
}

/** RF-4.3: abertas (new/working) primeiro; encerradas (done/canceled) numa seção ao final. */
export function partitionByStatus<T extends { status: Status }>(
  tasks: readonly T[],
): { open: T[]; closed: T[] } {
  const open: T[] = []
  const closed: T[] = []
  for (const task of tasks) {
    if (OPEN_STATUSES.includes(task.status)) open.push(task)
    else closed.push(task)
  }
  return { open, closed }
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `npm run test -- --run src/domain/task.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/task.ts src/domain/task.test.ts
git commit -m "GC-14 dominio: sortTasks (RF-4.1) e partitionByStatus (RF-4.3)"
```

---

## Task 4: Server Actions de CRUD

**Files:**
- Create: `src/app/actions.ts`

- [ ] **Step 1: Criar `src/app/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateTitle, isPriority, isStatus, normalizeDueDate } from '@/domain/task'

async function requireUserClient() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return { supabase, user }
}

/** RF-3.1: título obrigatório; prioridade default medium; prazo opcional; status inicial 'new'. */
export async function createTask(_prev: unknown, formData: FormData) {
  let title: string
  try {
    title = validateTitle(String(formData.get('title') ?? ''))
  } catch (e) {
    return { error: (e as Error).message }
  }

  const rawPriority = String(formData.get('priority') ?? 'medium')
  const priority = isPriority(rawPriority) ? rawPriority : 'medium'

  let due_date: string | null
  try {
    due_date = normalizeDueDate(String(formData.get('due_date') ?? ''))
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { supabase, user } = await requireUserClient()
  const { error } = await supabase
    .from('tasks')
    .insert({ user_id: user.id, title, priority, due_date, status: 'new' })
  if (error) return { error: 'Não foi possível criar a tarefa.' }

  revalidatePath('/')
  return { error: null }
}

/** RF-3.2: editar título (rejeita vazio). */
export async function updateTaskTitle(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  let title: string
  try {
    title = validateTitle(String(formData.get('title') ?? ''))
  } catch {
    return
  }
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ title }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.3: mudar prioridade. */
export async function setTaskPriority(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('priority') ?? '')
  if (!isPriority(raw)) return
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ priority: raw }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.4: definir ou limpar prazo. */
export async function setTaskDueDate(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  let due_date: string | null
  try {
    due_date = normalizeDueDate(String(formData.get('due_date') ?? ''))
  } catch {
    return
  }
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ due_date }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.5: mudar status (nova/trabalhando/concluída/cancelada). */
export async function setTaskStatus(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const raw = String(formData.get('status') ?? '')
  if (!isStatus(raw)) return
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').update({ status: raw }).eq('id', id)
  revalidatePath('/')
}

/** RF-3.6: apagar tarefa. */
export async function deleteTask(formData: FormData) {
  const id = String(formData.get('id') ?? '')
  const { supabase } = await requireUserClient()
  await supabase.from('tasks').delete().eq('id', id)
  revalidatePath('/')
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/app/actions.ts
git commit -m "GC-14 server actions de CRUD de tarefas (RF-3)"
```

---

## Task 5: Render mínimo — quick-add (client) + lista ordenada/agrupada (server)

**Files:**
- Create: `src/app/task-quick-add.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Client component do quick-add**

Create `src/app/task-quick-add.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { createTask } from './actions'
import { PRIORITIES, PRIORITY_LABELS } from '@/domain/task'

export function TaskQuickAdd() {
  const [state, formAction, pending] = useActionState(createTask, { error: null })

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      <input name="title" placeholder="Adicionar tarefa…" aria-label="Título da tarefa" required />
      <select name="priority" defaultValue="medium" aria-label="Prioridade">
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {PRIORITY_LABELS[p]}
          </option>
        ))}
      </select>
      <input name="due_date" type="date" aria-label="Prazo" />
      <button type="submit" disabled={pending}>
        {pending ? 'Adicionando…' : 'Adicionar'}
      </button>
      {state?.error ? <p role="alert">{state.error}</p> : null}
    </form>
  )
}
```
> Regra de versão: `useActionState` é de `react` no React 19 (instalado). Se divergir, confirme a API e reporte.

- [ ] **Step 2: Home protegida com lista de tarefas**

Replace `src/app/page.tsx` com:
```tsx
import { createClient } from '@/lib/supabase/server'
import { signOut } from './login/actions'
import {
  sortTasks,
  partitionByStatus,
  PRIORITIES,
  PRIORITY_LABELS,
  STATUSES,
  STATUS_LABELS,
  type Task,
} from '@/domain/task'
import { TaskQuickAdd } from './task-quick-add'
import {
  updateTaskTitle,
  setTaskPriority,
  setTaskDueDate,
  setTaskStatus,
  deleteTask,
} from './actions'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data } = await supabase
    .from('tasks')
    .select('id,title,priority,due_date,status,list_id,created_at')
  const tasks = (data ?? []) as Task[]
  const { open, closed } = partitionByStatus(sortTasks(tasks))

  return (
    <main style={{ maxWidth: 600, margin: '6vh auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>MicroTaskManager</h1>
        <form action={signOut}>
          <button type="submit">Sair</button>
        </form>
      </header>
      <p>Sessão de {user?.email ?? 'desconhecido'}.</p>

      <TaskQuickAdd />

      <section aria-label="Tarefas abertas">
        <h2>Abertas ({open.length})</h2>
        <ul>
          {open.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </ul>
      </section>

      {closed.length > 0 ? (
        <section aria-label="Concluídas">
          <h2>Concluídas</h2>
          <ul>
            {closed.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  )
}

function TaskRow({ task }: { task: Task }) {
  const done = task.status === 'done' || task.status === 'canceled'

  return (
    <li style={{ marginBottom: 12 }}>
      <span aria-label={`Prioridade: ${PRIORITY_LABELS[task.priority]}`} title={PRIORITY_LABELS[task.priority]}>
        ●
      </span>{' '}
      <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
        {task.title}
      </span>{' '}
      {task.due_date ? <small>({task.due_date})</small> : null}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        <form action={updateTaskTitle}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <input name="title" defaultValue={task.title} aria-label={`Editar título de ${task.title}`} />
          <button type="submit" aria-label={`Salvar título de ${task.title}`}>
            Salvar
          </button>
        </form>

        <form action={setTaskPriority}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <select name="priority" defaultValue={task.priority} aria-label={`Prioridade de ${task.title}`}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
          <button type="submit" aria-label={`Aplicar prioridade de ${task.title}`}>
            Prioridade
          </button>
        </form>

        <form action={setTaskStatus}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <select name="status" defaultValue={task.status} aria-label={`Status de ${task.title}`}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <button type="submit" aria-label={`Aplicar status de ${task.title}`}>
            Status
          </button>
        </form>

        <form action={setTaskDueDate}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <input name="due_date" type="date" defaultValue={task.due_date ?? ''} aria-label={`Prazo de ${task.title}`} />
          <button type="submit" aria-label={`Aplicar prazo de ${task.title}`}>
            Prazo
          </button>
        </form>

        <form action={deleteTask}>
          <input type="hidden" name="id" defaultValue={task.id} />
          <button type="submit" aria-label={`Apagar ${task.title}`}>
            Apagar
          </button>
        </form>
      </div>
    </li>
  )
}
```
> Estética real (tokens/layout) vem na GC-f; aqui é funcional e sóbrio. `aria-label` nos controles inclui o título — dá acessibilidade e alvos estáveis para o E2E.

- [ ] **Step 3: Typecheck + lint + suíte puros**

Run: `npm run typecheck && npm run lint && npm run test -- --run`
Expected: todos exit 0.

- [ ] **Step 4: Verificação manual rápida (dev server)**

Run: `npm run dev` (deixe rodando; requer `.env.local` e Supabase no ar). Abra `http://localhost:3000`, logue com o dono, crie/edite/mude status/apague uma tarefa; confirme que concluídas caem na seção "Concluídas". Pare o dev server (Ctrl+C). Anote o resultado no report.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/app/task-quick-add.tsx
git commit -m "GC-14 render minimo: quick-add + lista ordenada/agrupada com CRUD"
```

---

## Task 6: Teste de integração — isolamento por RLS (fora do CI)

**Files:**
- Create: `vitest.integration.setup.ts`
- Create: `vitest.integration.config.mts`
- Modify: `vitest.config.mts`
- Modify: `package.json`
- Modify: `.env.local` (NÃO commit) e `.env.example`
- Create: `src/lib/supabase/tasks-rls.integration.test.ts`

- [ ] **Step 1: Adicionar a service_role key ao ambiente**

Adicione ao `.env.local` (NÃO commit) a chave `SERVICE_ROLE_KEY` impressa em `npx supabase status`:
```
SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY do npx supabase status>
```
E adicione a **chave (sem valor)** ao `.env.example` (commit), ao final:
```
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 2: Setup de env para a config de integração**

Create `vitest.integration.setup.ts`:
```ts
import dotenv from 'dotenv'

// Carrega credenciais locais de dev (não versionadas) para os testes de integração.
dotenv.config({ path: '.env.local' })
```

- [ ] **Step 3: Config Vitest de integração (env node, só `*.integration.test.ts`)**

Create `vitest.integration.config.mts`:
```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.integration.setup.ts'],
    include: ['**/*.integration.test.ts'],
    testTimeout: 20_000,
  },
})
```

- [ ] **Step 4: Excluir integração do run padrão (CI)**

Edite `vitest.config.mts` — troque a linha do `exclude` para também ignorar os testes de integração:
```ts
    // e2e/ é do Playwright; *.integration.test.ts roda por vitest.integration.config.mts.
    exclude: [...configDefaults.exclude, 'e2e/**', '**/*.integration.test.ts'],
```

- [ ] **Step 5: Script `test:integration`**

Edite `package.json` — adicione ao bloco `scripts` (após `"test"`):
```json
    "test:integration": "vitest --run --config vitest.integration.config.mts",
```

- [ ] **Step 6: Escrever o teste de integração (falha primeiro se RLS/tabela ausente)**

Create `src/lib/supabase/tasks-rls.integration.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

type TestUser = { id: string; email: string; client: SupabaseClient }

async function makeUser(): Promise<TestUser> {
  const email = `rls-${crypto.randomUUID()}@test.local`
  const password = 'test-password-123'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError

  return { id: data.user!.id, email, client }
}

describe('RLS de tasks: isolamento entre usuários (RNF-1)', () => {
  let userA: TestUser
  let userB: TestUser
  let taskAId: string

  beforeAll(async () => {
    userA = await makeUser()
    userB = await makeUser()

    const { data, error } = await userA.client
      .from('tasks')
      .insert({ user_id: userA.id, title: 'Tarefa privada de A' })
      .select('id')
      .single()
    if (error) throw error
    taskAId = data.id
  })

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id)
    if (userB) await admin.auth.admin.deleteUser(userB.id)
  })

  it('B não enxerga tarefas de A no SELECT', async () => {
    const { data: seenByB } = await userB.client.from('tasks').select('id')
    expect(seenByB ?? []).toHaveLength(0)

    const { data: seenByA } = await userA.client.from('tasks').select('id')
    expect((seenByA ?? []).map((r) => r.id)).toContain(taskAId)
  })

  it('B não consegue apagar tarefa de A (RLS filtra; A ainda vê)', async () => {
    await userB.client.from('tasks').delete().eq('id', taskAId)

    const { data: stillThere } = await userA.client.from('tasks').select('id').eq('id', taskAId)
    expect(stillThere ?? []).toHaveLength(1)
  })

  it('B não consegue inserir linha com user_id de A (with check)', async () => {
    const { error } = await userB.client
      .from('tasks')
      .insert({ user_id: userA.id, title: 'Injeção de B' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 7: Rodar o teste de integração**

Run: `npm run test:integration`
Expected: PASS (3 testes). Requer Supabase local no ar + migration da Task 1 aplicada + `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`.

- [ ] **Step 8: Confirmar que a suíte do CI NÃO roda a integração**

Run: `npm run test -- --run`
Expected: PASS e **sem** o arquivo `tasks-rls.integration.test.ts` na lista (excluído pela config do Step 4).

- [ ] **Step 9: Commit (sem `.env.local`)**

Run: `git status --short` → confirme que `.env.local` NÃO aparece.
```bash
git add vitest.integration.setup.ts vitest.integration.config.mts vitest.config.mts package.json .env.example src/lib/supabase/tasks-rls.integration.test.ts
git commit -m "GC-14 teste de integracao de RLS (isolamento entre usuarios), fora do CI"
```

---

## Task 7: E2E do fluxo básico de CRUD (Playwright, fora do CI)

**Files:**
- Create: `e2e/tasks.spec.ts`

- [ ] **Step 1: Escrever o E2E**

Create `e2e/tasks.spec.ts`:
```ts
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
    await page.getByLabel(`Status de ${edited}`).selectOption('done')
    await page.getByRole('button', { name: `Aplicar status de ${edited}` }).click()
    await expect(page.getByRole('region', { name: 'Concluídas' }).getByText(edited)).toBeVisible()

    // Apagar
    await page.getByRole('button', { name: `Apagar ${edited}` }).click()
    await expect(page.getByText(edited)).toHaveCount(0)
  })
})
```

- [ ] **Step 2: Rodar o E2E**

Run: `npm run e2e`
Expected: PASS (2 arquivos: `auth.spec.ts` + `tasks.spec.ts`). Sobe o próprio dev server na porta `E2E_PORT` (default 3100). Requer Supabase local no ar, migration aplicada e dono criado (ver AGENTS.md).

- [ ] **Step 3: Commit**

```bash
git add e2e/tasks.spec.ts
git commit -m "GC-14 E2E do fluxo basico de CRUD de tarefas"
```

---

## Task 8: Docs + verificação final + self-review

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Documentar o comando de integração no AGENTS.md**

Edite `AGENTS.md` — na seção "Comandos", adicione:
```markdown
- `npm run test:integration` — Vitest de integração (`*.integration.test.ts`, env node).
  Requer Supabase local no ar + `SUPABASE_SERVICE_ROLE_KEY` no `.env.local`. **Fora do gate `ci`.**
```
E na seção "Testes E2E (Playwright)" (ou logo abaixo dela), acrescente:
```markdown
## Testes de integração (Supabase)
- `npm run test:integration` prova o isolamento por RLS entre usuários (cria 2 usuários via
  Admin API, insere dados e confirma que um não lê/edita dados do outro).
- Pré-requisitos: `npx supabase start`, migration `tasks` aplicada (`npx supabase migration up`),
  `SUPABASE_SERVICE_ROLE_KEY` no `.env.local` (valor de `npx supabase status`). NÃO entra no `ci`.
```

- [ ] **Step 2: Commit da doc**

```bash
git add AGENTS.md
git commit -m "GC-14 documenta test:integration e pre-requisitos no AGENTS.md"
```

- [ ] **Step 3: Gate do CI localmente (o que o GitHub vai exigir)**

Run: `npm run typecheck && npm run lint && npm run test -- --run`
Expected: todos exit 0 (esta é exatamente a suíte do check `ci`).

- [ ] **Step 4: Build de produção (sanidade; NÃO roda no CI)**

Run: `npm run build`
Expected: exit 0 (requer `.env.local`). Se falhar só por env em ambiente sem `.env.local`, registre — o CI não roda build.

- [ ] **Step 5: Suítes Supabase-dependentes (evidência de DoD)**

Run: `npm run test:integration && npm run e2e`
Expected: ambos PASS. Registre a saída no report como evidência do DoD (RLS + fluxo CRUD).

- [ ] **Step 6: Self-review do diff**

Run: `git diff main --stat`
Confira: migration + domínio + actions + render + integração + E2E + docs presentes; nenhum `.env.local` commitado; nenhum segredo real no diff.

---

## Self-Review (writing-plans)

**Spec coverage (design §4 GC-c + PRD RF-3 / §8 / §12):**
- Tabela `tasks` + RLS `using`+`with check` por `auth.uid()=user_id` + grants → Task 1 ✓ (PRD §8, RNF-1).
- Criar (título obrigatório, prioridade default `medium`, prazo opcional, status `new`) → Task 4 `createTask` + Task 2 (validação/normalização) ✓ (RF-3.1).
- Editar título (rejeita vazio) → Task 4 `updateTaskTitle` + `validateTitle` ✓ (RF-3.2).
- Mudar prioridade → `setTaskPriority` ✓ (RF-3.3). Mudar/limpar prazo → `setTaskDueDate` + `normalizeDueDate` ✓ (RF-3.4). Mudar status → `setTaskStatus` ✓ (RF-3.5). Apagar → `deleteTask` ✓ (RF-3.6).
- Ordenação (RF-4.1) e agrupamento (RF-4.3), antecipados da GC-e → Task 3 `sortTasks`/`partitionByStatus`, fiados no render Task 5 ✓.
- Render mínimo da lista → Task 5 ✓. Lógica de domínio pura isolada → `src/domain/task.ts` (Tasks 2–3) ✓ (§5, PRD §12).
- Teste de integração provando RLS bloqueia dados de outro usuário → Task 6 ✓ (DoD; PRD §12).
- Unit tests de validação (título vazio, defaults) e de ordenação/agrupamento → Tasks 2–3 ✓.
- E2E básico de CRUD → Task 7 ✓ (DoD do Linear GC-14).
- Fora do gate `ci`: integração (config separada, Task 6 Steps 4/8) e E2E (Playwright, herdado) ✓.

**Placeholder scan:** sem TBD/TODO; todo step tem comando/código completo. Incertezas de API isoladas em notas "regra de versão" (useActionState, `@supabase/ssr`).

**Type consistency:** `Priority`/`Status`/`Task`/`SortableTask` definidos em Task 2–3 e reusados idênticos em actions (Task 4) e render (Task 5); `isPriority`/`isStatus`/`normalizeDueDate`/`validateTitle` com assinatura única; nomes de campos (`user_id`, `list_id`, `due_date`, `created_at`) consistentes entre migration (Task 1), select (Task 5) e insert/update (Task 4); `sortTasks`/`partitionByStatus` (nomes idênticos em teste, domínio e render).

---

## Nota de fluxo (CLAUDE.md)
Branch `glaubercosta/gc-14-gc-c-tarefas-crud` (já criada). Título do PR `GC-14 Tarefas (CRUD)`; descrição com `Fixes GC-14`. Não referenciar (`Ref`) issues já concluídas. CI (typecheck+lint+test) precisa passar; build/integração/E2E NÃO rodam no CI.
