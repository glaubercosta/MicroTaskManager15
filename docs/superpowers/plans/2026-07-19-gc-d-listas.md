# GC-d · Listas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar listas/categorias ao MicroTaskManager — criar listas, navegar por abas ("Todas" + uma por lista + "＋ Nova lista") e filtrar tarefas pela lista ativa (RF-2), com a tarefa criada herdando a lista ativa (ou `null` na aba "Todas").

**Architecture:** Segue o padrão das stories anteriores: lógica pura e testável em `src/domain/` (validação de nome, filtro por lista, resolução da lista ativa), mutações via **server actions** em `src/app/actions.ts`, leitura no server component `src/app/page.tsx`. A lista ativa vive na **URL** (`/?list=<id>`), então as abas são links e o server render já filtra. RLS no banco é a fronteira (RNF-1); a coluna `tasks.list_id` já existe e ganha a FK para `public.lists` nesta story.

**Tech Stack:** Next.js 16 (App Router, Server Actions, `searchParams` async), Supabase local (Postgres + RLS, migrations SQL), Vitest 4 (unit no gate `ci`; integração RLS fora do `ci`), Playwright (E2E fora do `ci`).

**Convenções (design §5 / CLAUDE.md):** TDD; valores internos em inglês e rótulos pt-BR (RNF-4); toda tabela nasce com RLS + teste de isolamento; branch `glaubercosta/gc-15-gc-d-listas`; PR com `Fixes GC-15`. **Não** referenciar issues já concluídas em PRs novos.

---

## File Structure

- **Create** `src/domain/list.ts` — lógica pura de listas: `validateListName`, tipo `List`, `normalizeListId`, `resolveActiveListId`, `filterTasksByList`.
- **Create** `src/domain/list.test.ts` — unit tests das funções puras (rodam no `ci`).
- **Create** `supabase/migrations/20260719150000_create_lists.sql` — tabela `lists` + RLS + grants; adiciona a FK `tasks.list_id → lists(id) on delete set null`.
- **Modify** `src/app/actions.ts` — nova action `createList`; `createTask` passa a ler `list_id` do formulário.
- **Create** `src/app/new-list.tsx` — client component do campo "＋ Nova lista" (`useActionState(createList)`).
- **Create** `src/app/list-tabs.tsx` — server component: pílulas "Todas" + uma por lista (links) + `<NewList />`.
- **Modify** `src/app/page.tsx` — lê `searchParams`, busca `lists`, resolve lista ativa, renderiza `<ListTabs>`, filtra tarefas, passa `activeListId` ao `TaskQuickAdd`, estado vazio "sem listas".
- **Modify** `src/app/task-quick-add.tsx` — recebe `activeListId` e envia hidden `list_id`.
- **Create** `src/lib/supabase/lists-rls.integration.test.ts` — isolamento RLS de `lists` entre usuários (fora do `ci`).
- **Create** `e2e/lists.spec.ts` — E2E: criar lista, alternar abas filtra (fora do `ci`).

---

## Task 1: Domínio puro de listas

**Files:**
- Create: `src/domain/list.ts`
- Test: `src/domain/list.test.ts`

- [ ] **Step 1: Write the failing test**

