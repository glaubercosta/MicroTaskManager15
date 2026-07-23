import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { signOut } from './login/actions'
import {
  buildTaskView,
  todayISO,
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
import { parseTheme, THEME_COOKIE } from '@/domain/theme'
import { AccountMenu } from './account-menu'
import { TaskQuickAdd } from './task-quick-add'
import { ListTabs } from './list-tabs'
import { PriorityDot } from './priority-dot'
import { DueBadge } from './due-badge'
import { HideCompletedToggle } from './hide-completed-toggle'
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
  searchParams: Promise<{ list?: string | string[]; done?: string | string[] }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value)

  const { data: listsData } = await supabase
    .from('lists')
    .select('id,name,created_at')
    .order('created_at', { ascending: true })
  const lists = (listsData ?? []) as List[]

  const { list: rawParam, [HIDE_DONE_PARAM]: rawDone } = await searchParams
  const listParam = Array.isArray(rawParam) ? rawParam[0] : rawParam
  const activeListId = resolveActiveListId(lists, listParam)
  const hideCompleted = parseHideDone(rawDone)

  const { data } = await supabase
    .from('tasks')
    .select('id,title,priority,due_date,status,list_id,created_at')
  const allTasks = (data ?? []) as Task[]
  const tasks = filterTasksByList(allTasks, activeListId)
  const { open, closed, openCount, closedCount } = buildTaskView(tasks, { hideCompleted })

  const today = todayISO()

  return (
    <>
      <header className="topbar">
        <span className="brand">MicroTaskManager</span>
        <AccountMenu
          email={user?.email ?? 'desconhecido'}
          theme={theme}
          signOutAction={signOut}
        />
      </header>
      <main className="container">
        <h1>Tarefas</h1>

        <ListTabs lists={lists} activeListId={activeListId} />

        {lists.length === 0 ? (
          <p role="note">Você ainda não tem listas. Crie a primeira acima para organizar suas tarefas.</p>
        ) : null}

        <TaskQuickAdd key={activeListId ?? ALL_LISTS} activeListId={activeListId} />

        {closedCount > 0 ? (
          <HideCompletedToggle hideCompleted={hideCompleted} activeListId={activeListId} />
        ) : null}

        <section aria-label="Tarefas abertas">
          <h2>Abertas ({openCount})</h2>
          {openCount === 0 && closedCount === 0 ? (
            <p role="note">Nenhuma tarefa aqui ainda. Adicione a primeira acima.</p>
          ) : (
            <ul>
              {open.map((task) => (
                <TaskRow key={task.id} task={task} today={today} />
              ))}
            </ul>
          )}
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
      </main>
    </>
  )
}

function TaskRow({ task, today }: { task: Task; today: string }) {
  const done = task.status === 'done' || task.status === 'canceled'

  return (
    <li style={{ marginBottom: 12 }}>
      <PriorityDot priority={task.priority} />{' '}
      <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.6 : 1 }}>
        {task.title}
      </span>{' '}
      <DueBadge dueDate={task.due_date} today={today} />

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