Criar `src/domain/list.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  validateListName,
  normalizeListId,
  resolveActiveListId,
  filterTasksByList,
} from './list'

describe('validateListName (RF-2.1)', () => {
  it('faz trim e retorna o nome', () => {
    expect(validateListName('  Trabalho  ')).toBe('Trabalho')
  })
  it('rejeita vazio ou só espaços', () => {
    expect(() => validateListName('   ')).toThrow(/vazio/i)
    expect(() => validateListName('')).toThrow(/vazio/i)
  })
})

describe('normalizeListId', () => {
  it('vazio, espaços e "all" viram null (aba Todas)', () => {
    expect(normalizeListId('')).toBeNull()
    expect(normalizeListId('   ')).toBeNull()
    expect(normalizeListId('all')).toBeNull()
  })
  it('um id concreto é preservado (trim)', () => {
    expect(normalizeListId('  abc-123  ')).toBe('abc-123')
  })
})

describe('resolveActiveListId', () => {
  const lists = [{ id: 'l1' }, { id: 'l2' }]
  it('sem param ou "all" → null (Todas)', () => {
    expect(resolveActiveListId(lists, undefined)).toBeNull()
    expect(resolveActiveListId(lists, 'all')).toBeNull()
  })
  it('id existente é aceito', () => {
    expect(resolveActiveListId(lists, 'l2')).toBe('l2')
  })
  it('id inexistente cai para Todas (null)', () => {
    expect(resolveActiveListId(lists, 'fantasma')).toBeNull()
  })
})

describe('filterTasksByList (RF-2.3)', () => {
  const tasks = [
    { id: 't1', list_id: null },
    { id: 't2', list_id: 'l1' },
    { id: 't3', list_id: 'l2' },
    { id: 't4', list_id: 'l1' },
  ]
  it('Todas (null) mostra tudo (cópia, não muta)', () => {
    const out = filterTasksByList(tasks, null)
    expect(out.map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
    expect(out).not.toBe(tasks)
  })
  it('lista ativa mostra só as tarefas daquela lista', () => {
    expect(filterTasksByList(tasks, 'l1').map((t) => t.id)).toEqual(['t2', 't4'])
  })
  it('tarefas sem lista não aparecem numa lista específica', () => {
    expect(filterTasksByList(tasks, 'l2').map((t) => t.id)).toEqual(['t3'])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run src/domain/list.test.ts`
Expected: FAIL — `Failed to resolve import "./list"` / funções indefinidas.

- [ ] **Step 3: Write minimal implementation**

Criar `src/domain/list.ts`:

```ts
/** Valida e normaliza o nome de uma lista (RF-2.1). Lança se vazio. */
export function validateListName(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('O nome da lista não pode ser vazio.')
  }
  return trimmed
}

/** Linha de lista como vem do banco. */
export interface List {
  id: string
  name: string
  created_at: string
}

/** Sentinela da aba fixa "Todas" na URL. */
export const ALL_LISTS = 'all' as const

/**
 * Normaliza o `list_id` vindo de formulário. Vazio, espaços ou "all" → null
 * (tarefa sem lista / aba "Todas"). Caso contrário, o id (com trim).
 */
export function normalizeListId(raw: string): string | null {
  const trimmed = raw.trim()
  if (trimmed.length === 0 || trimmed === ALL_LISTS) return null
  return trimmed
}

/**
 * Resolve a lista ativa a partir do parâmetro de URL. Sem param ou "all" → null
 * (aba "Todas"). Um id só é aceito se pertencer às listas do usuário; caso
 * contrário cai para "Todas" (null) — evita filtrar por lista inexistente/alheia.
 */
export function resolveActiveListId(
  lists: readonly { id: string }[],
  param: string | undefined,
): string | null {
  if (!param || param === ALL_LISTS) return null
  return lists.some((l) => l.id === param) ? param : null
}

/** RF-2.3: "Todas" (null) mostra tudo; uma lista ativa filtra por `list_id`. Cópia (não muta). */
export function filterTasksByList<T extends { list_id: string | null }>(
  tasks: readonly T[],
  activeListId: string | null,
): T[] {
  if (activeListId === null) return [...tasks]
  return tasks.filter((t) => t.list_id === activeListId)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --run src/domain/list.test.ts`
Expected: PASS (todos os `describe` verdes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/list.ts src/domain/list.test.ts
git commit -m "GC-15 dominio puro de listas (validacao, filtro, lista ativa)"
```

---

## Task 2: Migration — tabela `lists` + RLS + FK em `tasks`

**Files:**
- Create: `supabase/migrations/20260719150000_create_lists.sql`

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/20260719150000_create_lists.sql`:

```sql
-- Tabela de listas/categorias (GC-d / GC-15). Modelo: PRD §8.
create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- RLS: cada lista só é acessível pelo dono (RNF-1). O banco é a fronteira.
alter table public.lists enable row level security;

create policy "lists_owner_all" on public.lists
  for all
  to anon, authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Data API não auto-expõe tabelas novas (ver supabase/config.toml). Conceder DML
-- explicitamente; a RLS acima continua escopando por usuário para anon/authenticated.
grant select, insert, update, delete on public.lists to anon, authenticated, service_role;

-- FK adiada da GC-c: agora que public.lists existe, vincula tasks.list_id.
-- on delete set null: apagar a lista solta as tarefas na aba "Todas" (não as apaga).
alter table public.tasks
  add constraint tasks_list_id_fkey
  foreign key (list_id) references public.lists (id) on delete set null;
```

- [ ] **Step 2: Aplicar as migrations no Supabase local**

Pré-requisito: `supabase start` (Docker) rodando — ver `AGENTS.md`.

Run: `npx supabase db reset`
Expected: recria o banco aplicando todas as migrations em ordem, terminando com `create_lists`; sem erros de SQL. A linha final é algo como `Finished supabase db reset on branch ...`.

- [ ] **Step 3: Verificar a tabela e a FK**

Run:
```bash
npx supabase db reset >/dev/null 2>&1; \
echo "\d public.lists" | npx supabase db psql 2>/dev/null | head -20
```
(Se `db psql` não estiver disponível nesta versão da CLI, pule esta verificação — o Task 5 (RLS) e o `db reset` do Step 2 já exercitam o schema.)
Expected: colunas `id, user_id, name, created_at`; RLS habilitado.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260719150000_create_lists.sql
git commit -m "GC-15 migration: tabela lists + RLS + FK tasks.list_id"
```

---

## Task 3: Server actions — `createList` e `createTask` com `list_id`

**Files:**
- Modify: `src/app/actions.ts`

- [ ] **Step 1: Adicionar imports do domínio de listas**

Em `src/app/actions.ts`, logo abaixo do import de `@/domain/task` (linha 6), adicionar:

```ts
import { validateListName, normalizeListId } from '@/domain/list'
```

- [ ] **Step 2: `createTask` passa a ler `list_id`**

Em `src/app/actions.ts`, dentro de `createTask`, **depois** do bloco que resolve `due_date` (após a linha `}` que fecha o `try/catch` do `normalizeDueDate`, ~linha 34) e **antes** de `const { supabase, user } = await requireUserClient()`, inserir:

```ts
  const list_id = normalizeListId(String(formData.get('list_id') ?? ''))
```

E no `.insert(...)` de `createTask`, acrescentar `list_id` ao objeto:

```ts
  const { error } = await supabase
    .from('tasks')
    .insert({ user_id: user.id, title, priority, due_date, status: 'new', list_id })
```

- [ ] **Step 3: Adicionar a action `createList` ao final do arquivo**

Em `src/app/actions.ts`, acrescentar ao final:

```ts
/** RF-2.1: criar lista (nome não vazio). Retorna { error } para useActionState. */
export async function createList(_prev: unknown, formData: FormData) {
  let name: string
  try {
    name = validateListName(String(formData.get('name') ?? ''))
  } catch (e) {
    return { error: (e as Error).message }
  }

  const { supabase, user } = await requireUserClient()
  const { error } = await supabase.from('lists').insert({ user_id: user.id, name })
  if (error) return { error: 'Não foi possível criar a lista.' }

  revalidatePath('/')
  return { error: null }
}
```

- [ ] **Step 4: Typecheck e lint**

Run: `npm run typecheck && npm run lint`
Expected: PASS, sem erros.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions.ts
git commit -m "GC-15 server actions: createList + createTask herda list_id"
```

---

## Task 4: UI — abas de listas, criação e estado vazio

**Files:**
- Create: `src/app/new-list.tsx`
- Create: `src/app/list-tabs.tsx`
- Modify: `src/app/task-quick-add.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Client component `NewList`**

Criar `src/app/new-list.tsx`:

```tsx
'use client'

import { useActionState } from 'react'
import { createList } from './actions'

export function NewList() {
  const [state, formAction, pending] = useActionState(createList, { error: null })

  return (
    <form action={formAction} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
      <input
        name="name"
        placeholder="＋ Nova lista"
        aria-label="Nome da nova lista"
        required
      />
      <button type="submit" disabled={pending}>
        {pending ? 'Criando…' : 'Criar'}
      </button>
      {state?.error ? <span role="alert">{state.error}</span> : null}
    </form>
  )
}
```

- [ ] **Step 2: Server component `ListTabs`**

Criar `src/app/list-tabs.tsx`:

```tsx
import type { List } from '@/domain/list'
import { NewList } from './new-list'

/** RF-2.2: pílulas "Todas" + uma por lista + "＋ Nova lista". Aba ativa via aria-current. */
export function ListTabs({
  lists,
  activeListId,
}: {
  lists: List[]
  activeListId: string | null
}) {
  return (
    <nav aria-label="Listas" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      <a href="/" aria-current={activeListId === null ? 'page' : undefined}>
        Todas
      </a>
      {lists.map((list) => (
        <a
          key={list.id}
          href={`/?list=${list.id}`}
          aria-current={activeListId === list.id ? 'page' : undefined}
        >
          {list.name}
        </a>
      ))}
      <NewList />
    </nav>
  )
}
```

- [ ] **Step 3: `TaskQuickAdd` recebe `activeListId` e envia hidden `list_id`**

Substituir o conteúdo de `src/app/task-quick-add.tsx` por:

```tsx
'use client'

import { useActionState } from 'react'
import { createTask } from './actions'
import { PRIORITIES, PRIORITY_LABELS } from '@/domain/task'
import { ALL_LISTS } from '@/domain/list'

export function TaskQuickAdd({ activeListId }: { activeListId: string | null }) {
  const [state, formAction, pending] = useActionState(createTask, { error: null })

  return (
    <form action={formAction} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '16px 0' }}>
      <input type="hidden" name="list_id" defaultValue={activeListId ?? ALL_LISTS} />
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

> Nota: `page.tsx` remonta o `TaskQuickAdd` a cada troca de aba passando `key={activeListId ?? 'all'}` (Step 4), então o `defaultValue` do hidden reflete sempre a lista ativa.

- [ ] **Step 4: `page.tsx` — searchParams, listas, filtro, abas, estado vazio**

Substituir o conteúdo de `src/app/page.tsx` por:

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
import {
  filterTasksByList,
  resolveActiveListId,
  ALL_LISTS,
  type List,
} from '@/domain/list'
import { TaskQuickAdd } from './task-quick-add'
import { ListTabs } from './list-tabs'
import {
  updateTaskTitle,
  setTaskPriority,
  setTaskDueDate,
  setTaskStatus,
  deleteTask,
} from './actions'

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ list?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: listsData } = await supabase
    .from('lists')
    .select('id,name,created_at')
    .order('created_at', { ascending: true })
  const lists = (listsData ?? []) as List[]

  const { list: rawParam } = await searchParams
  const listParam = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const activeListId = resolveActiveListId(lists, listParam)

  const { data } = await supabase
    .from('tasks')
    .select('id,title,priority,due_date,status,list_id,created_at')
  const allTasks = (data ?? []) as Task[]
  const tasks = filterTasksByList(allTasks, activeListId)
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

      <ListTabs lists={lists} activeListId={activeListId} />

      {lists.length === 0 ? (
        <p role="note">Você ainda não tem listas. Crie a primeira acima para organizar suas tarefas.</p>
      ) : null}

      <TaskQuickAdd key={activeListId ?? ALL_LISTS} activeListId={activeListId} />

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
          <select key={task.priority} name="priority" defaultValue={task.priority} aria-label={`Prioridade de ${task.title}`}>
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
          <select key={task.status} name="status" defaultValue={task.status} aria-label={`Status de ${task.title}`}>
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

- [ ] **Step 5: Typecheck, lint e testes de unidade**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: PASS. (Os testes de unidade continuam verdes; nenhum teste depende do banco.)

- [ ] **Step 6: Commit**

```bash
git add src/app/page.tsx src/app/task-quick-add.tsx src/app/list-tabs.tsx src/app/new-list.tsx
git commit -m "GC-15 UI: abas de listas, criacao, filtro e estado vazio sem listas"
```

---

## Task 5: Teste de integração — RLS de `lists` (fora do `ci`)

**Files:**
- Create: `src/lib/supabase/lists-rls.integration.test.ts`

- [ ] **Step 1: Escrever o teste de isolamento**

Criar `src/lib/supabase/lists-rls.integration.test.ts` (espelha o de `tasks`):

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
  const email = `lists-rls-${crypto.randomUUID()}@test.local`
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

describe('RLS de lists: isolamento entre usuários (RNF-1)', () => {
  let userA: TestUser
  let userB: TestUser
  let listAId: string

  beforeAll(async () => {
    userA = await makeUser()
    userB = await makeUser()

    const { data, error } = await userA.client
      .from('lists')
      .insert({ user_id: userA.id, name: 'Lista privada de A' })
      .select('id')
      .single()
    if (error) throw error
    listAId = data.id
  })

  afterAll(async () => {
    if (userA) await admin.auth.admin.deleteUser(userA.id)
    if (userB) await admin.auth.admin.deleteUser(userB.id)
  })

  it('B não enxerga listas de A no SELECT', async () => {
    const { data: seenByB, error: errB } = await userB.client.from('lists').select('id')
    expect(errB).toBeNull()
    expect(seenByB ?? []).toHaveLength(0)

    const { data: seenByA, error: errA } = await userA.client.from('lists').select('id')
    expect(errA).toBeNull()
    expect((seenByA ?? []).map((r) => r.id)).toContain(listAId)
  })

  it('B não consegue apagar lista de A (RLS filtra; A ainda vê)', async () => {
    await userB.client.from('lists').delete().eq('id', listAId)

    const { data: stillThere } = await userA.client.from('lists').select('id').eq('id', listAId)
    expect(stillThere ?? []).toHaveLength(1)
  })

  it('B não consegue inserir lista com user_id de A (with check)', async () => {
    const { error } = await userB.client
      .from('lists')
      .insert({ user_id: userA.id, name: 'Injeção de B' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste de integração**

Pré-requisito: `supabase start` rodando e `.env` de integração carregado (ver `AGENTS.md`). Garanta o schema atual: `npx supabase db reset`.

Run: `npm run test:integration`
Expected: PASS — os arquivos `tasks-rls` e `lists-rls` passam (isolamento comprovado em ambas as tabelas).

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/lists-rls.integration.test.ts
git commit -m "GC-15 teste de integracao: RLS de lists (isolamento entre usuarios)"
```

---

## Task 6: E2E — criar lista e filtrar por aba (fora do `ci`)

**Files:**
- Create: `e2e/lists.spec.ts`

- [ ] **Step 1: Escrever o E2E**

Criar `e2e/lists.spec.ts`:

```ts
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

    // Aba "Todas" também mostra a tarefa (tem lista, mas "Todas" mostra tudo)
    await page.getByRole('link', { name: 'Todas' }).click()
    await expect(page.getByText(taskInList)).toBeVisible()

    // Voltar à lista e apagar a tarefa (limpeza; a lista permanece — ver nota)
    await listTab.click()
    await page.getByRole('button', { name: `Apagar ${taskInList}` }).click()
    await expect(page.getByText(taskInList)).toHaveCount(0)
  })
})
```

> **Nota de limpeza:** não há ação de "apagar lista" no escopo (RF-2 cobre só criar/selecionar), então cada execução deixa uma lista extra na conta única do dono. Aceitável no repo de teste; anotar como follow-up no PR (candidato a `deleteList` em story futura ou seed reset entre execuções).

- [ ] **Step 2: Rodar o E2E**

Pré-requisito: `supabase start`, app buildável, `E2E_OWNER_EMAIL/PASSWORD` no `.env.local` (ver `AGENTS.md`). O `playwright.config.ts` usa `workers:1` (conta única compartilhada).

Run: `npm run e2e`
Expected: PASS (ou `skipped` se as credenciais não estiverem definidas). Rodar junto com `e2e/tasks.spec.ts` sem interferência.

- [ ] **Step 3: Commit**

```bash
git add e2e/lists.spec.ts
git commit -m "GC-15 E2E: criar lista e filtrar tarefas por aba"
```

---

## Task 7: Verificação final, docs e PR

**Files:**
- Modify (se necessário): `AGENTS.md`

- [ ] **Step 1: Suíte do gate `ci` completa**

Run: `npm run typecheck && npm run lint && npm test -- --run`
Expected: PASS em tudo (é exatamente o que o check `ci` roda).

- [ ] **Step 2: Atualizar `AGENTS.md` se algum comando/pré-requisito mudou**

Revisar `AGENTS.md`: os comandos de teste (`test:integration`, `e2e`) e pré-requisitos não mudam nesta story. Só editar se houver divergência. Se nada mudar, pular este passo (sem commit vazio).

- [ ] **Step 3: Push e abrir o PR**

```bash
git push -u origin glaubercosta/gc-15-gc-d-listas
gh pr create --base main \
  --title "GC-15 Listas (criar, abas, filtro)" \
  --body "$(cat <<'EOF'
Implementa GC-d · Listas (RF-2): tabela `lists` + RLS, criação de lista, abas "Todas" + uma por lista + "＋ Nova lista", filtro de tarefas pela lista ativa (via URL `?list=<id>`) e tarefa herdando a lista ativa (`null` na aba "Todas"). Estado vazio "sem listas".

## Testes
- Unit (gate `ci`): validação de nome, `normalizeListId`, `resolveActiveListId`, `filterTasksByList`.
- Integração RLS (fora do `ci`): isolamento de `lists` entre usuários.
- E2E (fora do `ci`): criar lista + filtrar por aba.

## Follow-ups (não bloqueiam)
- Sem ação de "apagar lista" no escopo: o E2E deixa uma lista extra por execução na conta única (candidato a `deleteList` ou reset de seed no futuro).
- Filtro de tarefas por lista é em memória (fetch-all + função pura), coerente com `sortTasks`/`partitionByStatus`; revisar se o volume crescer.

Fixes GC-15
EOF
)"
```
Expected: PR criado com o ID no título e `Fixes GC-15` no corpo → automação move GC-15 para **In Progress**.

- [ ] **Step 4: Confirmar o check `ci` verde**

Run: `gh pr checks`
Expected: `ci` com status `pass` (merge liberado pelo ruleset `protect-main`). O merge na `main` é feito pelo usuário.

---

## Self-Review

**1. Cobertura do spec (design §4 GC-d + RF-2 + DoD):**
- RF-2.1 criar lista (nome não vazio) → Task 1 (`validateListName`) + Task 3 (`createList`) + Task 4 (`NewList`).
- RF-2.2 abas "Todas" + por lista + "＋ Nova lista" → Task 4 (`ListTabs` + `NewList`).
- RF-2.3 "Todas" mostra tudo; aba filtra → Task 1 (`filterTasksByList`, `resolveActiveListId`) + Task 4 (`page.tsx`).
- Tarefa na aba "Todas" fica sem lista; nas outras herda a lista ativa → Task 3 (`createTask` lê `list_id`) + Task 4 (`TaskQuickAdd` hidden `list_id`).
- DoD: alternar abas filtra → Task 6 (E2E); RLS de `lists` testada → Task 5; estado vazio "sem listas" (RF-4.6) → Task 4 (`role="note"`).
- Modelo de dados (PRD §8): tabela `lists` + FK `on delete set null` → Task 2.

**2. Placeholders:** nenhum "TBD"/"handle edge cases" — todo passo traz código/comando concreto.

**3. Consistência de tipos/nomes:** `List`, `ALL_LISTS`, `normalizeListId`, `resolveActiveListId`, `filterTasksByList` definidos em Task 1 e usados com a mesma assinatura em Tasks 3–4; coluna `list_id` já existente em `tasks` (domínio `Task.list_id` e SELECT de `page.tsx` já a incluem); constraint `tasks_list_id_fkey` só em Task 2.
